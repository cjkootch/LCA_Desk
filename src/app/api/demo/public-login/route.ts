import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns demo credentials when NEXT_PUBLIC_DEMO_PASSWORD is set.
 * The demo user must exist in the DB with isDemo=true.
 *
 * GET /api/demo/public-login?role=filer       → demo filer user
 * GET /api/demo/public-login?role=secretariat → demo secretariat user
 * GET /api/demo/public-login?role=seeker      → demo job seeker user
 */
export async function GET(request: NextRequest) {
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!demoPassword) {
    return NextResponse.json({ error: "Demo not available" }, { status: 404 });
  }

  const roleParam = request.nextUrl.searchParams.get("role") ?? "filer";
  const userRoleMap: Record<string, string> = {
    filer: "filer",
    secretariat: "secretariat",
    seeker: "job_seeker",
  };
  const userRole = userRoleMap[roleParam] ?? "filer";

  const [demoUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.isDemo, true), eq(users.userRole, userRole)))
    .limit(1);

  if (!demoUser) {
    return NextResponse.json({ error: "Demo user not configured" }, { status: 503 });
  }

  return NextResponse.json({
    email: demoUser.email,
    password: demoPassword,
  });
}

// Keep POST for backward compatibility with existing callers
export async function POST() {
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!demoPassword) {
    return NextResponse.json({ error: "Demo not available" }, { status: 404 });
  }

  const [demoUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.isDemo, true), eq(users.userRole, "filer")))
    .limit(1);

  if (!demoUser) {
    return NextResponse.json({ error: "Demo user not configured" }, { status: 503 });
  }

  return NextResponse.json({
    email: demoUser.email,
    password: demoPassword,
  });
}
