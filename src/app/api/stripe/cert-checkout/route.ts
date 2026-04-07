import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { lcsCertApplications } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const TIER_PRICES: Record<string, number> = {
  self_service: 4900, // $49 in cents
  managed: 9900,      // $99
  concierge: 19900,   // $199
};

const TIER_NAMES: Record<string, string> = {
  self_service: "LCS Registration — Self-Service",
  managed: "LCS Registration — Managed",
  concierge: "LCS Registration — Concierge",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { applicationId, tier } = await req.json();
  if (!applicationId || !tier || !TIER_PRICES[tier]) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify the application belongs to this user
  const [app] = await db.select({ id: lcsCertApplications.id, status: lcsCertApplications.status })
    .from(lcsCertApplications)
    .where(and(eq(lcsCertApplications.id, applicationId), eq(lcsCertApplications.userId, session.user.id)))
    .limit(1);

  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: TIER_NAMES[tier] || "LCS Registration" },
          unit_amount: TIER_PRICES[tier],
        },
        quantity: 1,
      }],
      metadata: {
        applicationId,
        userId: session.user.id,
        tier,
        type: "lcs_cert_application",
      },
      success_url: `${appUrl}/register-lcs/success?app=${applicationId}`,
      cancel_url: `${appUrl}/register-lcs?step=3`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe cert checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
