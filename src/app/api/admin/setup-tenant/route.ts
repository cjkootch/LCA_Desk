import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { email, companyName, plan, secret } = await req.json();

    const demoSecret = process.env.DEMO_SEED_SECRET;
    if (!demoSecret || secret !== demoSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const [user] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, email)).limit(1);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check if already has a tenant
    const [existing] = await db.select({ id: tenantMembers.id, tenantId: tenantMembers.tenantId })
      .from(tenantMembers).where(eq(tenantMembers.userId, user.id)).limit(1);
    if (existing) {
      return NextResponse.json({ message: "User already has a tenant", tenantId: existing.tenantId, success: true });
    }

    let jurisdictionId = null;
    try {
      const [gy] = await db.select({ id: jurisdictions.id }).from(jurisdictions)
        .where(eq(jurisdictions.code, "GY")).limit(1);
      jurisdictionId = gy?.id || null;
    } catch { /* jurisdictions table might not exist */ }

    const slug = (companyName || "admin")
      .toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");

    // Check if tenant with this slug already exists
    const [existingTenant] = await db.select({ id: tenants.id }).from(tenants)
      .where(eq(tenants.slug, slug)).limit(1);

    let tenant;
    if (existingTenant) {
      // Use existing tenant
      tenant = existingTenant;
    } else {
      const [newTenant] = await db.insert(tenants).values({
        name: companyName || "LCA Desk Admin",
        slug,
        jurisdictionId,
        plan: plan || "enterprise",
        planEntityLimit: -1,
        stripeSubscriptionId: "admin_internal",
        stripeSubscriptionStatus: "active",
      }).returning();
      tenant = newTenant;
    }

    await db.insert(tenantMembers).values({
      tenantId: tenant.id, userId: user.id, role: "owner",
    });

    return NextResponse.json({ success: true, tenantId: tenant.id, tenantName: companyName || "LCA Desk Admin" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
