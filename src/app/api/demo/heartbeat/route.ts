import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { userEvents } from "@/server/db/schema";
import { headers } from "next/headers";

/**
 * Heartbeat endpoint for anonymous demo visitors — called every 30s
 * from the /try and /demo/select pages. Used by the PLG dashboard
 * to determine if a visitor is still on site and their time on site.
 */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headersList.get("x-real-ip")
      || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    let page: string | undefined;
    try {
      const body = await req.json();
      page = typeof body?.page === "string" ? body.page : undefined;
    } catch {
      // no body is fine
    }

    await db.insert(userEvents).values({
      userId: "00000000-0000-0000-0000-000000000000",
      tenantId: "00000000-0000-0000-0000-000000000000",
      eventName: "demo_heartbeat",
      properties: { ip, userAgent, page, timestamp: new Date().toISOString() },
    });
  } catch {
    // never fail the ping
  }

  return NextResponse.json({ ok: true });
}
