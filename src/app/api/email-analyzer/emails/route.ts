import { NextRequest, NextResponse } from "next/server";
import { supabaseBg } from "@/lib/supabase-bg";
import {
  EMAIL_COLUMNS,
  parseFiltersFromParams,
} from "@/lib/email-analyzer-filters";
import { applyFiltersToQuery } from "@/lib/email-analyzer-server-filters";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 25));
  const sortBy = searchParams.get("sort_by") || "email";
  const sortDir = searchParams.get("sort_dir") === "desc" ? false : true; // ascending by default
  const workspaceId = searchParams.get("workspace_id") || "";
  const search = searchParams.get("search") || "";
  const tagIds = searchParams.getAll("tag_ids[]");

  // Advanced filters (conditional AND/OR across any column)
  const parsedFilters = parseFiltersFromParams(searchParams, EMAIL_COLUMNS);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Count query
  let countQuery = supabaseBg
    .from("email_performance")
    .select("id", { count: "exact", head: true });

  if (workspaceId) countQuery = countQuery.eq("workspace_id", workspaceId);
  if (search) countQuery = countQuery.ilike("email", `%${search}%`);
  if (tagIds.length > 0) {
    // Filter emails that contain ANY of the specified tag IDs
    for (const tagId of tagIds) {
      countQuery = countQuery.contains("tags", [{ id: Number(tagId) }]);
    }
  }
  countQuery = applyFiltersToQuery(countQuery, parsedFilters, EMAIL_COLUMNS);

  const { count } = await countQuery;
  const total = count ?? 0;

  // Data query
  let query = supabaseBg
    .from("email_performance")
    .select("*");

  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  if (search) query = query.ilike("email", `%${search}%`);
  if (tagIds.length > 0) {
    for (const tagId of tagIds) {
      query = query.contains("tags", [{ id: Number(tagId) }]);
    }
  }
  query = applyFiltersToQuery(query, parsedFilters, EMAIL_COLUMNS);

  // Sorting
  const validSortFields = ["email", "domain", "imap_server", "warmup_score", "reply_rate", "bounce_rate", "total_sent", "total_replies"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "email";
  query = query.order(sortField, { ascending: sortDir });

  query = query.range(from, to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lastPage = Math.max(1, Math.ceil(total / limit));

  // Map DB rows to camelCase response
  const emails = (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    senderId: row.sender_id,
    email: row.email,
    domain: row.domain,
    imapServer: row.imap_server ?? null,
    totalSent: row.total_sent,
    totalReplies: row.total_replies,
    replyRate: Number(row.reply_rate),
    totalBounced: row.total_bounced,
    bounceRate: Number(row.bounce_rate),
    warmupScore: Number(row.warmup_score),
    tags: row.tags ?? [],
    status: row.status,
    syncedAt: row.synced_at,
  }));

  return NextResponse.json({
    data: emails,
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: limit,
      total,
    },
  });
}
