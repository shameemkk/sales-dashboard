import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runContactSync } from "@/lib/contact-sync";
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
    .from("contact_sync_jobs")
    .select("id, status, retry_count")
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
    .from("contact_sync_jobs")
    .insert({
      status: "running",
      retry_count: (oldJob.retry_count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (insertError || !newJob) {
    console.error("[contact-sync] retry job creation failed:", insertError?.message);
    return NextResponse.json(
      { error: "Failed to create retry job" },
      { status: 500 }
    );
  }

  // Fire-and-forget
  runContactSync(newJob.id).catch((err) => {
    console.error("[contact-sync] retry failed:", err instanceof Error ? err.message : err);
  });

  return NextResponse.json({ ok: true, jobId: newJob.id });
}
