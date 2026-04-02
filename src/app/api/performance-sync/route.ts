import { NextRequest, NextResponse } from "next/server";
import { runPerformanceSync } from "@/lib/performance-sync";
import { supabaseBg } from "@/lib/supabase-bg";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const today = new Date().toISOString().slice(0, 10);
  const startDate: string = body.start_date ?? body.date ?? today;
  const endDate: string = body.end_date ?? startDate;

  // Create execution log entry
  const { data: job } = await supabaseBg
    .from("sync_execution_log")
    .insert({
      type: "performance_sync",
      trigger: "manual",
      status: "running",
      sync_date: startDate,
    })
    .select("id")
    .single();

  try {
    const rows = await runPerformanceSync(startDate, endDate);

    // Update log entry on success
    if (job) {
      await supabaseBg
        .from("sync_execution_log")
        .update({
          status: "completed",
          rows_synced: rows.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[performance-sync] error:", message);

    // Update log entry on failure
    if (job) {
      await supabaseBg
        .from("sync_execution_log")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
