import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runContactSync } from "@/lib/contact-sync";
import { runPerformanceSync } from "@/lib/performance-sync";
import { supabaseBg } from "@/lib/supabase-bg";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const jobId = body.job_id;

  if (!jobId) {
    return NextResponse.json(
      { error: "job_id is required" },
      { status: 400 }
    );
  }

  // Look up the failed job
  const { data: oldJob, error: lookupError } = await supabaseBg
    .from("sync_execution_log")
    .select("id, type, status, retry_count, sync_date")
    .eq("id", jobId)
    .single();

  if (lookupError || !oldJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (oldJob.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed jobs can be retried" },
      { status: 400 }
    );
  }

  // Create a new job with incremented retry_count
  const { data: newJob, error: insertError } = await supabaseBg
    .from("sync_execution_log")
    .insert({
      type: oldJob.type,
      trigger: "retry",
      status: "running",
      retry_count: (oldJob.retry_count ?? 0) + 1,
      sync_date: oldJob.sync_date,
    })
    .select("id")
    .single();

  if (insertError || !newJob) {
    console.error("[sync-history] retry job creation failed:", insertError?.message);
    return NextResponse.json(
      { error: "Failed to create retry job" },
      { status: 500 }
    );
  }

  // Fire-and-forget based on type
  if (oldJob.type === "contact_sync") {
    runContactSync(newJob.id).catch((err) => {
      console.error("[sync-history] contact_sync retry failed:", err instanceof Error ? err.message : err);
    });
  } else if (oldJob.type === "performance_sync") {
    const targetDate = oldJob.sync_date ?? getYesterday();
    runPerformanceSync(targetDate, targetDate)
      .then((rows) => {
        return supabaseBg
          .from("sync_execution_log")
          .update({
            status: "completed",
            sync_date: targetDate,
            rows_synced: rows.length,
            completed_at: new Date().toISOString(),
          })
          .eq("id", newJob.id);
      })
      .catch(async (err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[sync-history] performance_sync retry failed:", message);
        await supabaseBg
          .from("sync_execution_log")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", newJob.id);
      });
  }

  return NextResponse.json({ ok: true, jobId: newJob.id });
}

function getYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
