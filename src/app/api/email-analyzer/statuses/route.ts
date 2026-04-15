import { NextResponse } from "next/server";
import { supabaseBg } from "@/lib/supabase-bg";

export async function GET() {
  const { data, error } = await supabaseBg
    .from("email_performance")
    .select("status")
    .not("status", "is", null)
    .order("status", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate
  const seen = new Set<string>();
  const statuses: string[] = [];
  for (const row of data ?? []) {
    const val = row.status;
    if (val && !seen.has(val)) {
      seen.add(val);
      statuses.push(val);
    }
  }

  return NextResponse.json({ data: statuses });
}
