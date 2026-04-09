import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { tenants, tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get tenant
  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: true },
  });

  if (!membership?.tenant) {
    return NextResponse.json({ error: "No tenant found" }, { status: 400 });
  }

  const tenant = membership.tenant;

  // Already has an active subscription — no need for trial checkout
  if (tenant.stripeSubscriptionId && tenant.stripeSubscriptionStatus !== "canceled") {
    return NextResponse.json({ error: "Already has subscription" }, { status: 400 });
  }

  // Get or create Stripe customer
  let customerId = tenant.stripeCustomerId;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: session.user.email || undefined,
      name: tenant.name,
      metadata: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    });
    customerId = customer.id;

    await db
      .update(tenants)
      .set({ stripeCustomerId: customerId })
      .where(eq(tenants.id, tenant.id));
  }

  // Default to lite (Essentials) plan for trial
  const priceId = process.env.STRIPE_LITE_MONTHLY_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Price not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lcadesk.com";

  // Create checkout session with 30-day trial
  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_collection: "always",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        tenantId: tenant.id,
        plan: "lite",
      },
    },
    success_url: `${appUrl}/dashboard?activated=true`,
    cancel_url: `${appUrl}/dashboard/activate?canceled=true`,
    metadata: {
      tenantId: tenant.id,
      plan: "lite",
      billing: "monthly",
      type: "trial_activation",
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
