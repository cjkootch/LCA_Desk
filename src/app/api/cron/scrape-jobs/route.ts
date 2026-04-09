import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("LCS jobs scrape triggered at", new Date().toISOString());

  return NextResponse.json({
    ok: true,
    message: "Jobs scrape triggered",
    timestamp: new Date().toISOString(),
  });
}
