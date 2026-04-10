import { NextRequest, NextResponse } from "next/server";
import { supabaseBg } from "@/lib/supabase-bg";
import {
  DOMAIN_COLUMNS,
  applyFilters,
  parseFiltersFromParams,
} from "@/lib/email-analyzer-filters";
import { applyFiltersToQuery } from "@/lib/email-analyzer-server-filters";

interface DomainAgg {
  domain: string;
  totalEmails: number;
  avgWarmupScore: number;
  avgReplyRate: number;
  avgBounceRate: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 25));
  const sortBy = searchParams.get("sort_by") || "domain";
  const sortDir = searchParams.get("sort_dir") || "asc";
  const workspaceId = searchParams.get("workspace_id") || "";
  const search = searchParams.get("search") || "";

  const parsedFilters = parseFiltersFromParams(searchParams, DOMAIN_COLUMNS);

  const hasPreRows = parsedFilters.rows.some((r) => {
    const col = DOMAIN_COLUMNS.find((c) => c.id === r.columnId);
    return col?.scope === "domain-pre";
  });
  const hasPostRows = parsedFilters.rows.some((r) => {
    const col = DOMAIN_COLUMNS.find((c) => c.id === r.columnId);
    return col?.scope === "domain-post";
  });
  // In OR mode, if filters span both pre- and post-aggregation columns, we
  // cannot push the pre-filters to SQL — that would intersect with the
  // post-filter evaluation instead of unioning. Fall back to evaluating
  // everything in JS (pre-filters applied to aggregated rows via
  // domain/pre fields mirrored onto the aggregate).
  const pushDownPre =
    parsedFilters.conjunction === "and" || !(hasPreRows && hasPostRows);

  // Fetch all matching rows and aggregate in JS (fine for <5k rows)
  let query = supabaseBg
    .from("email_performance")
    .select("domain, warmup_score, reply_rate, bounce_rate");

  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  if (search) query = query.ilike("domain", `%${search}%`);

  // Push "domain-pre" filters (currently just `domain`) into Supabase when safe.
  if (pushDownPre) {
    query = applyFiltersToQuery(query, parsedFilters, DOMAIN_COLUMNS);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by domain
  const domainMap = new Map<string, { count: number; warmup: number; reply: number; bounce: number }>();

  for (const row of data ?? []) {
    const d = row.domain || "(unknown)";
    const existing = domainMap.get(d) ?? { count: 0, warmup: 0, reply: 0, bounce: 0 };
    existing.count++;
    existing.warmup += Number(row.warmup_score) || 0;
    existing.reply += Number(row.reply_rate) || 0;
    existing.bounce += Number(row.bounce_rate) || 0;
    domainMap.set(d, existing);
  }

  // Build aggregated array
  let domains: DomainAgg[] = [];
  for (const [domain, agg] of domainMap) {
    domains.push({
      domain,
      totalEmails: agg.count,
      avgWarmupScore: Math.round((agg.warmup / agg.count) * 100) / 100,
      avgReplyRate: Math.round((agg.reply / agg.count) * 100) / 100,
      avgBounceRate: Math.round((agg.bounce / agg.count) * 100) / 100,
    });
  }

  // Apply filters in JS to the aggregated array. When pre-filters were NOT
  // pushed down (OR-mode with mixed scopes), we evaluate the full filter set
  // here so the conjunction semantics match what the user requested. The
  // aggregated row exposes `domain` directly, so domain-pre rules still work
  // against it. Otherwise, only post-aggregation rows need re-evaluation.
  const filtersToApplyInJs = pushDownPre
    ? {
        conjunction: parsedFilters.conjunction,
        rows: parsedFilters.rows.filter((r) => {
          const col = DOMAIN_COLUMNS.find((c) => c.id === r.columnId);
          return col?.scope === "domain-post";
        }),
      }
    : parsedFilters;
  domains = applyFilters(
    domains as unknown as Array<Record<string, unknown>>,
    filtersToApplyInJs,
    DOMAIN_COLUMNS,
  ) as unknown as DomainAgg[];

  // Sort
  const validSortFields = ["domain", "totalEmails", "avgWarmupScore", "avgReplyRate", "avgBounceRate"];
  const field = validSortFields.includes(sortBy) ? sortBy : "domain";
  const dir = sortDir === "desc" ? -1 : 1;

  domains.sort((a, b) => {
    const av = a[field as keyof DomainAgg];
    const bv = b[field as keyof DomainAgg];
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    return ((av as number) - (bv as number)) * dir;
  });

  // Paginate
  const total = domains.length;
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  domains = domains.slice(start, start + limit);

  return NextResponse.json({
    data: domains,
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: limit,
      total,
    },
  });
}
