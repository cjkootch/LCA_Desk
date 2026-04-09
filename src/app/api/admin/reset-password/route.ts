import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, newPassword, secret } = await req.json();

  // Protected by demo seed secret
  const demoSecret = process.env.DEMO_SEED_SECRET;
  if (!demoSecret || secret !== demoSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!email || !newPassword) {
    return NextResponse.json({ error: "Email and newPassword required" }, { status: 400 });
  }

  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));

  return NextResponse.json({ success: true, message: `Password updated for ${email}` });
}
