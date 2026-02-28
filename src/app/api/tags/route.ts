import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch("https://send.uparrowagency.com/api/tags", {
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
