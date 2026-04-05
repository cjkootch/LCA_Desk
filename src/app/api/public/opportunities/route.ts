import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { lcsContractors } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await db
    .select({
      id: lcsContractors.id,
      companyName: lcsContractors.companyName,
      procurementCategories: lcsContractors.procurementCategories,
      sampleNotices: lcsContractors.sampleNotices,
      noticeCount: lcsContractors.noticeCount,
      lastNoticedAt: lcsContractors.lastNoticedAt,
    })
    .from(lcsContractors)
    .where(eq(lcsContractors.confirmedFiler, true))
    .orderBy(lcsContractors.companyName);

  return NextResponse.json({ opportunities: results });
}
