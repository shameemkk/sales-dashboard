import cron, { type ScheduledTask } from "node-cron";
import { supabaseBg } from "./supabase-bg";
import { runContactSync } from "./contact-sync";

let scheduled: ScheduledTask | null = null;

/**
 * Start the in-app scheduler.
 * Runs every minute, checks if current UTC time matches the configured
 * schedule time (hour + minute), and triggers the contact sync if so.
 */
export function startScheduler() {
  if (scheduled) return; // already running

  console.log("[scheduler] started — checking schedule every minute");

  // Check every minute if it's time to run
  scheduled = cron.schedule("* * * * *", async () => {
    try {
      const { data: config, error: configError } = await supabaseBg
        .from("contact_sync_schedule")
        .select("enabled, time_utc")
        .eq("id", 1)
        .single();

      if (configError) {
        console.error("[scheduler] failed to read config:", configError.message);
        return;
      }

      if (!config?.enabled) return;

      const now = new Date();
      const currentUtc = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

      if (currentUtc !== config.time_utc) return;

      console.log(`[scheduler] time match! current=${currentUtc} config=${config.time_utc}`);

      // Check if scheduler already triggered today (not manual runs — only scheduler jobs)
      // We skip this check to allow scheduler to run even if manual sync was done earlier
      // Instead, just check for a running job to prevent concurrent execution
      const { data: running } = await supabaseBg
        .from("contact_sync_jobs")
        .select("id")
        .eq("status", "running")
        .limit(1);

      if (running && running.length > 0) {
        console.log("[scheduler] skipping — a sync job is already running");
        return;
      }

      // Prevent duplicate trigger within the same minute
      const oneMinuteAgo = new Date(now.getTime() - 60_000);
      const { data: recent } = await supabaseBg
        .from("contact_sync_jobs")
        .select("id")
        .gte("started_at", oneMinuteAgo.toISOString())
        .limit(1);

      if (recent && recent.length > 0) {
        console.log("[scheduler] skipping — job already started in the last minute");
        return;
      }

      // Create job and run
      const { data: job, error } = await supabaseBg
        .from("contact_sync_jobs")
        .insert({ status: "running" })
        .select("id")
        .single();

      if (error || !job) {
        console.error("[scheduler] failed to create job:", error?.message);
        return;
      }

      console.log(`[scheduler] triggering scheduled contact sync, job ${job.id}`);

      runContactSync(job.id)
        .then((result) => {
          console.log(
            `[scheduler] job ${job.id} completed: upserted=${result.upserted}, enriched=${result.enriched}`
          );
        })
        .catch((err) => {
          console.error(
            "[scheduler] job failed:",
            err instanceof Error ? err.message : err
          );
        });
    } catch (err) {
      console.error(
        "[scheduler] check failed:",
        err instanceof Error ? err.message : err
      );
    }
  });
}
