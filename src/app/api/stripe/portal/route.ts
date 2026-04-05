import Stripe from "stripe";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: true },
  });

  if (!membership?.tenant?.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lcadesk.com";

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: membership.tenant.stripeCustomerId,
    return_url: `${appUrl}/dashboard/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
