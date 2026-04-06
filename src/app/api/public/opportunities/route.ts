import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { lcsContractors, lcsOpportunities } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const [contractors, notices] = await Promise.all([
    db
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
      .orderBy(lcsContractors.companyName),
    db
      .select({
        id: lcsOpportunities.id,
        contractorName: lcsOpportunities.contractorName,
        type: lcsOpportunities.type,
        noticeType: lcsOpportunities.noticeType,
        title: lcsOpportunities.title,
        description: lcsOpportunities.description,
        lcaCategory: lcsOpportunities.lcaCategory,
        employmentCategory: lcsOpportunities.employmentCategory,
        postedDate: lcsOpportunities.postedDate,
        deadline: lcsOpportunities.deadline,
        sourceUrl: lcsOpportunities.sourceUrl,
        status: lcsOpportunities.status,
        aiSummary: lcsOpportunities.aiSummary,
      })
      .from(lcsOpportunities)
      .orderBy(lcsOpportunities.postedDate),
  ]);

  // Extract teaser from AI summary for public consumption
  const noticesWithTeaser = notices.map(n => {
    let aiTeaser: string | null = null;
    if (n.aiSummary) {
      try {
        const parsed = JSON.parse(n.aiSummary);
        aiTeaser = parsed.scope_of_work || null;
      } catch {}
    }
    return { ...n, aiSummary: undefined, aiTeaser };
  });

  return NextResponse.json({
    contractors,
    notices: noticesWithTeaser,
    summary: {
      totalContractors: contractors.length,
      totalNotices: notices.length,
      activeNotices: notices.filter(n => n.status === "active").length,
      supplierNotices: notices.filter(n => n.type === "supplier").length,
      employmentNotices: notices.filter(n => n.type === "employment").length,
    },
  });
}
