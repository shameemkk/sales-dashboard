import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const PAGE_SIZE = 15;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const tagIds = searchParams.getAll("tag_ids[]").map(Number).filter(Boolean);
  const excludedTagIds = searchParams.getAll("excluded_tag_ids[]").map(Number).filter(Boolean);
  const withoutTags = searchParams.get("without_tags") === "true";

  const supabase = await createSupabaseServerClient();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("sender_accounts")
    .select("*", { count: "exact" })
    .order("id", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  if (status === "connected") {
    query = query.eq("status", "Connected");
  } else if (status === "not_connected") {
    query = query.neq("status", "Connected");
  }

  if (withoutTags) {
    query = query.eq("tags", "[]");
  } else if (tagIds.length > 0) {
    // Filter accounts containing any of the specified tag IDs using jsonb @> operator
    const tagFilters = tagIds.map((id) => `tags.cs.[{"id":${id}}]`).join(",");
    query = query.or(tagFilters);
  } else if (excludedTagIds.length > 0) {
    // Exclude accounts containing any of the specified tag IDs
    for (const id of excludedTagIds) {
      query = query.not("tags", "cs", `[{"id":${id}}]`);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return NextResponse.json({
    data: data ?? [],
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: PAGE_SIZE,
      total,
      from: from + 1,
      to: Math.min(to + 1, total),
    },
  });
}
