import { NextRequest, NextResponse } from "next/server";
import { aggregateCompanyProfiles } from "@/server/actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await aggregateCompanyProfiles();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Profile aggregation failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
