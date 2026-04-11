import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { userEvents } from "@/server/db/schema";
import { headers } from "next/headers";

/**
 * Returns credentials for the default demo entry point (filer-pro).
 * Role selection happens on /demo/select after initial login.
 * NEXT_PUBLIC_DEMO_PASSWORD acts as a feature flag — if unset, demo is disabled.
 */
export async function GET() {
  if (!process.env.NEXT_PUBLIC_DEMO_PASSWORD) {
    return NextResponse.json({ error: "Demo not configured" }, { status: 404 });
  }

  // Log demo access with IP — never block on failure
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headersList.get("x-real-ip")
      || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await db.insert(userEvents).values({
      userId: "00000000-0000-0000-0000-000000000000",
      tenantId: "00000000-0000-0000-0000-000000000000",
      eventName: "demo_login_requested",
      properties: { ip, userAgent, timestamp: new Date().toISOString() },
    });
  } catch {}

  return NextResponse.json({
    email: "demo-filer-pro@lcadesk.com",
    password: "demo-password-2026",
  });
}

// Keep POST for backward compatibility
export async function POST() {
  if (!process.env.NEXT_PUBLIC_DEMO_PASSWORD) {
    return NextResponse.json({ error: "Demo not configured" }, { status: 404 });
  }

  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headersList.get("x-real-ip")
      || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await db.insert(userEvents).values({
      userId: "00000000-0000-0000-0000-000000000000",
      tenantId: "00000000-0000-0000-0000-000000000000",
      eventName: "demo_login_requested",
      properties: { ip, userAgent, timestamp: new Date().toISOString() },
    });
  } catch {}

  return NextResponse.json({
    email: "demo-filer-pro@lcadesk.com",
    password: "demo-password-2026",
  });
}
