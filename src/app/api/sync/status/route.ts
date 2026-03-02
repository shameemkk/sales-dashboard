import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    id: data.id,
    statDate: data.stat_date,
    status: data.status,
    totalPages: data.total_pages,
    completedPages: data.completed_pages,
    failedPages: data.failed_pages ?? [],
    startedAt: data.started_at,
    completedAt: data.completed_at,
  });
}
