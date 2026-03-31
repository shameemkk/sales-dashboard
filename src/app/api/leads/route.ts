import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("date_added", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  if (dateFrom) query = query.gte("date_added", dateFrom);
  if (dateTo) query = query.lte("date_added", dateTo);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute average speed-to-dial and speed-to-text across the full filtered set
  let statsQuery = supabase
    .from("leads")
    .select("date_added, first_dial_time, first_text_time");

  if (search) {
    statsQuery = statsQuery.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }
  if (dateFrom) statsQuery = statsQuery.gte("date_added", dateFrom);
  if (dateTo) statsQuery = statsQuery.lte("date_added", dateTo);

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
