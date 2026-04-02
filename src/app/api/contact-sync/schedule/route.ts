import { NextRequest, NextResponse } from "next/server";
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
    .from("contact_sync_schedule")
    .select("enabled, time_utc, updated_at")
    .eq("id", 1)
    .single();

  if (error) {
    // Table may not exist yet — return defaults
    return NextResponse.json({ enabled: false, timeUtc: "06:00" });
  }

  return NextResponse.json({
    enabled: data.enabled,
    timeUtc: data.time_utc,
    updatedAt: data.updated_at,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { enabled, timeUtc } = body;

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

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (enabled !== undefined) updates.enabled = enabled;
  if (timeUtc !== undefined) updates.time_utc = timeUtc;

  const { error } = await supabaseBg
    .from("contact_sync_schedule")
    .upsert({ id: 1, ...updates }, { onConflict: "id" });

  if (error) {
    console.error("[contact-sync] schedule update failed:", error.message);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
