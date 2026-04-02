import cron, { type ScheduledTask } from "node-cron";
import { supabaseBg } from "./supabase-bg";
import { runContactSync } from "./contact-sync";
import { runPerformanceSync } from "./performance-sync";
import { ensureSyncTables } from "./ensure-tables";

let scheduled: ScheduledTask | null = null;

function getYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Start the in-app scheduler.
 * Runs every minute, checks all enabled schedules in `sync_schedules`,
 * and triggers the appropriate sync when the current UTC time matches.
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

        // Check for running jobs of this type to prevent concurrent execution
        const { data: running } = await supabaseBg
          .from("sync_execution_log")
          .select("id")
          .eq("type", sched.type)
          .eq("status", "running")
          .limit(1);

        if (running && running.length > 0) {
          console.log(`[scheduler] skipping ${sched.type} — already running`);
          continue;
        }

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

        // Create execution log entry
        const insertData: Record<string, unknown> = {
          schedule_id: sched.id,
          type: sched.type,
          trigger: "scheduled",
          status: "running",
        };

        // For performance_sync, set the target date to yesterday
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

        console.log(`[scheduler] triggering ${sched.type}, job ${job.id}`);

        // Dispatch based on type
        if (sched.type === "contact_sync") {
          runContactSync(job.id)
            .then((result) => {
              console.log(
                `[scheduler] contact_sync job ${job.id} completed: upserted=${result.upserted}, enriched=${result.enriched}`
              );
            })
            .catch((err) => {
              console.error(
                `[scheduler] contact_sync job ${job.id} failed:`,
                err instanceof Error ? err.message : err
              );
            });
        } else if (sched.type === "performance_sync") {
          const targetDate = getYesterday();
          runPerformanceSync(targetDate, targetDate)
            .then(async (rows) => {
              await supabaseBg
                .from("sync_execution_log")
                .update({
                  status: "completed",
                  rows_synced: rows.length,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", job.id);
              console.log(
                `[scheduler] performance_sync job ${job.id} completed: ${rows.length} rows synced for ${targetDate}`
              );
            })
            .catch(async (err) => {
              const message = err instanceof Error ? err.message : String(err);
              await supabaseBg
                .from("sync_execution_log")
                .update({
                  status: "failed",
                  error_message: message,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", job.id);
              console.error(
                `[scheduler] performance_sync job ${job.id} failed:`,
                message
              );
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
