import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";
import { runEmailAnalyzerSync } from "@/lib/email-analyzer-sync";

let syncState: {
  status: "idle" | "running" | "completed" | "failed";
  jobId?: number;
  error?: string;
} = { status: "idle" };

/* ── GET — poll sync status ─────────────────────────────────────── */
export async function GET() {
  // Also fetch latest job from DB
  const { data: latest } = await supabaseBg
    .from("sync_execution_log")
    .select("*")
    .eq("type", "email_analyzer_sync")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    syncStatus: syncState.status,
    jobId: syncState.jobId,
    error: syncState.error,
    latestJob: latest ?? null,
  });
}

/* ── POST — trigger sync ──────────────────��─────────────────────── */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (syncState.status === "running") {
    return NextResponse.json(
      { error: "Sync already in progress" },
      { status: 409 }
    );
  }

  // Create execution log entry
  const { data: job, error: insertErr } = await supabaseBg
    .from("sync_execution_log")
    .insert({
      type: "email_analyzer_sync",
      trigger: "manual",
      status: "running",
    })
    .select("id")
    .single();

  if (insertErr || !job) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create job" },
      { status: 500 }
    );
  }

  syncState = { status: "running", jobId: job.id };

  // Fire-and-forget
  runEmailAnalyzerSync(job.id)
    .then(() => {
      syncState = { status: "completed", jobId: job.id };
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[email-analyzer] sync error:", message);
      syncState = { status: "failed", jobId: job.id, error: message };

      // Update job as failed
      supabaseBg
        .from("sync_execution_log")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .then(() => {});
    });

  return NextResponse.json({ ok: true, jobId: job.id });
}
