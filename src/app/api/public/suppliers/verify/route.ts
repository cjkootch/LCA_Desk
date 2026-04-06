import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { lcsRegister } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { cert_id } = await req.json();

    if (!cert_id) {
      return NextResponse.json({ error: "cert_id required" }, { status: 400 });
    }

    const normalizedId = cert_id.toUpperCase().startsWith("LCSR-") ? cert_id : `LCSR-${cert_id}`;

    const [result] = await db
      .select()
      .from(lcsRegister)
      .where(eq(lcsRegister.certId, normalizedId))
      .limit(1);

    if (!result) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      status: result.status,
      company_name: result.legalName,
      trading_name: result.tradingName,
      expiry_date: result.expirationDate,
      service_categories: result.serviceCategories,
      address: result.address,
    });
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
