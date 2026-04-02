import { supabaseBg } from "./supabase-bg";

const LCH_BASE = "https://services.leadconnectorhq.com";
const LCH_LOCATION_ID = "2euS49kV93yDVpJrKvZi";
const CONCURRENCY = 5;
const DELAY_BETWEEN_BATCHES = 1000;

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
      const waitMs = Math.max(retryAfter * 1000, attempt * 2000);
      console.warn(`[enrich] 429 on ${url.slice(0, 80)}... retry ${attempt}/${retries} in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }
    return res;
  }
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

export interface EnrichLeadsResult {
  processed: number;
  total: number;
}

/**
 * Enrich a set of leads by their IDs.
 * Fetches conversations/messages from GHL to find first dial/text times.
 * Processes in batches with concurrency control and rate-limit handling.
 *
 * @param leadIds - Array of lead IDs to enrich
 * @param onProgress - Optional callback called after each batch with (processed, total)
 */
export async function enrichLeadsByIds(
  leadIds: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<EnrichLeadsResult> {
  if (leadIds.length === 0) {
    return { processed: 0, total: 0 };
  }

  console.log(`[enrich] starting enrichment for ${leadIds.length} leads (concurrency=${CONCURRENCY})`);

  let processed = 0;
  const total = leadIds.length;

  for (let i = 0; i < leadIds.length; i += CONCURRENCY) {
    const batch = leadIds.slice(i, i + CONCURRENCY);

    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        const result = await enrichLead(id);
        return { id, ...result };
      })
    );

    const results = settled
      .filter((r): r is PromiseFulfilledResult<EnrichResult> => r.status === "fulfilled")
      .map((r) => r.value);

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

    processed += batch.length;
    onProgress?.(processed, total);
    console.log(`[enrich] ${processed}/${total} done`);

    if (i + CONCURRENCY < leadIds.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  console.log(`[enrich] DONE: ${processed}/${total}`);
  return { processed, total };
}
