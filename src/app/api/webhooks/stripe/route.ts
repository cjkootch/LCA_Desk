import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { tenants, lcsCertApplications, supplierProfiles, tenantMembers, users } from "@/server/db/schema";
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

    // ── Payment succeeded — subscription activated ──────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // LCS Certificate application payment
      if (session.metadata?.type === "lcs_cert_application") {
        const applicationId = session.metadata.applicationId;
        const tier = session.metadata.tier;
        const tierPrices: Record<string, number> = { self_service: 4900, managed: 9900, concierge: 19900 };
        if (applicationId) {
          await db.update(lcsCertApplications).set({
            stripePaymentId: session.id,
            amountPaid: tierPrices[tier] || (session.amount_total ?? 0),
            paidAt: new Date(),
            status: "under_review",
            updatedAt: new Date(),
          }).where(eq(lcsCertApplications.id, applicationId));

          // Sync cert applicant to HubSpot
          try {
            const [app] = await db.select({ email: lcsCertApplications.applicantEmail, name: lcsCertApplications.applicantName, company: lcsCertApplications.legalName })
              .from(lcsCertApplications).where(eq(lcsCertApplications.id, applicationId)).limit(1);
            if (app?.email) {
              const { upsertHubspotContact } = await import("@/lib/hubspot-sync");
              await upsertHubspotContact({
                email: app.email,
                companyName: app.company || app.name || "Unknown",
                country: "GY",
                registrationStatus: `lcs_cert_${tier}`,
              });
            }
          } catch {}
        }
        break;
      }

      // Supplier Pro checkout
      if (session.metadata?.type === "supplier_pro") {
        const supplierId = session.metadata.supplierId;
        if (supplierId) {
          await db.update(supplierProfiles).set({
            tier: "pro",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          }).where(eq(supplierProfiles.id, supplierId));
        }
        break;
      }

      // Standard subscription checkout
      const tenantId = session.metadata?.tenantId;
      const plan = session.metadata?.plan;
      if (tenantId && plan) {
        await db.update(tenants).set({
          plan,
          stripeSubscriptionId: session.subscription as string,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionStatus: "active",
          trialEndsAt: null,
        }).where(eq(tenants.id, tenantId));

        // Sync payment to HubSpot
        try {
          const [owner] = await db.select({ email: users.email }).from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenantId)).limit(1);
          if (owner?.email) {
            const { syncPayment } = await import("@/lib/hubspot-sync");
            await syncPayment(owner.email, plan, session.customer as string);
          }
        } catch {}
      }
      break;
    }

    // ── Subscription state changed ──────────────────────────────
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = priceId ? getPlanFromPriceId(priceId) : "lite";

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId)).limit(1);

      if (tenant) {
        await db.update(tenants).set({
          plan,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || null,
          stripeSubscriptionStatus: subscription.status,
          trialEndsAt: null,
        }).where(eq(tenants.id, tenant.id));
      }
      break;
    }

    // ── Payment failed — Stripe will retry ──────────────────────
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string;

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId)).limit(1);

      if (tenant) {
        let status = "past_due";
        try {
          const sub = await getStripe().subscriptions.retrieve(subscriptionId);
          status = sub.status;
        } catch { /* use default */ }

        await db.update(tenants).set({
          stripeSubscriptionStatus: status,
        }).where(eq(tenants.id, tenant.id));

        // Sync to HubSpot
        try {
          const [owner] = await db.select({ email: users.email }).from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenant.id)).limit(1);
          if (owner?.email) {
            const { syncPaymentFailed } = await import("@/lib/hubspot-sync");
            await syncPaymentFailed(owner.email);
          }
        } catch {}

        console.error(
          `Payment failed for tenant ${tenant.id} (${tenant.name}), ` +
          `customer ${customerId}, attempt ${invoice.attempt_count}. Status: ${status}`
        );
      }
      break;
    }

    // ── Invoice paid — clears past_due on successful retry ──────
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId)).limit(1);

      if (tenant) {
        await db.update(tenants).set({
          stripeSubscriptionStatus: "active",
        }).where(eq(tenants.id, tenant.id));
      }
      break;
    }

    // ── Subscription deleted — all retries exhausted ────────────
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId)).limit(1);

      if (tenant) {
        await db.update(tenants).set({
          stripeSubscriptionStatus: "canceled",
          stripeSubscriptionId: null,
          stripePriceId: null,
        }).where(eq(tenants.id, tenant.id));

        // Sync churn to HubSpot
        try {
          const [owner] = await db.select({ email: users.email }).from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenant.id)).limit(1);
          if (owner?.email) {
            const { syncChurn } = await import("@/lib/hubspot-sync");
            await syncChurn(owner.email);
          }
        } catch {}

        console.error(`Subscription canceled for tenant ${tenant.id} (${tenant.name})`);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
