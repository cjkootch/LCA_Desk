import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { tenants, tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Stripe Price IDs — create these in your Stripe Dashboard
const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
  },
  enterprise: {
    monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || "",
    annual: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID || "",
  },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { plan, billing } = await req.json();

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PRICE_IDS[plan][billing === "annual" ? "annual" : "monthly"];
  if (!priceId) {
    return NextResponse.json({ error: "Price not configured" }, { status: 400 });
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lcadesk.com";

  // Create checkout session
  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${appUrl}/dashboard/settings/billing?canceled=true`,
    metadata: {
      tenantId: tenant.id,
      plan,
      billing,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
