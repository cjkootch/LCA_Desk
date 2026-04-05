import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron, not a random user
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("LCS scrape cron triggered at", new Date().toISOString());

  return NextResponse.json({
    ok: true,
    message: "Scrape triggered — run npm run scrape:lcs on a dedicated machine for full scrape",
    timestamp: new Date().toISOString(),
  });
}
