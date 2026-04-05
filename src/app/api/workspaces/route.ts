import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseBg } from "@/lib/supabase-bg";

const SEND_BASE = "https://send.uparrowagency.com/api";

function sendHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.EMAILBISON_ADMIN_API_KEY}`,
  };
}

// In-memory state so the UI can poll progress
let syncState: {
  status: "idle" | "running" | "completed" | "failed";
  tokensCreated?: number;
  error?: string;
} = { status: "idle" };

/* ── GET — list workspaces from DB + current sync status ─────────── */
export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 5));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { count } = await supabaseBg
    .from("workspaces")
    .select("id", { count: "exact", head: true });

  const { data, error } = await supabaseBg
    .from("workspaces")
    .select("*")
    .order("name")
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  const workspaces = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    name: row.name,
    hasToken: !!row.api_token,
    enabled: row.enabled ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({
    workspaces,
    page,
    limit,
    totalCount,
    totalPages,
    syncStatus: syncState.status,
    tokensCreated: syncState.tokensCreated,
    error: syncState.error,
  });
}

/* ── PATCH — toggle workspace enabled ──────────────────────────── */
export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, enabled } = await req.json();
  if (!id || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Missing id or enabled" }, { status: 400 });
  }

  const { error } = await supabaseBg
    .from("workspaces")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/* ── POST — refresh workspaces from API & create missing tokens ── */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (syncState.status === "running") {
    return NextResponse.json({ error: "Refresh already in progress" }, { status: 409 });
  }

  syncState = { status: "running" };

  // Fire-and-forget
  refreshWorkspaces()
    .then((tokensCreated) => {
      syncState = { status: "completed", tokensCreated };
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[workspaces] refresh error:", message);
      syncState = { status: "failed", error: message };
    });

  return NextResponse.json({ ok: true, status: "started" });
}

/* ── Background work ─────────────────────────────────────────────── */
async function refreshWorkspaces(): Promise<number> {
  // 1. Fetch all workspaces from Instantly API
  const res = await fetch(`${SEND_BASE}/workspaces/v1.1`, {
    headers: sendHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workspaces: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const apiWorkspaces: { id: number; name: string }[] = json.data;

  // 2. Upsert workspaces into DB (preserve existing api_token)
  for (const ws of apiWorkspaces) {
    // Try insert first; on conflict just update name
    await supabaseBg.from("workspaces").upsert(
      { id: String(ws.id), name: ws.name, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  }

  // 3. Find workspaces without a token
  const { data: missing } = await supabaseBg
    .from("workspaces")
    .select("id")
    .is("api_token", null);

  let tokensCreated = 0;

  for (const ws of missing ?? []) {
    try {
      const tokenRes = await fetch(
        `${SEND_BASE}/workspaces/v1.1/${ws.id}/api-tokens`,
        {
          method: "POST",
          headers: sendHeaders(),
          body: JSON.stringify({ name: "Sales Dashboard token" }),
        }
      );

      if (!tokenRes.ok) {
        console.error(`[workspaces] failed to create token for ${ws.id}: ${tokenRes.status}`);
        continue;
      }

      const tokenJson = await tokenRes.json();
      const tokenData = tokenJson.data ?? tokenJson;
      const token = tokenData.plain_text_token ?? tokenData.token ?? tokenData.api_token ?? tokenData.key;

      if (token) {
        await supabaseBg
          .from("workspaces")
          .update({ api_token: token, updated_at: new Date().toISOString() })
          .eq("id", ws.id);
        tokensCreated++;
      } else {
        console.warn(`[workspaces] token response for ${ws.id} had no recognizable token field:`, tokenData);
      }
    } catch (err) {
      console.error(`[workspaces] error creating token for ${ws.id}:`, err);
    }
  }

  return tokensCreated;
}
