import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseBg
    .from("contact_sync_jobs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[contact-sync] history query failed:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }

  const jobs = (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    errorMessage: row.error_message,
    contactsFetched: row.contacts_fetched,
    contactsUpserted: row.contacts_upserted,
    retryCount: row.retry_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));

  return NextResponse.json({ jobs });
}
