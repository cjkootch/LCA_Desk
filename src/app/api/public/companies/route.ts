import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { companyProfiles } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await db.select({
    slug: companyProfiles.slug,
    companyName: companyProfiles.companyName,
    industry: companyProfiles.industry,
    totalOpportunities: companyProfiles.totalOpportunities,
    activeOpportunities: companyProfiles.activeOpportunities,
    totalJobPostings: companyProfiles.totalJobPostings,
    openJobPostings: companyProfiles.openJobPostings,
    procurementCategories: companyProfiles.procurementCategories,
    employmentCategories: companyProfiles.employmentCategories,
    claimed: companyProfiles.claimed,
    lcsRegistered: companyProfiles.lcsRegistered,
  })
    .from(companyProfiles)
    .orderBy(desc(companyProfiles.totalOpportunities))
    .limit(100);

  return NextResponse.json({
    companies: profiles,
    summary: {
      total: profiles.length,
      claimed: profiles.filter(p => p.claimed).length,
      withOpportunities: profiles.filter(p => (p.activeOpportunities || 0) > 0).length,
      hiring: profiles.filter(p => (p.openJobPostings || 0) > 0).length,
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
