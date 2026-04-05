import { supabaseBg } from "./supabase-bg";
import { format, subDays } from "date-fns";

const SEND_BASE = "https://send.uparrowagency.com/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbg(...args: any[]) {
  if (process.env.DEBUG === "TRUE") console.error(...args);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Fetch all sender emails (paginated) for a workspace ────────── */
async function fetchAllSenderEmails(token: string, wsLabel: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const url = new URL(`${SEND_BASE}/sender-emails`);
    url.searchParams.set("page", String(page));

    dbg(`[email-analyzer] [${wsLabel}] sender-emails GET page ${page}/${lastPage}`);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`[${wsLabel}] sender-emails page ${page}/${lastPage}: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const payload = Array.isArray(json) ? json[0] : json;
    const data = payload?.data ?? [];
    all.push(...data);

    if (page === 1) {
      lastPage = payload?.meta?.last_page ?? 1;
    }
    dbg(`[email-analyzer] [${wsLabel}] sender-emails page ${page}/${lastPage} → ${res.status} | ${data.length} items (total: ${all.length})`);

    page++;
    if (page <= lastPage) await sleep(200);
  }

  return all;
}

/* ── Fetch warmup data (paginated) for a workspace ──────────────── */
async function fetchWarmupData(token: string, date: string, wsLabel: string) {
  const lookup = new Map<string, number>();
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const url = new URL(`${SEND_BASE}/warmup/sender-emails`);
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);
    url.searchParams.set("page", String(page));

    dbg(`[email-analyzer] [${wsLabel}] warmup GET page ${page}/${lastPage}`);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      dbg(`[email-analyzer] [${wsLabel}] warmup page ${page}/${lastPage} → ${res.status} — skipping remaining`);
      break;
    }

    let json = await res.json();
    // API may return stringified JSON
    if (typeof json === "string") {
      try { json = JSON.parse(json); } catch { break; }
    }

    const payload = Array.isArray(json) ? json[0] : json;
    const data: { email?: string; domain?: string; warmup_score?: number }[] =
      payload?.data ?? (Array.isArray(payload) ? payload : []);

    for (const item of data) {
      const email = item.email ?? "";
      if (email) {
        lookup.set(email.toLowerCase(), item.warmup_score ?? 0);
      }
    }

    if (page === 1) {
      lastPage = payload?.meta?.last_page ?? 1;
    }
    dbg(`[email-analyzer] [${wsLabel}] warmup page ${page}/${lastPage} → ${res.status} | ${data.length} items (lookup: ${lookup.size})`);

    page++;
    if (page <= lastPage) await sleep(200);
  }

  return lookup;
}

/* ── Main sync function ─────────────────────────────────────────── */
export async function runEmailAnalyzerSync(jobId: number): Promise<void> {
  dbg("[email-analyzer] starting sync, job", jobId);

  // 1. Get enabled workspaces with tokens
  const { data: workspaces, error: wsErr } = await supabaseBg
    .from("workspaces")
    .select("id, name, api_token")
    .eq("enabled", true)
    .not("api_token", "is", null);

  if (wsErr) throw new Error(`workspaces query: ${wsErr.message}`);
  if (!workspaces || workspaces.length === 0) {
    await supabaseBg
      .from("sync_execution_log")
      .update({
        status: "completed",
        contacts_fetched: 0,
        rows_synced: 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    dbg("[email-analyzer] no enabled workspaces with tokens");
    return;
  }

  const CONCURRENCY = 3; // process 3 workspaces at a time
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  let totalEmails = 0;
  let completedWorkspaces = 0;

  const totalWs = workspaces.length;

  // Process a single workspace
  async function processWorkspace(ws: { id: string; name: string; api_token: string }, wi: number) {
    const wsLabel = `${ws.name} (${wi + 1}/${totalWs})`;
    try {
      dbg(`[email-analyzer] processing workspace: ${wsLabel}`);

      // Fetch sender emails + warmup in parallel for this workspace
      const [senders, warmupLookup] = await Promise.all([
        fetchAllSenderEmails(ws.api_token, wsLabel),
        fetchWarmupData(ws.api_token, yesterday, wsLabel),
      ]);

      if (senders.length === 0) {
        dbg(`[email-analyzer] [${wsLabel}] 0 senders, skipping`);
        completedWorkspaces++;
        await supabaseBg
          .from("sync_execution_log")
          .update({ contacts_fetched: completedWorkspaces, rows_synced: totalEmails })
          .eq("id", jobId);
        return;
      }

      // Merge & compute metrics
      const rows = senders.map((s) => {
        const email = (s.email ?? "").toLowerCase();
        const domain = email.includes("@") ? email.split("@")[1] : "";
        const sent = Number(s.emails_sent_count) || 0;
        const replies = Number(s.total_replied_count) || 0;
        const bounced = Number(s.bounced_count) || 0;
        const warmupScore = warmupLookup.get(email) ?? 0;

        return {
          workspace_id: String(ws.id),
          workspace_name: ws.name ?? null,
          sender_id: String(s.id),
          email,
          domain,
          total_sent: sent,
          total_replies: replies,
          reply_rate: sent > 0 ? Math.round((replies / sent) * 10000) / 100 : 0,
          total_bounced: bounced,
          bounce_rate: sent > 0 ? Math.round((bounced / sent) * 10000) / 100 : 0,
          warmup_score: warmupScore,
          tags: Array.isArray(s.tags) ? s.tags : [],
          status: s.status ?? null,
          synced_at: new Date().toISOString(),
        };
      });

      // Batch upsert (500 at a time)
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: upErr } = await supabaseBg
          .from("email_performance")
          .upsert(batch, { onConflict: "workspace_id,sender_id" });
        if (upErr) {
          console.error(`[email-analyzer] upsert batch error (ws ${ws.id}):`, upErr.message);
        }
      }

      totalEmails += rows.length;
      completedWorkspaces++;
      dbg(`[email-analyzer] [${wsLabel}] done — ${rows.length} emails synced`);

      await supabaseBg
        .from("sync_execution_log")
        .update({ contacts_fetched: completedWorkspaces, rows_synced: totalEmails })
        .eq("id", jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[email-analyzer] [${wsLabel}] error:`, msg);
      completedWorkspaces++;

      await supabaseBg
        .from("sync_execution_log")
        .update({ contacts_fetched: completedWorkspaces, rows_synced: totalEmails })
        .eq("id", jobId);
    }
  }

  // Run workspaces in concurrent batches of CONCURRENCY
  for (let i = 0; i < workspaces.length; i += CONCURRENCY) {
    const batch = workspaces.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((ws, bi) => processWorkspace(ws, i + bi)));
  }

  // Update job completion
  await supabaseBg
    .from("sync_execution_log")
    .update({
      status: "completed",
      contacts_fetched: completedWorkspaces,
      rows_synced: totalEmails,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  dbg(`[email-analyzer] sync complete: ${totalEmails} emails across ${completedWorkspaces} workspaces`);
}
