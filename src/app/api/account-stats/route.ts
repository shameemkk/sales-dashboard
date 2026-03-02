import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ids = searchParams.get("ids");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!ids || !startDate || !endDate) {
    return NextResponse.json(
      { error: "ids, start_date, end_date are required" },
      { status: 400 }
    );
  }

  const senderIds = ids.split(",");

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("account_daily_stats")
    .select("sender_id, stat_date, sent, replied, total_opens, unique_opens, unsubscribed, bounced, interested")
    .in("sender_id", senderIds)
    .gte("stat_date", startDate)
    .lte("stat_date", endDate)
    .order("stat_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
