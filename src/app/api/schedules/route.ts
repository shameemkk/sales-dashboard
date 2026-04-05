import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";
import { ensureSyncTables } from "@/lib/ensure-tables";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSyncTables();

  const { data, error } = await supabaseBg
    .from("sync_schedules")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }

  const schedules = (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    enabled: row.enabled,
    timeUtc: row.time_utc,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSyncTables();

  const body = await request.json();
  const { type, timeUtc, enabled } = body;

  // Validate type
  if (!type || !["contact_sync", "performance_sync", "email_analyzer_sync"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'contact_sync', 'performance_sync', or 'email_analyzer_sync'" },
      { status: 400 }
    );
  }

  // Validate time format HH:MM
  if (timeUtc !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(timeUtc)) {
      return NextResponse.json(
        { error: "timeUtc must be in HH:MM format" },
        { status: 400 }
      );
    }
    const [h, m] = timeUtc.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return NextResponse.json(
        { error: "Invalid time value" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabaseBg
    .from("sync_schedules")
    .upsert(
      {
        type,
        enabled: enabled ?? true,
        time_utc: timeUtc ?? "06:00",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "type" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[schedules] create failed:", error.message);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    schedule: {
      id: data.id,
      type: data.type,
      enabled: data.enabled,
      timeUtc: data.time_utc,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  });
}
