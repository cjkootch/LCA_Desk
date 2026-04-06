import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { companyProfiles, lcsRegister } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || ""; // active | expired
  const sort = searchParams.get("sort") || "opportunities"; // opportunities | name | jobs | registered
  const hasOpportunities = searchParams.get("has_opportunities") === "true";
  const hiring = searchParams.get("hiring") === "true";
  const lcsOnly = searchParams.get("lcs_only") === "true";

  // Fetch all profiles with enriched data
  const profiles = await db.select({
    slug: companyProfiles.slug,
    companyName: companyProfiles.companyName,
    legalName: companyProfiles.legalName,
    website: companyProfiles.website,
    description: companyProfiles.description,
    industry: companyProfiles.industry,
    guyanaOffice: companyProfiles.guyanaOffice,
    totalOpportunities: companyProfiles.totalOpportunities,
    activeOpportunities: companyProfiles.activeOpportunities,
    totalJobPostings: companyProfiles.totalJobPostings,
    openJobPostings: companyProfiles.openJobPostings,
    procurementCategories: companyProfiles.procurementCategories,
    employmentCategories: companyProfiles.employmentCategories,
    claimed: companyProfiles.claimed,
    verified: companyProfiles.verified,
    lcsRegistered: companyProfiles.lcsRegistered,
    lcsCertId: companyProfiles.lcsCertId,
    lcsStatus: companyProfiles.lcsStatus,
    lcsExpirationDate: companyProfiles.lcsExpirationDate,
    lcsServiceCategories: companyProfiles.lcsServiceCategories,
    lcsAddress: companyProfiles.lcsAddress,
  })
    .from(companyProfiles)
    .limit(2000);

  // Also pull AI enrichment data from lcs_register for matched companies
  const registerData = await db.select({
    legalName: lcsRegister.legalName,
    aiSummary: lcsRegister.aiSummary,
  }).from(lcsRegister).limit(2000);

  const registerMap = new Map<string, string>();
  for (const r of registerData) {
    if (r.aiSummary) registerMap.set(r.legalName.toLowerCase(), r.aiSummary);
  }

  // Enrich profiles with AI data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enriched = profiles.map(p => {
    const aiRaw = registerMap.get(p.companyName.toLowerCase()) ||
      registerMap.get((p.legalName || "").toLowerCase());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aiData: any = null;
    if (aiRaw) {
      try { aiData = JSON.parse(aiRaw); } catch {}
    }

    return {
      slug: p.slug,
      companyName: p.companyName,
      legalName: p.legalName,
      website: p.website,
      description: aiData?.company_description || p.description || null,
      industry: aiData?.industry_focus || p.industry,
      companyType: aiData?.company_type || null,
      guyanaPresence: aiData?.guyana_presence || p.guyanaOffice || null,
      keyServices: aiData?.key_services || null,
      employeeEstimate: aiData?.employee_count_estimate || null,
      parentCompany: aiData?.parent_company || null,
      likelyFilingObligation: aiData?.likely_filing_obligation ?? null,
      // Stats
      totalOpportunities: p.totalOpportunities || 0,
      activeOpportunities: p.activeOpportunities || 0,
      totalJobPostings: p.totalJobPostings || 0,
      openJobPostings: p.openJobPostings || 0,
      // Categories
      procurementCategories: p.procurementCategories || [],
      employmentCategories: p.employmentCategories || [],
      lcsServiceCategories: p.lcsServiceCategories || [],
      // LCS
      lcsRegistered: p.lcsRegistered || false,
      lcsCertId: p.lcsCertId,
      lcsStatus: p.lcsStatus,
      lcsExpirationDate: p.lcsExpirationDate,
      lcsAddress: p.lcsAddress,
      // Claim
      claimed: p.claimed || false,
      verified: p.verified || false,
    };
  });

  // Apply filters
  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(p =>
      p.companyName.toLowerCase().includes(q) ||
      (p.legalName || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.lcsCertId || "").toLowerCase().includes(q) ||
      p.procurementCategories.some(c => c.toLowerCase().includes(q)) ||
      p.lcsServiceCategories.some(c => c.toLowerCase().includes(q)) ||
      (p.keyServices || []).some((s: string) => s.toLowerCase().includes(q))
    );
  }
  if (category) {
    const cat = category.toLowerCase();
    enriched = enriched.filter(p =>
      p.procurementCategories.some(c => c.toLowerCase().includes(cat)) ||
      p.lcsServiceCategories.some(c => c.toLowerCase().includes(cat))
    );
  }
  if (status === "active") enriched = enriched.filter(p => p.lcsStatus?.toLowerCase() === "active");
  if (status === "expired") enriched = enriched.filter(p => p.lcsStatus?.toLowerCase() === "expired");
  if (hasOpportunities) enriched = enriched.filter(p => p.activeOpportunities > 0);
  if (hiring) enriched = enriched.filter(p => p.openJobPostings > 0);
  if (lcsOnly) enriched = enriched.filter(p => p.lcsRegistered);

  // Sort
  switch (sort) {
    case "name": enriched.sort((a, b) => a.companyName.localeCompare(b.companyName)); break;
    case "jobs": enriched.sort((a, b) => b.totalJobPostings - a.totalJobPostings); break;
    case "registered": enriched.sort((a, b) => (b.lcsRegistered ? 1 : 0) - (a.lcsRegistered ? 1 : 0)); break;
    default: enriched.sort((a, b) => b.totalOpportunities - a.totalOpportunities); break;
  }

  // Collect unique categories for filter UI
  const allCategories = new Set<string>();
  for (const p of profiles) {
    if (p.procurementCategories) p.procurementCategories.forEach(c => allCategories.add(c));
    if (p.lcsServiceCategories) p.lcsServiceCategories.forEach(c => allCategories.add(c));
  }

  return NextResponse.json({
    companies: enriched,
    filters: {
      categories: [...allCategories].sort(),
      sorts: ["opportunities", "name", "jobs", "registered"],
    },
    summary: {
      total: enriched.length,
      totalUnfiltered: profiles.length,
      lcsRegistered: profiles.filter(p => p.lcsRegistered).length,
      claimed: profiles.filter(p => p.claimed).length,
      withOpportunities: profiles.filter(p => (p.activeOpportunities || 0) > 0).length,
      hiring: profiles.filter(p => (p.openJobPostings || 0) > 0).length,
      withFilingObligation: enriched.filter(p => p.likelyFilingObligation).length,
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
