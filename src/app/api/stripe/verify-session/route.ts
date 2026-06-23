import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { userPurchases } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

/**
 * Verify a Stripe Checkout session immediately after redirect and write
 * the purchase row idempotently. This removes the dependency on webhook
 * timing — the webhook still fires as a backup, but the user's unlock no
 * longer races against it.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const checkout = await getStripe().checkout.sessions.retrieve(sessionId);

    // Must be paid and belong to this user
    if (checkout.payment_status !== "paid") {
      return NextResponse.json({ paid: false, error: "Payment not completed" }, { status: 402 });
    }
    if (checkout.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const type = checkout.metadata?.type;
    let productId: string | null = null;
    let defaultCents = 0;

    if (type === "resume_builder") {
      productId = "resume_builder";
      defaultCents = 1500;
    } else if (type === "report_export") {
      const periodId = checkout.metadata?.periodId;
      if (periodId) {
        productId = `report_export:${periodId}`;
        defaultCents = 2900;
      }
    }

    if (!productId) {
      return NextResponse.json({ error: "Unknown product type" }, { status: 400 });
    }

    // Idempotent insert — only if not already recorded
    const [existing] = await db.select({ id: userPurchases.id })
      .from(userPurchases)
      .where(and(
        eq(userPurchases.userId, session.user.id),
        eq(userPurchases.productId, productId),
      ))
      .limit(1);

    if (!existing) {
      await db.insert(userPurchases).values({
        userId: session.user.id,
        productId,
        stripeSessionId: checkout.id,
        stripePaymentIntentId: (checkout.payment_intent as string) || null,
        amountCents: checkout.amount_total ?? defaultCents,
        currency: checkout.currency || "usd",
        paidAt: new Date(),
      });
    }

    return NextResponse.json({ paid: true, productId });
  } catch (error) {
    console.error("Verify session error:", error);
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 });
  }
}
