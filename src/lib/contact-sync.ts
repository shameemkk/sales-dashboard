import { supabaseBg } from "./supabase-bg";
import { enrichLeadsByIds } from "./enrich";

const LCH_BASE = "https://services.leadconnectorhq.com";
const LCH_LOCATION_ID = "2euS49kV93yDVpJrKvZi";

function lchHeaders() {
  return {
    Authorization: `Bearer ${process.env.LCH_API_TOKEN}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PAGE_SIZE = 500;
const MAX_RETRIES = 3;

export interface ContactSyncResult {
  total: number;
  upserted: number;
  pages: number;
  enriched: number;
}

interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  dateAdded?: string;
  opportunities?: { id: string; pipelineId?: string; stageId?: string }[];
}

function mapContactToRow(c: GHLContact) {
  const opp = c.opportunities?.[0] ?? null;
  return {
    id: c.id,
    first_name: c.firstName ?? null,
    last_name: c.lastName ?? null,
    company_name: c.companyName ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    tags: c.tags ?? [],
    date_added: c.dateAdded ?? null,
    notes: null,
    first_dial_time: null,
    first_text_time: null,
    opportunity_id: opp?.id ?? null,
    synced_at: new Date().toISOString(),
    enriched: false,
  };
}

function buildDateFilter() {
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  return {
    field: "dateAdded",
    operator: "range",
    value: {
      gt: fiveDaysAgo.toISOString(),
      lt: now.toISOString(),
    },
  };
}

async function fetchPageWithRetry(
  page: number,
  filters: object[],
  attempt = 1
): Promise<{ contacts: GHLContact[]; total: number }> {
  const res = await fetch(`${LCH_BASE}/contacts/search`, {
    method: "POST",
    headers: lchHeaders(),
    body: JSON.stringify({
      locationId: LCH_LOCATION_ID,
      page,
      pageLimit: PAGE_SIZE,
      filters,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      console.warn(
        `[contact-sync] page ${page} attempt ${attempt} failed (${res.status}), retrying in ${delay}ms...`
      );
      await sleep(delay);
      return fetchPageWithRetry(page, filters, attempt + 1);
    }
    throw new Error(
      `GHL contacts/search page ${page} failed after ${MAX_RETRIES} attempts: ${res.status} ${body}`
    );
  }

  const data = await res.json();
  return {
    contacts: data.contacts ?? [],
    total: data.total ?? 0,
  };
}

export async function runContactSync(
  jobId: number
): Promise<ContactSyncResult> {
  console.log(`[contact-sync] job ${jobId} starting...`);

  const filters = [buildDateFilter()];

  try {
    // Fetch first page to get total
    const firstPage = await fetchPageWithRetry(1, filters);
    const allContacts: GHLContact[] = [...firstPage.contacts];
    const total = firstPage.total;
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

    console.log(
      `[contact-sync] total=${total}, pages=${totalPages}, page 1 fetched ${firstPage.contacts.length}`
    );

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      await sleep(200);
      try {
        const pageData = await fetchPageWithRetry(page, filters);
        allContacts.push(...pageData.contacts);
        console.log(
          `[contact-sync] page ${page}/${totalPages} fetched ${pageData.contacts.length} (cumulative: ${allContacts.length})`
        );
      } catch (err) {
        console.error(
          `[contact-sync] page ${page}/${totalPages} failed permanently:`,
          err instanceof Error ? err.message : err
        );
        // Continue with remaining pages
      }
    }

    // Upsert to leads table
    const rows = allContacts.map((c) => mapContactToRow(c));
    let upserted = 0;

    for (let i = 0; i < rows.length; i += PAGE_SIZE) {
      const batch = rows.slice(i, i + PAGE_SIZE);
      const batchNum = Math.floor(i / PAGE_SIZE) + 1;
      const { error } = await supabaseBg
        .from("leads")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(
          `[contact-sync] upsert batch ${batchNum} failed:`,
          error.message
        );
      } else {
        upserted += batch.length;
        console.log(
          `[contact-sync] upsert batch ${batchNum} ok (${upserted}/${rows.length})`
        );
      }
    }

    // Enrich the synced contacts automatically
    const syncedIds = allContacts.map((c) => c.id);
    let enrichedCount = 0;

    if (syncedIds.length > 0) {
      console.log(`[contact-sync] job ${jobId} starting enrichment for ${syncedIds.length} contacts...`);
      try {
        const enrichResult = await enrichLeadsByIds(syncedIds);
        enrichedCount = enrichResult.processed;
        console.log(`[contact-sync] job ${jobId} enrichment done: ${enrichedCount}/${syncedIds.length}`);
      } catch (enrichErr) {
        console.error(
          `[contact-sync] job ${jobId} enrichment failed (sync still successful):`,
          enrichErr instanceof Error ? enrichErr.message : enrichErr
        );
      }
    }

    // Update job as completed in unified log
    await supabaseBg
      .from("sync_execution_log")
      .update({
        status: "completed",
        contacts_fetched: allContacts.length,
        contacts_upserted: upserted,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(
      `[contact-sync] job ${jobId} DONE: fetched=${allContacts.length}, upserted=${upserted}, enriched=${enrichedCount}`
    );

    return { total, upserted, pages: totalPages, enriched: enrichedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[contact-sync] job ${jobId} FAILED:`, message);

    // Update job as failed in unified log
    await supabaseBg
      .from("sync_execution_log")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    throw err;
  }
}
