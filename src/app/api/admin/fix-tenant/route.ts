import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { tenants } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, plan, secret } = await req.json();
    const demoSecret = process.env.DEMO_SEED_SECRET;
    if (!demoSecret || secret !== demoSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.update(tenants).set({
      plan: plan || "enterprise",
      planEntityLimit: -1,
      isDemo: false,
      stripeSubscriptionId: "admin_internal",
      stripeSubscriptionStatus: "active",
      trialEndsAt: null,
    }).where(eq(tenants.id, tenantId));

    return NextResponse.json({ success: true, message: "Tenant updated to enterprise, isDemo=false, active subscription" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
