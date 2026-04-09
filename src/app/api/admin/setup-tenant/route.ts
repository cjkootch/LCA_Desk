import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { email, companyName, plan, secret } = await req.json();

  const demoSecret = process.env.DEMO_SEED_SECRET;
  if (!demoSecret || secret !== demoSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check if already has a tenant
  const [existing] = await db.select({ id: tenantMembers.id }).from(tenantMembers)
    .where(eq(tenantMembers.userId, user.id)).limit(1);
  if (existing) return NextResponse.json({ error: "User already has a tenant", tenantMemberId: existing.id });

  const [gy] = await db.select({ id: jurisdictions.id }).from(jurisdictions)
    .where(eq(jurisdictions.code, "GY")).limit(1);

  const slug = (companyName || "admin")
    .toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");

  const [tenant] = await db.insert(tenants).values({
    name: companyName || "LCA Desk Admin",
    slug,
    jurisdictionId: gy?.id,
    plan: plan || "enterprise",
    planEntityLimit: -1,
    stripeSubscriptionId: "admin_internal",
    stripeSubscriptionStatus: "active",
  }).returning();

  await db.insert(tenantMembers).values({
    tenantId: tenant.id, userId: user.id, role: "owner",
  });

  return NextResponse.json({ success: true, tenantId: tenant.id, tenantName: tenant.name });
}
