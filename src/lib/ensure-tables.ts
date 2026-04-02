import { supabaseBg } from "./supabase-bg";

let initialized = false;

/**
 * Ensure the unified sync tables exist.
 * Creates `sync_schedules` and `sync_execution_log` if missing,
 * then migrates data from the legacy tables.
 * Safe to call multiple times — only runs once per process.
 */
export async function ensureSyncTables() {
  if (initialized) return;

  try {
    // Quick probe: if sync_schedules already has rows (or exists), skip creation
    const { error: probeError } = await supabaseBg
      .from("sync_schedules")
      .select("id")
      .limit(1);

    if (!probeError) {
      initialized = true;
      return;
    }

    // Table doesn't exist — create via raw SQL using Supabase rpc
    // We use individual queries since supabase-js doesn't support multi-statement SQL
    console.log("[ensure-tables] creating sync_schedules and sync_execution_log...");

    // Create sync_schedules
    const { error: e1 } = await supabaseBg.rpc("exec_sql", {
      query: `
        CREATE TABLE IF NOT EXISTS sync_schedules (
          id          SERIAL PRIMARY KEY,
          type        TEXT NOT NULL UNIQUE CHECK (type IN ('contact_sync', 'performance_sync')),
          enabled     BOOLEAN NOT NULL DEFAULT false,
          time_utc    TEXT NOT NULL DEFAULT '06:00',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `,
    });

    if (e1) {
      console.error("[ensure-tables] failed to create sync_schedules:", e1.message);
      // Try without rpc — table may need to be created manually
      console.error("[ensure-tables] Please create the tables manually in Supabase SQL editor. See ensure-tables.ts for schema.");
      initialized = true;
      return;
    }

    // Create sync_execution_log
    const { error: e2 } = await supabaseBg.rpc("exec_sql", {
      query: `
        CREATE TABLE IF NOT EXISTS sync_execution_log (
          id                 SERIAL PRIMARY KEY,
          schedule_id        INT REFERENCES sync_schedules(id) ON DELETE SET NULL,
          type               TEXT NOT NULL CHECK (type IN ('contact_sync', 'performance_sync')),
          trigger            TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled', 'retry')),
          status             TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
          error_message      TEXT,
          contacts_fetched   INT,
          contacts_upserted  INT,
          sync_date          TEXT,
          rows_synced        INT,
          retry_count        INT NOT NULL DEFAULT 0,
          started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at       TIMESTAMPTZ
        );
      `,
    });

    if (e2) {
      console.error("[ensure-tables] failed to create sync_execution_log:", e2.message);
    }

    // Migrate data from legacy tables (best-effort)
    await migrateLegacyData();

    console.log("[ensure-tables] done");
  } catch (err) {
    console.error(
      "[ensure-tables] error:",
      err instanceof Error ? err.message : err
    );
  }

  initialized = true;
}

async function migrateLegacyData() {
  try {
    // Migrate schedule config from contact_sync_schedule
    const { data: oldSchedule } = await supabaseBg
      .from("contact_sync_schedule")
      .select("enabled, time_utc")
      .eq("id", 1)
      .single();

    if (oldSchedule) {
      await supabaseBg
        .from("sync_schedules")
        .upsert(
          {
            type: "contact_sync",
            enabled: oldSchedule.enabled,
            time_utc: oldSchedule.time_utc,
          },
          { onConflict: "type" }
        );
      console.log("[ensure-tables] migrated contact_sync schedule config");
    }
  } catch {
    // Legacy table may not exist — that's fine
  }

  try {
    // Migrate job history from contact_sync_jobs
    const { data: oldJobs } = await supabaseBg
      .from("contact_sync_jobs")
      .select("*")
      .order("id", { ascending: true });

    if (oldJobs && oldJobs.length > 0) {
      const rows = oldJobs.map((j) => ({
        type: "contact_sync" as const,
        trigger: j.retry_count > 0 ? "retry" as const : "manual" as const,
        status: j.status,
        error_message: j.error_message,
        contacts_fetched: j.contacts_fetched,
        contacts_upserted: j.contacts_upserted,
        retry_count: j.retry_count ?? 0,
        started_at: j.started_at,
        completed_at: j.completed_at,
      }));

      const { error } = await supabaseBg
        .from("sync_execution_log")
        .insert(rows);

      if (!error) {
        console.log(`[ensure-tables] migrated ${rows.length} contact_sync_jobs`);
      }
    }
  } catch {
    // Legacy table may not exist — that's fine
  }
}
