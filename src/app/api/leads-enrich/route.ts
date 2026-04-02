import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";
import { enrichLeadsByIds } from "@/lib/enrich";

// In-memory state for progress tracking
let enrichState: {
  status: "idle" | "running" | "completed" | "failed";
  processed: number;
  total: number;
  error?: string;
} = { status: "idle", processed: 0, total: 0 };

// POST: enrich specific leads (by IDs) or all un-enriched leads
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (enrichState.status === "running") {
    return NextResponse.json({ error: "Enrichment already in progress" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const leadIds: string[] | undefined = body.leadIds;

  enrichState = { status: "running", processed: 0, total: 0 };

  // Fire-and-forget
  (async () => {
    try {
      let ids: string[];

      if (leadIds && leadIds.length > 0) {
        ids = leadIds;
      } else {
        const { data, error } = await supabaseBg
          .from("leads")
          .select("id")
          .eq("enriched", false);
        if (error) throw new Error(error.message);
        ids = (data ?? []).map((r) => r.id);
      }

      enrichState.total = ids.length;

      const result = await enrichLeadsByIds(ids, (processed, total) => {
        enrichState.processed = processed;
        enrichState.total = total;
      });

      enrichState = { status: "completed", processed: result.processed, total: result.total };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[enrich] error:", message);
      enrichState = { ...enrichState, status: "failed", error: message };
    }
  })();

  return NextResponse.json({ ok: true, status: "started" });
}

// GET: poll enrichment status
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Also return enriched / total counts from DB
  const [enrichedRes, totalRes] = await Promise.all([
    supabaseBg.from("leads").select("*", { count: "exact", head: true }).eq("enriched", true),
    supabaseBg.from("leads").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    ...enrichState,
    enrichedCount: enrichedRes.count ?? 0,
    totalCount: totalRes.count ?? 0,
  });
}
