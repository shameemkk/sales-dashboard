import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Returns a sorted array of distinct tag strings across all leads.
// Fetches only the tags column so the payload stays small.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("leads").select("tags");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const distinct = Array.from(
    new Set((data ?? []).flatMap((r) => (Array.isArray(r.tags) ? r.tags as string[] : [])))
  ).sort();

  return NextResponse.json(distinct);
}
