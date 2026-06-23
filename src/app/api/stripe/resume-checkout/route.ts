import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { userPurchases } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const RESUME_PRICE_ID = process.env.STRIPE_RESUME_PRICE_ID || "price_1TlaC4FwVjbpJ19NL0IJ3ZpY";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if already purchased
  const [existing] = await db.select({ id: userPurchases.id })
    .from(userPurchases)
    .where(and(
      eq(userPurchases.userId, session.user.id),
      eq(userPurchases.productId, "resume_builder"),
    ))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Already purchased" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lcadesk.com";

  try {
    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price: RESUME_PRICE_ID,
        quantity: 1,
      }],
      metadata: {
        userId: session.user.id,
        type: "resume_builder",
      },
      customer_email: session.user.email || undefined,
      success_url: `${appUrl}/seeker/resume?unlocked=1`,
      cancel_url: `${appUrl}/seeker/resume`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
