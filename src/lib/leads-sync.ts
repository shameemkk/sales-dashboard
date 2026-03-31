import { supabaseBg } from "./supabase-bg";

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

export interface LeadsSyncResult {
  total: number;
  upserted: number;
  pages: number;
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
  const opportunityId = opp?.id ?? null;
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
    opportunity_id: opportunityId,
    synced_at: new Date().toISOString(),
    enriched: false,
  };
}

const PAGE_SIZE = 500;

export async function runLeadsSync(): Promise<LeadsSyncResult> {
  console.log("[leads-sync] starting sync...");

  // Fetch first page to get total
  const firstRes = await fetch(`${LCH_BASE}/contacts/search`, {
    method: "POST",
    headers: lchHeaders(),
    body: JSON.stringify({
      locationId: LCH_LOCATION_ID,
      page: 1,
      pageLimit: PAGE_SIZE,
    }),
    cache: "no-store",
  });

  if (!firstRes.ok) {
    const body = await firstRes.text();
    console.error(`[leads-sync] contacts/search failed: ${firstRes.status}`, body);
    throw new Error(`GHL contacts/search failed: ${firstRes.status} ${firstRes.statusText}`);
  }

  const firstData = await firstRes.json();
  const allContacts: GHLContact[] = firstData.contacts ?? [];
  const total: number = firstData.total ?? allContacts.length;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  console.log(`[leads-sync] total contacts=${total}, pages=${totalPages}, page 1 fetched ${allContacts.length}`);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    await sleep(200);

    const res = await fetch(`${LCH_BASE}/contacts/search`, {
      method: "POST",
      headers: lchHeaders(),
      body: JSON.stringify({
        locationId: LCH_LOCATION_ID,
        page,
        pageLimit: PAGE_SIZE,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[leads-sync] page ${page}/${totalPages} failed: ${res.status}`);
      continue;
    }

    const data = await res.json();
    const contacts: GHLContact[] = data.contacts ?? [];
    allContacts.push(...contacts);

    console.log(`[leads-sync] page ${page}/${totalPages} fetched ${contacts.length} contacts (cumulative: ${allContacts.length})`);
  }

  const rows = allContacts.map((c) => mapContactToRow(c));

  console.log(`[leads-sync] upserting ${rows.length} rows to Supabase...`);

  let upserted = 0;

  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const batch = rows.slice(i, i + PAGE_SIZE);
    const batchNum = Math.floor(i / PAGE_SIZE) + 1;
    const { error } = await supabaseBg
      .from("leads")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`[leads-sync] upsert batch ${batchNum} failed:`, error.message);
    } else {
      upserted += batch.length;
      console.log(`[leads-sync] upsert batch ${batchNum} ok (${upserted}/${rows.length})`);
    }
  }

  console.log(`[leads-sync] DONE: upserted=${upserted}/${rows.length}`);

  return { total, upserted, pages: totalPages };
}
