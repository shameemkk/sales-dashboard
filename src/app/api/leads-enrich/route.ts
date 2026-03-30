import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";

const LCH_BASE = "https://services.leadconnectorhq.com";
const LCH_LOCATION_ID = "2euS49kV93yDVpJrKvZi";
const CONCURRENCY = 5; // parallel leads per batch
const DELAY_BETWEEN_BATCHES = 1000; // ms pause between batches

function lchHeaders() {
  return {
    Authorization: `Bearer ${process.env.LCH_API_TOKEN}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EnrichResult {
  id: string;
  first_dial_time: string | null;
  first_text_time: string | null;
  notes: string | null;
}

/** Fetch with retry on 429 (up to 3 attempts) */
async function fetchWithRetry(url: string, opts: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, opts);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "0", 10);
      const waitMs = Math.max(retryAfter * 1000, attempt * 2000); // exponential: 2s, 4s, 6s
      console.warn(`[enrich] 429 on ${url.slice(0, 80)}... retry ${attempt}/${retries} in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }
    return res;
  }
  // Last attempt, return whatever we get
  return fetch(url, opts);
}

async function enrichLead(contactId: string): Promise<Omit<EnrichResult, "id">> {
  const convRes = await fetchWithRetry(
    `${LCH_BASE}/conversations/search?locationId=${LCH_LOCATION_ID}&contactId=${contactId}`,
    { headers: lchHeaders(), cache: "no-store" }
  );

  if (!convRes.ok) {
    console.error(`[enrich] conversation search failed for ${contactId}: ${convRes.status}`);
    return { first_dial_time: null, first_text_time: null, notes: null };
  }

  const convData = await convRes.json();
  const conversations: any[] = convData.conversations ?? [];

  if (conversations.length === 0) {
    return { first_dial_time: null, first_text_time: null, notes: null };
  }

  // Fetch messages for conversations sequentially (avoid 429 on messages endpoint too)
  let firstDialTime: Date | null = null;
  let firstTextTime: Date | null = null;
  const allNotes: string[] = [];

  for (const conv of conversations) {
    const msgRes = await fetchWithRetry(
      `${LCH_BASE}/conversations/${conv.id}/messages?type=TYPE_SMS,TYPE_CALL`,
      { headers: lchHeaders(), cache: "no-store" }
    );

    if (!msgRes.ok) continue;

    const msgData = await msgRes.json();
    const messages: any[] = msgData.messages?.messages ?? [];

    for (const msg of messages) {
      if (msg.direction !== "outbound") continue;
      const msgDate = new Date(msg.dateAdded);

      if (msg.messageType === "TYPE_CALL") {
        if (!firstDialTime || msgDate < firstDialTime) firstDialTime = msgDate;
      }
      if (msg.messageType === "TYPE_SMS") {
        if (!firstTextTime || msgDate < firstTextTime) firstTextTime = msgDate;
        if (msg.body) allNotes.push(msg.body);
      }
    }
  }

  return {
    first_dial_time: firstDialTime?.toISOString() ?? null,
    first_text_time: firstTextTime?.toISOString() ?? null,
    notes: allNotes.length > 0 ? allNotes[0] : null,
  };
}

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
      let leads: any[];

      if (leadIds && leadIds.length > 0) {
        const { data, error } = await supabaseBg
          .from("leads")
          .select("id, date_added")
          .in("id", leadIds);
        if (error) throw new Error(error.message);
        leads = data ?? [];
      } else {
        const { data, error } = await supabaseBg
          .from("leads")
          .select("id, date_added")
          .eq("enriched", false);
        if (error) throw new Error(error.message);
        leads = data ?? [];
      }

      enrichState.total = leads.length;
      console.log(`[enrich] starting enrichment for ${leads.length} leads (concurrency=${CONCURRENCY})`);

      // Process in batches of CONCURRENCY with delay between batches
      for (let i = 0; i < leads.length; i += CONCURRENCY) {
        const batch = leads.slice(i, i + CONCURRENCY);

        // Run batch in parallel
        const settled = await Promise.allSettled(
          batch.map(async (lead) => {
            const result = await enrichLead(lead.id);
            return { id: lead.id, ...result };
          })
        );

        const results = settled
          .filter((r): r is PromiseFulfilledResult<EnrichResult> => r.status === "fulfilled")
          .map((r) => r.value);

        // Batch upsert
        if (results.length > 0) {
          const updates = results.map((r) => ({
            id: r.id,
            first_dial_time: r.first_dial_time,
            first_text_time: r.first_text_time,
            notes: r.notes,
            enriched: true,
          }));

          const { error } = await supabaseBg
            .from("leads")
            .upsert(updates, { onConflict: "id" });

          if (error) {
            console.error(`[enrich] batch upsert failed:`, error.message);
          }
        }

        enrichState.processed += batch.length;
        console.log(`[enrich] ${enrichState.processed}/${enrichState.total} done`);

        // Pause between batches to avoid rate limits
        if (i + CONCURRENCY < leads.length) {
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      }

      enrichState.status = "completed";
      console.log(`[enrich] DONE: ${enrichState.processed}/${enrichState.total}`);
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
