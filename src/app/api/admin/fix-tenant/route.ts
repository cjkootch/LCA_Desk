import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { tenants, jurisdictions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, plan, jurisdiction, secret } = body;
    const demoSecret = process.env.DEMO_SEED_SECRET;
    if (!demoSecret || secret !== demoSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = { isDemo: false };

    if (plan) {
      updates.plan = plan;
      updates.planEntityLimit = -1;
      updates.stripeSubscriptionId = "admin_internal";
      updates.stripeSubscriptionStatus = "active";
      updates.trialEndsAt = null;
    }

    if (jurisdiction) {
      const [j] = await db.select({ id: jurisdictions.id }).from(jurisdictions)
        .where(eq(jurisdictions.code, jurisdiction)).limit(1);
      if (j) updates.jurisdictionId = j.id;
    }

    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    return NextResponse.json({ success: true, updated: Object.keys(updates) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
