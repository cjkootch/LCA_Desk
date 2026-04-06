import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { tenants } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getPlanFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID) return "enterprise";
  if (priceId === process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID) return "enterprise";
  if (priceId === process.env.STRIPE_LITE_MONTHLY_PRICE_ID) return "lite";
  if (priceId === process.env.STRIPE_LITE_ANNUAL_PRICE_ID) return "lite";
  return "lite";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = session.metadata?.plan;

      if (tenantId && plan) {
        await db
          .update(tenants)
          .set({
            plan,
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            trialEndsAt: null, // Clear trial — they've paid
          })
          .where(eq(tenants.id, tenantId));
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : "lite";

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId))
        .limit(1);

      if (tenant && (subscription.status === "active" || subscription.status === "trialing")) {
        await db
          .update(tenants)
          .set({ plan, stripeSubscriptionId: subscription.id, stripePriceId: priceId || null })
          .where(eq(tenants.id, tenant.id));
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      console.error(`Payment failed for customer ${customerId}`);
      // Don't downgrade immediately — Stripe retries. Just log.
      // After final retry fails, subscription.deleted fires.
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId))
        .limit(1);

      if (tenant) {
        await db
          .update(tenants)
          .set({ plan: "free", stripeSubscriptionId: null, stripePriceId: null })
          .where(eq(tenants.id, tenant.id));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
