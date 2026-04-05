import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { lcsContractors } from "@/server/db/schema";

const KNOWN_CONTRACTORS = [
  { companyName: "ExxonMobil Guyana Limited", profileSlug: "exxonmobil_guyana", procurementCategories: ["All Categories"], sampleNotices: ["Stabroek Block Operator"] },
  { companyName: "Hess Guyana Exploration Ltd", profileSlug: "hess_guyana", procurementCategories: ["All Categories"], sampleNotices: ["Stabroek Block Co-venturer"] },
  { companyName: "CNOOC Petroleum Guyana Limited", profileSlug: "cnooc_guyana", procurementCategories: ["All Categories"], sampleNotices: ["Stabroek Block Co-venturer"] },
  { companyName: "Halliburton Guyana Inc.", profileSlug: "halliburton_guyana", procurementCategories: ["Engineering and Machining", "Manpower and Crewing Services"], sampleNotices: ["Confirmed LCA Annual Plan filer"] },
  { companyName: "SLB Guyana (Schlumberger)", profileSlug: "slb_guyana", procurementCategories: ["Engineering and Machining", "Borehole Testing Services"], sampleNotices: ["Confirmed LCA Annual Plan filer"] },
  { companyName: "Baker Hughes Guyana", profileSlug: "baker_hughes_guyana", procurementCategories: ["Engineering and Machining"], sampleNotices: ["Confirmed LCA Annual Plan filer"] },
  { companyName: "TechnipFMC Guyana", profileSlug: "technipfmc_guyana", procurementCategories: ["Engineering and Machining", "Structural Fabrication"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Saipem Guyana Inc.", profileSlug: "saipem_guyana", procurementCategories: ["Structural Fabrication", "Engineering and Machining"], sampleNotices: ["Confirmed LCA filer — SURF contractor"] },
  { companyName: "Guyana Shore Base Inc. (GYSBI)", profileSlug: "gysbi", procurementCategories: ["Storage Services (Warehousing)", "Construction Work for Buildings Onshore"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Guyana Deepwater Operations Inc.", profileSlug: "sbm_offshore", procurementCategories: ["Manpower and Crewing Services", "Engineering and Machining"], sampleNotices: ["SBM Offshore affiliate — FPSO operator"] },
  { companyName: "MODEC Guyana Inc.", profileSlug: "modec_guyana", procurementCategories: ["Engineering and Machining", "Construction Work for Buildings Onshore"], sampleNotices: ["FPSO construction contractor"] },
  { companyName: "Stena Drilling Ltd", profileSlug: "stena_drilling", procurementCategories: ["Equipment Rental"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "G-Boats Inc.", profileSlug: "g_boats", procurementCategories: ["Transportation Services"], sampleNotices: ["Confirmed LCA Master Plan filer — weekly tenders"] },
  { companyName: "Weatherford Guyana", profileSlug: "weatherford_guyana", procurementCategories: ["Engineering and Machining", "Borehole Testing Services"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Tenaris Guyana", profileSlug: "tenaris_guyana", procurementCategories: ["Structural Fabrication"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Seacor Marine LLC", profileSlug: "seacor_marine", procurementCategories: ["Manpower and Crewing Services"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "International SOS Incorporated", profileSlug: "international_sos", procurementCategories: ["Medical Services"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Leader Engineering Guyana Incorporated", profileSlug: "leader_engineering", procurementCategories: ["Engineering and Machining"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Cataleya Energy Limited", profileSlug: "cataleya_energy", procurementCategories: ["All Categories"], sampleNotices: ["Kaieteur Block — LCA Master Plan approved"] },
  { companyName: "Sustainable Environmental Solutions", profileSlug: "ses_guyana", procurementCategories: ["Environment Services and Studies", "Waste Management"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "TotalEnergies Guyana", profileSlug: "totalenergies_guyana", procurementCategories: ["All Categories"], sampleNotices: ["Canje Block, S4 Block operator"] },
  { companyName: "New Fortress Energy Guyana", profileSlug: "new_fortress_energy", procurementCategories: ["All Categories"], sampleNotices: ["LNG terminal operations"] },
];

export async function GET(req: NextRequest) {
  // Only super admins can seed
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let seeded = 0;
  const errors: string[] = [];

  for (const c of KNOWN_CONTRACTORS) {
    try {
      await db.insert(lcsContractors).values({
        companyName: c.companyName,
        profileSlug: c.profileSlug,
        confirmedFiler: true,
        noticeCount: 0,
        procurementCategories: c.procurementCategories,
        sampleNotices: c.sampleNotices,
        outreachStatus: "not_contacted",
        scrapedAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: lcsContractors.profileSlug,
        set: {
          companyName: c.companyName,
          procurementCategories: c.procurementCategories,
          sampleNotices: c.sampleNotices,
          updatedAt: new Date(),
        },
      });
      seeded++;
    } catch (err) {
      errors.push(`${c.companyName}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    success: true,
    seeded,
    errors: errors.length > 0 ? errors : undefined,
    total: KNOWN_CONTRACTORS.length,
  });
}
