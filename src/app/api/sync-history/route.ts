import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";
import { ensureSyncTables } from "@/lib/ensure-tables";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSyncTables();

  const type = request.nextUrl.searchParams.get("type");

  let query = supabaseBg
    .from("sync_execution_log")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);

  if (type && ["contact_sync", "performance_sync"].includes(type)) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[sync-history] query failed:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }

  const jobs = (data ?? []).map((row) => ({
    id: row.id,
    scheduleId: row.schedule_id,
    type: row.type,
    trigger: row.trigger,
    status: row.status,
    errorMessage: row.error_message,
    contactsFetched: row.contacts_fetched,
    contactsUpserted: row.contacts_upserted,
    syncDate: row.sync_date,
    rowsSynced: row.rows_synced,
    retryCount: row.retry_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));

  return NextResponse.json({ jobs });
}
