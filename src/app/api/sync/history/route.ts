import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((row) => ({
      id: row.id,
      statDate: row.stat_date,
      status: row.status,
      totalPages: row.total_pages,
      completedPages: row.completed_pages,
      failedPages: row.failed_pages ?? [],
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }))
  );
}
