import { NextResponse } from "next/server";

/**
 * Returns credentials for the default demo entry point (filer-pro).
 * Role selection happens on /demo/select after initial login.
 * NEXT_PUBLIC_DEMO_PASSWORD acts as a feature flag — if unset, demo is disabled.
 */
export async function GET() {
  if (!process.env.NEXT_PUBLIC_DEMO_PASSWORD) {
    return NextResponse.json({ error: "Demo not configured" }, { status: 404 });
  }
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
  return NextResponse.json({
    email: "demo-filer-pro@lcadesk.com",
    password: "demo-password-2026",
  });
}
