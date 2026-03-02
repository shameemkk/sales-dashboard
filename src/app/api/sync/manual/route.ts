import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runSyncJob } from "@/lib/sync";

export const runtime = "nodejs";

// Triggered from the UI (no secret required — protected by Supabase session)
export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statDate = new Date().toISOString().slice(0, 10);

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

  runSyncJob(job.id as number, statDate).catch((err) =>
    console.error("[sync/manual] error:", err)
  );

  return NextResponse.json({ job_id: job.id, status: "started", stat_date: statDate });
}
