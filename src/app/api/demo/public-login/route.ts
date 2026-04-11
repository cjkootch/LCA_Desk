import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Returns demo credentials when NEXT_PUBLIC_DEMO_PASSWORD is set.
 * The demo user must exist in the DB with isDemo=true.
 * Used by /try to auto-log in as the demo filer-pro user.
 */
export async function POST() {
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!demoPassword) {
    return NextResponse.json({ error: "Demo not available" }, { status: 404 });
  }

  // Find the demo filer user
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
