import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runContactSync } from "@/lib/contact-sync";
import { supabaseBg } from "@/lib/supabase-bg";

// In-memory state for UI polling
let syncState: {
  status: "idle" | "running" | "completed" | "failed";
  jobId?: number;
  contactsFetched?: number;
  contactsUpserted?: number;
  contactsEnriched?: number;
  error?: string;
} = { status: "idle" };

export async function POST(request: NextRequest) {
  // Dual auth: session (UI) or x-sync-secret (external cron)
  const secret = request.headers.get("x-sync-secret");
  const isCron = secret && secret === process.env.SYNC_SECRET;

  if (!isCron) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // When called via cron, check if schedule is enabled
  if (isCron) {
    const { data: config } = await supabaseBg
      .from("contact_sync_schedule")
      .select("enabled")
      .eq("id", 1)
      .single();

    if (!config?.enabled) {
      return NextResponse.json({ skipped: true, reason: "Schedule disabled" });
    }
  }

  // Guard against concurrent runs
  if (syncState.status === "running") {
    return NextResponse.json(
      { error: "Contact sync already in progress" },
      { status: 409 }
    );
  }

  // Create job record
  const { data: job, error: jobError } = await supabaseBg
    .from("contact_sync_jobs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("[contact-sync] failed to create job:", jobError?.message);
    return NextResponse.json(
      { error: "Failed to create sync job" },
      { status: 500 }
    );
  }

  const jobId = job.id;
  syncState = { status: "running", jobId };

  // Fire-and-forget
  runContactSync(jobId)
    .then((result) => {
      syncState = {
        status: "completed",
        jobId,
        contactsFetched: result.total,
        contactsUpserted: result.upserted,
        contactsEnriched: result.enriched,
      };
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[contact-sync] error:", message);
      syncState = { status: "failed", jobId, error: message };
    });

  return NextResponse.json({ ok: true, status: "started", jobId });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ...syncState });
}
