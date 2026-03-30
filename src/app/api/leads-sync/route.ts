import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { runLeadsSync } from "@/lib/leads-sync";
import { supabaseBg } from "@/lib/supabase-bg";

// In-memory flag so the UI can poll status
let syncState: {
  status: "idle" | "running" | "completed" | "failed";
  upserted?: number;
  pages?: number;
  total?: number;
  error?: string;
} = { status: "idle" };

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (syncState.status === "running") {
    return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
  }

  syncState = { status: "running" };

  // Fire-and-forget — sync runs in background
  runLeadsSync()
    .then((result) => {
      syncState = { status: "completed", ...result };
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[leads-sync] error:", message);
      syncState = { status: "failed", error: message };
    });

  return NextResponse.json({ ok: true, status: "started" });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also return total lead count from DB
  const { count } = await supabaseBg
    .from("leads")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({ ...syncState, dbCount: count ?? 0 });
}
