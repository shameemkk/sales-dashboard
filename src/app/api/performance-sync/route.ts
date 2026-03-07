import { NextRequest, NextResponse } from "next/server";
import { runPerformanceSync } from "@/lib/performance-sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const today = new Date().toISOString().slice(0, 10);
  const startDate: string = body.start_date ?? body.date ?? today;
  const endDate: string = body.end_date ?? startDate;

  try {
    const rows = await runPerformanceSync(startDate, endDate);
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[performance-sync] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
