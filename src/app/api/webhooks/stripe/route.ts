import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Stripe webhook placeholder — to be implemented with billing
  const body = await req.text();
  console.log("Stripe webhook received:", body.substring(0, 100));

  return NextResponse.json({ received: true });
}
