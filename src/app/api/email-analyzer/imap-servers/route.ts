import { NextResponse } from "next/server";
import { supabaseBg } from "@/lib/supabase-bg";

export async function GET() {
  const { data, error } = await supabaseBg
    .from("email_performance")
    .select("imap_server")
    .not("imap_server", "is", null)
    .order("imap_server", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate
  const seen = new Set<string>();
  const servers: string[] = [];
  for (const row of data ?? []) {
    const val = row.imap_server;
    if (val && !seen.has(val)) {
      seen.add(val);
      servers.push(val);
    }
  }

  return NextResponse.json({ data: servers });
}
