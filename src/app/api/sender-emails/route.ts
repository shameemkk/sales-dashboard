import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = searchParams.get("page") ?? "1";
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  const tagIds = searchParams.getAll("tag_ids[]");
  const excludedTagIds = searchParams.getAll("excluded_tag_ids[]");
  const withoutTags = searchParams.get("without_tags");

  const url = new URL("https://send.uparrowagency.com/api/sender-emails");
  url.searchParams.set("page", page);
  if (search) url.searchParams.set("search", search);
  if (status) url.searchParams.set("status", status);
  tagIds.forEach((id) => url.searchParams.append("tag_ids[]", id));
  excludedTagIds.forEach((id) => url.searchParams.append("excluded_tag_ids[]", id));
  if (withoutTags === "true") url.searchParams.set("without_tags", "1");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.SEND_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream error: ${res.status}` },
      { status: res.status }
    );
  }

  const json = await res.json();
  // API wraps response in an outer array — unwrap it
  const payload = Array.isArray(json) ? json[0] : json;
  return NextResponse.json(payload);
}
