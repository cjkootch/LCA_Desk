import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { supplierProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify supplier profile exists
  const [profile] = await db.select({ id: supplierProfiles.id })
    .from(supplierProfiles)
    .where(eq(supplierProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "No supplier profile found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const priceId = process.env.STRIPE_SUPPLIER_PRO_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: "Supplier Pro pricing not configured" }, { status: 500 });
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        type: "supplier_pro",
        supplierId: profile.id,
        userId: session.user.id,
      },
      success_url: `${appUrl}/supplier-portal/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/supplier-portal/settings`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Supplier checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
