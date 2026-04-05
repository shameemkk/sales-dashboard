import cron, { type ScheduledTask } from "node-cron";
import { supabaseBg } from "./supabase-bg";
import { runContactSync } from "./contact-sync";
import { runPerformanceSync } from "./performance-sync";
import { runEmailAnalyzerSync } from "./email-analyzer-sync";
import { ensureSyncTables } from "./ensure-tables";

let scheduled: ScheduledTask | null = null;
let processing = false; // prevents concurrent queue processing

function getYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Dispatch a single job by type. Updates status to "running" before starting,
 * then "completed" or "failed" on finish. Calls processQueue() when done.
 */
async function dispatchJob(jobId: number, type: string) {
  // Mark as running
  await supabaseBg
    .from("sync_execution_log")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  console.log(`[scheduler] running ${type}, job ${jobId}`);

  try {
    if (type === "contact_sync") {
      const result = await runContactSync(jobId);
      console.log(
        `[scheduler] contact_sync job ${jobId} completed: upserted=${result.upserted}, enriched=${result.enriched}`
      );
    } else if (type === "performance_sync") {
      const targetDate = getYesterday();
      const rows = await runPerformanceSync(targetDate, targetDate);
      await supabaseBg
        .from("sync_execution_log")
        .update({
          status: "completed",
          rows_synced: rows.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      console.log(
        `[scheduler] performance_sync job ${jobId} completed: ${rows.length} rows synced for ${targetDate}`
      );
    } else if (type === "email_analyzer_sync") {
      await runEmailAnalyzerSync(jobId);
      console.log(`[scheduler] email_analyzer_sync job ${jobId} completed`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseBg
      .from("sync_execution_log")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    console.error(`[scheduler] ${type} job ${jobId} failed:`, message);
  }

  // Process next queued job
  await processQueue();
}

/**
 * Pick the next queued job and dispatch it.
 * Only one job runs at a time across all types.
 */
async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    // Check if anything is currently running
    const { data: running } = await supabaseBg
      .from("sync_execution_log")
      .select("id")
      .eq("status", "running")
      .limit(1);

    if (running && running.length > 0) {
      processing = false;
      return; // something still running, wait
    }

    // Pick next queued job (oldest first)
    const { data: queued } = await supabaseBg
      .from("sync_execution_log")
      .select("id, type")
      .eq("status", "queued")
      .order("started_at", { ascending: true })
      .limit(1);

    if (!queued || queued.length === 0) {
      processing = false;
      return; // nothing queued
    }

    const next = queued[0];
    processing = false;
    console.log(`[scheduler] dequeuing ${next.type}, job ${next.id}`);

    // Fire-and-forget — dispatchJob will call processQueue again when done
    dispatchJob(next.id, next.type).catch((err) => {
      console.error("[scheduler] dispatchJob unhandled error:", err instanceof Error ? err.message : err);
      processQueue(); // ensure queue keeps moving
    });
  } catch (err) {
    console.error("[scheduler] processQueue error:", err instanceof Error ? err.message : err);
    processing = false;
  }
}

/**
 * Start the in-app scheduler.
 * Runs every minute, checks all enabled schedules in `sync_schedules`,
 * and triggers or queues the appropriate sync when the current UTC time matches.
 */
export function startScheduler() {
  if (scheduled) return; // already running

  console.log("[scheduler] started — checking schedules every minute");

  scheduled = cron.schedule("* * * * *", async () => {
    try {
      await ensureSyncTables();

      // Read all enabled schedules
      const { data: schedules, error: configError } = await supabaseBg
        .from("sync_schedules")
        .select("id, type, time_utc")
        .eq("enabled", true);

      if (configError) {
        console.error("[scheduler] failed to read schedules:", configError.message);
        return;
      }

      if (!schedules || schedules.length === 0) return;

      const now = new Date();
      const currentUtc = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

      for (const sched of schedules) {
        if (sched.time_utc !== currentUtc) continue;

        console.log(`[scheduler] time match for ${sched.type}! current=${currentUtc} config=${sched.time_utc}`);

        // Prevent duplicate trigger within the same minute
        const oneMinuteAgo = new Date(now.getTime() - 60_000);
        const { data: recent } = await supabaseBg
          .from("sync_execution_log")
          .select("id")
          .eq("type", sched.type)
          .gte("started_at", oneMinuteAgo.toISOString())
          .limit(1);

        if (recent && recent.length > 0) {
          console.log(`[scheduler] skipping ${sched.type} — job already started in the last minute`);
          continue;
        }

        // Check if ANY job is currently running (across all types)
        const { data: running } = await supabaseBg
          .from("sync_execution_log")
          .select("id, type")
          .eq("status", "running")
          .limit(1);

        const isRunning = running && running.length > 0;

        // Create execution log entry — queued if something is running, else running
        const insertData: Record<string, unknown> = {
          schedule_id: sched.id,
          type: sched.type,
          trigger: "scheduled",
          status: isRunning ? "queued" : "running",
        };

        if (sched.type === "performance_sync") {
          insertData.sync_date = getYesterday();
        }

        const { data: job, error } = await supabaseBg
          .from("sync_execution_log")
          .insert(insertData)
          .select("id")
          .single();

        if (error || !job) {
          console.error(`[scheduler] failed to create job for ${sched.type}:`, error?.message);
          continue;
        }

        if (isRunning) {
          console.log(`[scheduler] queued ${sched.type}, job ${job.id} (waiting for job ${running![0].id} to finish)`);
        } else {
          // Dispatch immediately (fire-and-forget)
          dispatchJob(job.id, sched.type).catch((err) => {
            console.error("[scheduler] dispatchJob unhandled error:", err instanceof Error ? err.message : err);
            processQueue();
          });
        }
      }
    } catch (err) {
      console.error(
        "[scheduler] check failed:",
        err instanceof Error ? err.message : err
      );
    }
  });
}
