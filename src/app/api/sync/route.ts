import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runSyncJob } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const statDate: string = body.stat_date ?? new Date().toISOString().slice(0, 10);

  const supabase = await createSupabaseServerClient();

  const { data: job, error } = await supabase
    .from("sync_jobs")
    .insert({ stat_date: statDate, status: "running" })
    .select("id")
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create sync job" },
      { status: 500 }
    );
  }

  // Fire-and-forget — returns immediately, sync runs in background
  runSyncJob(job.id as number, statDate).catch((err) =>
    console.error("[sync] background job error:", err)
  );

  return NextResponse.json({ job_id: job.id, status: "started", stat_date: statDate });
}
