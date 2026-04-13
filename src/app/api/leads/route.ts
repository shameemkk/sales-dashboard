import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseFiltersFromParams, type ParsedFilterRow } from "@/lib/email-analyzer-filters";
import { LEADS_COLUMNS } from "@/lib/leads-filters";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 250;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const search = searchParams.get("search") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse all server-side filter rows (tags + speed columns).
  const parsed = parseFiltersFromParams(searchParams, LEADS_COLUMNS);
  const tagRows   = parsed.rows.filter((r) => r.columnId === "tags");
  const speedRows = parsed.rows.filter((r) => r.columnId === "dialSpeed" || r.columnId === "textSpeed");
  const useAnd    = parsed.conjunction === "and" || parsed.rows.length === 1;

  // Elapsed minutes between two ISO timestamps; null when event hasn't occurred.
  function elapsedMin(from: string | null, to: string | null): number | null {
    if (!from || !to) return null;
    const diff = new Date(to).getTime() - new Date(from).getTime();
    if (diff < 0) return null;
    return Math.round(diff / 60000);
  }

  // Evaluate one speed filter row against a computed elapsed-minutes value.
  function evalSpeedRow(row: ParsedFilterRow, minutes: number | null): boolean {
    if (row.operator === "is_empty")     return minutes === null;
    if (row.operator === "is_not_empty") return minutes !== null;
    if (minutes === null) return false;
    const n = minutes;
    switch (row.operator) {
      case "eq":      return n === (row.value as number);
      case "neq":     return n !== (row.value as number);
      case "gt":      return n >  (row.value as number);
      case "gte":     return n >= (row.value as number);
      case "lt":      return n <  (row.value as number);
      case "lte":     return n <= (row.value as number);
      case "between": { const [lo, hi] = row.value as [number, number]; return n >= lo && n <= hi; }
      default: return true;
    }
  }

  // Apply one tag filter row to a Supabase query (main + stats queries).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyTagRow<Q>(q: Q, row: ParsedFilterRow): Q {
    const names = (row.value as string[]) ?? [];
    switch (row.operator) {
      case "has_any":
        return (q as any).overlaps("tags", names);
      case "has_all":
        return (q as any).contains("tags", names);
      case "has_none": {
        // Escape backslashes then double-quotes so tag names with special chars
        // don't corrupt the PostgreSQL array literal: {"tag","other tag",...}
        const escaped = names.map((n) => `"${n.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
        return (q as any).filter("tags", "not.ov", `{${escaped}}`);
      }
      case "is_empty":
        return (q as any).filter("tags", "eq", "{}");
      case "is_not_empty":
        return (q as any).not("tags", "eq", "{}");
      default:
        return q;
    }
  }

  // Helper to apply common search/date/tag conditions to any query builder.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyBaseFilters<Q>(q: Q): Q {
    if (search) {
      // Strip PostgREST .or() metacharacters (,  ( ) ") that would break the filter
      // string parser, then escape PostgreSQL LIKE wildcards so user input is literal.
      const safe = search.replace(/[,()'"]/g, "").replace(/%/g, "\\%").replace(/_/g, "\\_");
      q = (q as any).or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,company_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
    if (dateFrom) q = (q as any).gte("date_added", dateFrom);
    if (dateTo)   q = (q as any).lte("date_added", dateTo);
    if (useAnd) for (const row of tagRows) q = applyTagRow(q, row);
    return q;
  }

  // If speed filters are active, resolve matching IDs server-side:
  // fetch timestamps for all leads passing base filters, compute speeds in JS,
  // then restrict main + stats queries to those IDs.
  let speedMatchedIds: string[] | null = null;
  if (speedRows.length > 0) {
    let tsQuery = applyBaseFilters(
      supabase.from("leads").select("id, date_added, first_dial_time, first_text_time").limit(10000)
    );
    const { data: tsRows } = await tsQuery;
    if (tsRows) {
      speedMatchedIds = tsRows.filter((r) => {
        const checks = speedRows.map((row) => {
          const minutes = row.columnId === "dialSpeed"
            ? elapsedMin(r.date_added, r.first_dial_time)
            : elapsedMin(r.date_added, r.first_text_time);
          return evalSpeedRow(row, minutes);
        });
        return useAnd ? checks.every(Boolean) : checks.some(Boolean);
      }).map((r) => r.id);
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = applyBaseFilters(
    supabase.from("leads").select("*", { count: "exact" }).order("date_added", { ascending: false }).range(from, to)
  );
  if (speedMatchedIds) query = (query as any).in("id", speedMatchedIds.length > 0 ? speedMatchedIds : ["__none__"]);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute average speed-to-dial and speed-to-text across the full filtered set
  let statsQuery = applyBaseFilters(
    supabase.from("leads").select("date_added, first_dial_time, first_text_time")
  );
  if (speedMatchedIds) statsQuery = (statsQuery as any).in("id", speedMatchedIds.length > 0 ? speedMatchedIds : ["__none__"]);

  const { data: statsRows } = await statsQuery;

  let avgSpeedToDial: number | null = null;
  let avgSpeedToText: number | null = null;

  if (statsRows && statsRows.length > 0) {
    let dialSum = 0, dialCount = 0;
    let textSum = 0, textCount = 0;

    for (const row of statsRows) {
      if (row.date_added && row.first_dial_time) {
        const diff = new Date(row.first_dial_time).getTime() - new Date(row.date_added).getTime();
        if (diff >= 0) { dialSum += diff; dialCount++; }
      }
      if (row.date_added && row.first_text_time) {
        const diff = new Date(row.first_text_time).getTime() - new Date(row.date_added).getTime();
        if (diff >= 0) { textSum += diff; textCount++; }
      }
    }
    
    avgSpeedToDial = dialCount > 0 ? Math.round(dialSum / dialCount / 60000) : null;
    avgSpeedToText = textCount > 0 ? Math.round(textSum / textCount / 60000) : null;
  }

  const total = count ?? 0;
  const lastPage = Math.max(Math.ceil(total / pageSize), 1);

  return NextResponse.json({
    data: data ?? [],
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: pageSize,
      total,
    },
    stats: {
      avgSpeedToDial,
      avgSpeedToText,
      
    },
  });
}
