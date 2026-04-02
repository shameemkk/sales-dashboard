import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const scheduleId = parseInt(id, 10);
  if (isNaN(scheduleId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const { enabled, timeUtc } = body;

  // Validate time format if provided
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

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (enabled !== undefined) updates.enabled = enabled;
  if (timeUtc !== undefined) updates.time_utc = timeUtc;

  const { error } = await supabaseBg
    .from("sync_schedules")
    .update(updates)
    .eq("id", scheduleId);

  if (error) {
    console.error("[schedules] update failed:", error.message);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const scheduleId = parseInt(id, 10);
  if (isNaN(scheduleId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error } = await supabaseBg
    .from("sync_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    console.error("[schedules] delete failed:", error.message);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
