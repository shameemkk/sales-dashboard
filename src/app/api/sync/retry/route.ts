import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runRetryPages } from "@/lib/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { job_id } = await request.json();
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: job, error } = await supabase
    .from("sync_jobs")
    .select("failed_pages, stat_date, status")
    .eq("id", job_id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "running") {
    return NextResponse.json({ error: "Job is already running" }, { status: 409 });
  }

  const failedPages = (job.failed_pages as { page: number; error: string }[]) ?? [];
  const pageNumbers = failedPages.map((f) => f.page).filter((p) => p > 0);

  if (pageNumbers.length === 0) {
    return NextResponse.json({ message: "No failed pages to retry" });
  }

  await supabase
    .from("sync_jobs")
    .update({ status: "running" })
    .eq("id", job_id);

  runRetryPages(job_id as number, pageNumbers, job.stat_date as string).catch((err) =>
    console.error("[sync] retry error:", err)
  );

  return NextResponse.json({ job_id, pages_retrying: pageNumbers });
}
