import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const today = new Date();
  const startDate = format(today, "yyyy-MM-dd");
  const endDate = format(today, "yyyy-MM-dd");

  const url = new URL(
    `https://send.uparrowagency.com/api/warmup/sender-emails/${id}`
  );
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

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
  return NextResponse.json(json);
}
