import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { userPurchases } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const REPORT_PRICE_ID = process.env.STRIPE_REPORT_PRICE_ID || "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { periodId, entityId } = await req.json();
  if (!periodId || !entityId) {
    return NextResponse.json({ error: "periodId and entityId required" }, { status: 400 });
  }

  // Check if already purchased for this period
  const productId = `report_export:${periodId}`;
  const [existing] = await db.select({ id: userPurchases.id })
    .from(userPurchases)
    .where(and(
      eq(userPurchases.userId, session.user.id),
      eq(userPurchases.productId, productId),
    ))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Already purchased", alreadyPurchased: true }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lcadesk.com";

  try {
    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        REPORT_PRICE_ID
          ? { price: REPORT_PRICE_ID, quantity: 1 }
          : {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Single Report Export & Submit",
                  description: "Export your compliance report files (Excel + PDF + Notice) and submit to the Secretariat. One-time payment for this reporting period.",
                },
                unit_amount: 2900,
              },
              quantity: 1,
            },
      ],
      metadata: {
        userId: session.user.id,
        type: "report_export",
        periodId,
        entityId,
      },
      customer_email: session.user.email || undefined,
      success_url: `${appUrl}/dashboard/entities/${entityId}/periods/${periodId}/export?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/entities/${entityId}/periods/${periodId}/export`,
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
