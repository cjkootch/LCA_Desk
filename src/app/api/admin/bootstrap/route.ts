import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password, name, secret } = await req.json();

  const demoSecret = process.env.DEMO_SEED_SECRET;
  if (!demoSecret || secret !== demoSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Check if already exists
  const [existing] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);

  if (existing) {
    // Update password + ensure super admin
    const hash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash: hash, isSuperAdmin: true }).where(eq(users.id, existing.id));
    return NextResponse.json({ success: true, message: `Updated ${email} — password reset + super admin enabled` });
  }

  // Create new super admin
  const hash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({
    email,
    name: name || "Admin",
    passwordHash: hash,
    userRole: "filer",
    isSuperAdmin: true,
  }).returning();

  return NextResponse.json({ success: true, message: `Created super admin ${email}`, userId: user.id });
}
