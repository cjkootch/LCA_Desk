import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { lcsRegister } from "@/server/db/schema";
import { eq, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const certId = searchParams.get("cert_id");
  const query = searchParams.get("q");

  if (certId) {
    // Exact cert ID lookup
    const [result] = await db
      .select()
      .from(lcsRegister)
      .where(eq(lcsRegister.certId, certId.toUpperCase().startsWith("LCSR-") ? certId : `LCSR-${certId}`))
      .limit(1);

    if (!result) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      company: {
        certId: result.certId,
        legalName: result.legalName,
        tradingName: result.tradingName,
        status: result.status,
        expirationDate: result.expirationDate,
        address: result.address,
        email: result.email,
        phone: result.phone,
        serviceCategories: result.serviceCategories,
      },
    });
  }

  if (query && query.length >= 2) {
    // Search by company name
    const results = await db
      .select({
        certId: lcsRegister.certId,
        legalName: lcsRegister.legalName,
        tradingName: lcsRegister.tradingName,
        status: lcsRegister.status,
        expirationDate: lcsRegister.expirationDate,
      })
      .from(lcsRegister)
      .where(
        or(
          ilike(lcsRegister.legalName, `%${query}%`),
          ilike(lcsRegister.tradingName, `%${query}%`)
        )
      )
      .limit(10);

    return NextResponse.json({ results });
  }

  return NextResponse.json({ error: "Provide cert_id or q parameter" }, { status: 400 });
}
