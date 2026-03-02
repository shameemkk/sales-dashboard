import { supabaseBg } from "./supabase-bg";

const BASE_URL = "https://send.uparrowagency.com/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbg(...args: any[]) {
  if (process.env.DEBUG === "TRUE") console.error(...args);
}

interface ExternalMetric {
  label: string;
  dates: [string, number][];
}

interface FailedPage {
  page: number;
  error: string;
}

function parseStatsResponse(
  senderId: number,
  statDate: string,
  data: ExternalMetric[]
) {
  const row = {
    sender_id: senderId,
    stat_date: statDate,
    sent: 0,
    replied: 0,
    total_opens: 0,
    unique_opens: 0,
    unsubscribed: 0,
    bounced: 0,
    interested: 0,
  };

  for (const metric of data) {
    const entry = metric.dates.find(([d]) => d === statDate);
    if (!entry) continue;
    const val = entry[1];
    switch (metric.label) {
      case "Sent":         row.sent         = val; break;
      case "Replied":      row.replied       = val; break;
      case "Total Opens":  row.total_opens   = val; break;
      case "Unique Opens": row.unique_opens  = val; break;
      case "Unsubscribed": row.unsubscribed  = val; break;
      case "Bounced":      row.bounced       = val; break;
      case "Interested":   row.interested    = val; break;
    }
  }
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncPage(accounts: any[], statDate: string, token: string): Promise<void> {
  // Upsert account rows into sender_accounts
  const accountRows = accounts.map((item) => ({
    id: item.id,
    name: item.name ?? null,
    email: item.email ?? null,
    daily_limit: item.daily_limit ?? null,
    type: item.type ?? null,
    status: item.status ?? null,
    warmup_enabled: item.warmup_enabled ?? false,
    tags: Array.isArray(item.tags) ? item.tags : [],
    created_at: item.created_at ?? null,
    updated_at: item.updated_at ?? null,
    synced_at: new Date().toISOString(),
  }));

  const { error: accErr } = await supabaseBg
    .from("sender_accounts")
    .upsert(accountRows, { onConflict: "id" });
  if (accErr) throw new Error(`account upsert: ${accErr.message}`);

  // Fetch campaign stats for each account concurrently
  const statsRows: ReturnType<typeof parseStatsResponse>[] = [];
  await Promise.all(
    accounts.map(async (item) => {
      try {
        const url = new URL(`${BASE_URL}/campaign-events/stats`);
        url.searchParams.set("start_date", statDate);
        url.searchParams.set("end_date", statDate);
        url.searchParams.append("sender_email_ids[]", String(item.id));

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          dbg(`[sync] stats API error for account ${item.id}: HTTP ${res.status}`);
          return;
        }

        const json = await res.json();
        statsRows.push(parseStatsResponse(item.id as number, statDate, json.data ?? []));
      } catch (err) {
        dbg(`[sync] stats fetch error for account ${item.id}:`, err instanceof Error ? err.message : err);
      }
    })
  );

  if (statsRows.length > 0) {
    const { error: statsErr } = await supabaseBg
      .from("account_daily_stats")
      .upsert(statsRows, { onConflict: "sender_id,stat_date" });
    if (statsErr) dbg("stats upsert error:", statsErr.message);
  }
}

export async function runSyncJob(jobId: number, statDate: string): Promise<void> {
  const token = process.env.SEND_API_TOKEN!;

  try {
    // Fetch page 1 to discover total_pages
    const firstRes = await fetch(`${BASE_URL}/sender-emails?page=1`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!firstRes.ok) {
      dbg(`[sync] sender-emails page 1 failed: HTTP ${firstRes.status}`);
      throw new Error(`Page 1 fetch failed: ${firstRes.status}`);
    }

    const firstJson = await firstRes.json();
    const first = Array.isArray(firstJson) ? firstJson[0] : firstJson;
    const totalPages: number = first.meta?.last_page ?? 1;

    await supabaseBg
      .from("sync_jobs")
      .update({ total_pages: totalPages })
      .eq("id", jobId);

    const failedPages: FailedPage[] = [];
    let completedPages = 0;

    // Process page 1 (already in memory)
    try {
      await syncPage(first.data ?? [], statDate, token);
      completedPages++;
      await supabaseBg
        .from("sync_jobs")
        .update({ completed_pages: completedPages })
        .eq("id", jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dbg(`[sync] page 1 failed:`, msg);
      failedPages.push({ page: 1, error: msg });
      await supabaseBg
        .from("sync_jobs")
        .update({ failed_pages: failedPages })
        .eq("id", jobId);
    }

    // Process remaining pages sequentially
    for (let page = 2; page <= totalPages; page++) {
      try {
        const res = await fetch(`${BASE_URL}/sender-emails?page=${page}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          dbg(`[sync] sender-emails page ${page} failed: HTTP ${res.status}`);
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const payload = Array.isArray(json) ? json[0] : json;

        await syncPage(payload.data ?? [], statDate, token);
        completedPages++;
        await supabaseBg
          .from("sync_jobs")
          .update({ completed_pages: completedPages })
          .eq("id", jobId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        dbg(`[sync] page ${page} failed:`, msg);
        failedPages.push({ page, error: msg });
        await supabaseBg
          .from("sync_jobs")
          .update({ failed_pages: failedPages })
          .eq("id", jobId);
      }
    }

    await supabaseBg
      .from("sync_jobs")
      .update({
        status: failedPages.length > 0 ? "failed" : "completed",
        failed_pages: failedPages,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dbg(`[sync] job ${jobId} fatal error:`, msg);
    await supabaseBg
      .from("sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        failed_pages: [{ page: 0, error: msg }],
      })
      .eq("id", jobId);
  }
}

export async function runRetryPages(
  jobId: number,
  pageNumbers: number[],
  statDate: string
): Promise<void> {
  const token = process.env.SEND_API_TOKEN!;

  const { data: job } = await supabaseBg
    .from("sync_jobs")
    .select("failed_pages, completed_pages")
    .eq("id", jobId)
    .single();

  const currentFailed: FailedPage[] = (job?.failed_pages as FailedPage[]) ?? [];
  const pageSet = new Set(pageNumbers);
  const remainingFailed = currentFailed.filter((f) => !pageSet.has(f.page));
  let completedPages: number = (job?.completed_pages as number) ?? 0;
  const newFailed: FailedPage[] = [];

  for (const page of pageNumbers) {
    try {
      const res = await fetch(`${BASE_URL}/sender-emails?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        dbg(`[sync/retry] sender-emails page ${page} failed: HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const payload = Array.isArray(json) ? json[0] : json;
      await syncPage(payload.data ?? [], statDate, token);
      completedPages++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dbg(`[sync/retry] page ${page} failed:`, msg);
      newFailed.push({ page, error: msg });
    }
  }

  const allFailed = [...remainingFailed, ...newFailed];
  await supabaseBg
    .from("sync_jobs")
    .update({
      failed_pages: allFailed,
      completed_pages: completedPages,
      status: allFailed.length === 0 ? "completed" : "failed",
      ...(allFailed.length === 0 ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);
}
