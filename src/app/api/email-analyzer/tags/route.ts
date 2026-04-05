import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";

const SEND_BASE = "https://send.uparrowagency.com/api";

/* ── POST — add tags to selected emails (bulk) ──────────────────── */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderIds, tagIds } = await request.json();
  if (!Array.isArray(senderIds) || !Array.isArray(tagIds) || senderIds.length === 0 || tagIds.length === 0) {
    return NextResponse.json({ error: "senderIds and tagIds are required" }, { status: 400 });
  }

  // Look up workspace tokens for all senders
  const { data: senders } = await supabaseBg
    .from("email_performance")
    .select("sender_id, workspace_id")
    .in("sender_id", senderIds);

  if (!senders || senders.length === 0) {
    return NextResponse.json({ error: "No matching senders found" }, { status: 404 });
  }

  // Group by workspace
  const byWorkspace = new Map<string, string[]>();
  for (const s of senders) {
    const list = byWorkspace.get(s.workspace_id) ?? [];
    list.push(s.sender_id);
    byWorkspace.set(s.workspace_id, list);
  }

  // Get tokens
  const wsIds = [...byWorkspace.keys()];
  const { data: workspaces } = await supabaseBg
    .from("workspaces")
    .select("id, api_token")
    .in("id", wsIds);

  const tokenMap = new Map<string, string>();
  for (const ws of workspaces ?? []) {
    if (ws.api_token) tokenMap.set(ws.id, ws.api_token);
  }

  let updated = 0;

  // Call bulk tag endpoint per workspace
  for (const [wsId, ids] of byWorkspace) {
    const token = tokenMap.get(wsId);
    if (!token) continue;

    try {
      const res = await fetch(`${SEND_BASE}/sender-emails/tags/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sender_ids: ids, tag_ids: tagIds }),
      });

      if (res.ok) {
        updated += ids.length;
      } else {
        console.error(`[email-analyzer] add tags ws ${wsId}: ${res.status}`);
      }
    } catch (err) {
      console.error(`[email-analyzer] add tags ws ${wsId}:`, err);
    }
  }

  // Refresh tags in local DB for affected senders
  await refreshLocalTags(senderIds, byWorkspace, tokenMap);

  return NextResponse.json({ ok: true, updated });
}

/* ── DELETE — remove tags from selected emails (bulk) ────────────── */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { senderIds, tagIds } = await request.json();
  if (!Array.isArray(senderIds) || !Array.isArray(tagIds) || senderIds.length === 0 || tagIds.length === 0) {
    return NextResponse.json({ error: "senderIds and tagIds are required" }, { status: 400 });
  }

  const { data: senders } = await supabaseBg
    .from("email_performance")
    .select("sender_id, workspace_id")
    .in("sender_id", senderIds);

  if (!senders || senders.length === 0) {
    return NextResponse.json({ error: "No matching senders found" }, { status: 404 });
  }

  const byWorkspace = new Map<string, string[]>();
  for (const s of senders) {
    const list = byWorkspace.get(s.workspace_id) ?? [];
    list.push(s.sender_id);
    byWorkspace.set(s.workspace_id, list);
  }

  const wsIds = [...byWorkspace.keys()];
  const { data: workspaces } = await supabaseBg
    .from("workspaces")
    .select("id, api_token")
    .in("id", wsIds);

  const tokenMap = new Map<string, string>();
  for (const ws of workspaces ?? []) {
    if (ws.api_token) tokenMap.set(ws.id, ws.api_token);
  }

  let updated = 0;

  for (const [wsId, ids] of byWorkspace) {
    const token = tokenMap.get(wsId);
    if (!token) continue;

    try {
      const res = await fetch(`${SEND_BASE}/sender-emails/tags/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sender_ids: ids, tag_ids: tagIds }),
      });

      if (res.ok) {
        updated += ids.length;
      } else {
        console.error(`[email-analyzer] remove tags ws ${wsId}: ${res.status}`);
      }
    } catch (err) {
      console.error(`[email-analyzer] remove tags ws ${wsId}:`, err);
    }
  }

  await refreshLocalTags(senderIds, byWorkspace, tokenMap);

  return NextResponse.json({ ok: true, updated });
}

/* ── Refresh local tag data after mutation ───────────────────────── */
async function refreshLocalTags(
  senderIds: string[],
  byWorkspace: Map<string, string[]>,
  tokenMap: Map<string, string>
) {
  // For each workspace, re-fetch sender details to get updated tags
  for (const [wsId, ids] of byWorkspace) {
    const token = tokenMap.get(wsId);
    if (!token) continue;

    try {
      // Fetch current sender data to get updated tags
      for (const senderId of ids) {
        const res = await fetch(`${SEND_BASE}/sender-emails/${senderId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (res.ok) {
          const json = await res.json();
          const payload = Array.isArray(json) ? json[0] : json;
          const tags = payload?.tags ?? payload?.data?.tags ?? [];

          await supabaseBg
            .from("email_performance")
            .update({ tags })
            .eq("sender_id", senderId)
            .eq("workspace_id", wsId);
        }
      }
    } catch (err) {
      console.error(`[email-analyzer] refresh tags ws ${wsId}:`, err);
    }
  }
}
