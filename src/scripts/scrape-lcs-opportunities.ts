/**
 * LCS Opportunities Board Scraper
 * Scrapes companies that post procurement notices on the LCS opportunities board.
 * These are confirmed LCA filing clients — contractors with active procurement activity.
 *
 * Target: lcregister.petroleum.gov.gy/opportunities/
 *
 * Unlike the register scraper, this page renders as static HTML.
 * No Playwright needed — plain fetch() works for all pages.
 *
 * Run with: npm run scrape:opportunities
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { lcsContractors } from "../server/db/schema";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const OPPORTUNITIES_BASE = "https://lcregister.petroleum.gov.gy/opportunities/";
const EMPLOYMENT_BASE = "https://lcregister.petroleum.gov.gy/opportunities/notices-for-individual-employment/";
const DELAY_MS = 500;

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env.local");
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema: { lcsContractors } });
}

interface ContractorRecord {
  companyName: string;
  profileSlug: string | null;
  noticeCount: number;
  lastNoticedAt: string | null;
  procurementCategories: string[];
  sampleNotices: string[];
  scrapeError: string | null;
}

interface ParsedNotice {
  companyName: string;
  profileSlug: string | null;
  noticeTitle: string;
  noticeDate: string | null;
  categories: string[];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LCADesk-Scraper/1.0; +https://lcadesk.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) { console.error(`  HTTP ${res.status} for ${url}`); return null; }
    return await res.text();
  } catch (err) {
    console.error(`  Fetch error for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function parseOpportunitiesPage(html: string): ParsedNotice[] {
  const notices: ParsedNotice[] = [];

  const rawEntries = html.match(
    /(?:gravatar\.com|rg_uploads)[\s\S]{0,800}?(?=gravatar\.com|rg_uploads|$)/gi
  ) || [];

  for (const block of rawEntries) {
    const nameMatch =
      block.match(/<a[^>]*>([A-Z][^<]{2,80})<\/a>/i) ||
      block.match(/<strong>([^<]{3,80})<\/strong>/i) ||
      block.match(/alt="([^"]{3,80})"/i);

    const dateMatch = block.match(/(\d{2}\/\d{2}\/\d{4})/);
    const titleMatch = block.match(/<h[34][^>]*>[\s\S]*?<a[^>]*>([^<]{5,200})<\/a>/i);

    const categoryMatches = [...block.matchAll(/supply_category\/([^/'"]+)/gi)];
    const categories = categoryMatches
      .map(m => m[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 5);

    if (nameMatch?.[1] && nameMatch[1].length > 3) {
      const companyName = nameMatch[1].trim();
      if (companyName.toLowerCase().includes("read more") || companyName.toLowerCase().includes("view") || companyName.length < 4) continue;

      notices.push({
        companyName,
        profileSlug: null,
        noticeTitle: titleMatch?.[1]?.trim() || "",
        noticeDate: dateMatch?.[1] || null,
        categories,
      });
    }
  }

  return notices;
}

function aggregateByCompany(notices: ParsedNotice[]): ContractorRecord[] {
  const companyMap = new Map<string, ContractorRecord>();

  for (const notice of notices) {
    const key = notice.companyName.toLowerCase().trim();
    if (!companyMap.has(key)) {
      companyMap.set(key, {
        companyName: notice.companyName,
        profileSlug: notice.profileSlug,
        noticeCount: 0,
        lastNoticedAt: null,
        procurementCategories: [],
        sampleNotices: [],
        scrapeError: null,
      });
    }
    const record = companyMap.get(key)!;
    record.noticeCount++;
    if (notice.noticeDate && (!record.lastNoticedAt || notice.noticeDate > record.lastNoticedAt)) {
      record.lastNoticedAt = notice.noticeDate;
    }
    for (const cat of notice.categories) {
      if (!record.procurementCategories.includes(cat)) record.procurementCategories.push(cat);
    }
    if (notice.noticeTitle && record.sampleNotices.length < 5) record.sampleNotices.push(notice.noticeTitle);
  }

  return Array.from(companyMap.values());
}

async function scrapeAllNotices(): Promise<ParsedNotice[]> {
  const allNotices: ParsedNotice[] = [];

  console.log("  Fetching supplier procurement notices...");
  let page = 1;
  while (true) {
    const url = page === 1 ? OPPORTUNITIES_BASE : `${OPPORTUNITIES_BASE}page/${page}/`;
    console.log(`  Page ${page}: ${url}`);
    const html = await fetchPage(url);
    if (!html) break;
    if (html.includes("No opportunities found") || html.includes("nothing found") || (!html.includes("supplier-notice") && !html.includes("gravatar"))) {
      console.log(`  No more pages at page ${page}`);
      break;
    }
    const pageNotices = parseOpportunitiesPage(html);
    if (pageNotices.length === 0) break;
    allNotices.push(...pageNotices);
    console.log(`  Found ${pageNotices.length} notices on page ${page}`);
    if (!html.includes(`page/${page + 1}/`) && !html.includes('rel="next"')) break;
    page++;
    await sleep(DELAY_MS);
  }

  console.log("\n  Fetching employment notices...");
  const employmentHtml = await fetchPage(EMPLOYMENT_BASE);
  if (employmentHtml) {
    const empNotices = parseOpportunitiesPage(employmentHtml);
    allNotices.push(...empNotices);
    console.log(`  Found ${empNotices.length} employment notices`);
  }

  return allNotices;
}

const KNOWN_CONTRACTORS: Omit<ContractorRecord, "scrapeError">[] = [
  { companyName: "ExxonMobil Guyana Limited", profileSlug: "exxonmobil_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["All Categories"], sampleNotices: ["Stabroek Block Operator"] },
  { companyName: "Hess Guyana Exploration Ltd", profileSlug: "hess_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["All Categories"], sampleNotices: ["Stabroek Block Co-venturer"] },
  { companyName: "CNOOC Petroleum Guyana Limited", profileSlug: "cnooc_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["All Categories"], sampleNotices: ["Stabroek Block Co-venturer"] },
  { companyName: "Halliburton Guyana Inc.", profileSlug: "halliburton_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining", "Manpower and Crewing Services"], sampleNotices: ["Confirmed LCA Annual Plan filer"] },
  { companyName: "SLB Guyana (Schlumberger)", profileSlug: "slb_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining", "Borehole Testing Services"], sampleNotices: ["Confirmed LCA Annual Plan filer"] },
  { companyName: "Baker Hughes Guyana", profileSlug: "baker_hughes_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining"], sampleNotices: ["Confirmed LCA Annual Plan filer"] },
  { companyName: "TechnipFMC Guyana", profileSlug: "technipfmc_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining", "Structural Fabrication"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Saipem Guyana Inc.", profileSlug: "saipem_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Structural Fabrication", "Engineering and Machining"], sampleNotices: ["Confirmed LCA filer — SURF contractor"] },
  { companyName: "Guyana Shore Base Inc. (GYSBI)", profileSlug: "gysbi", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Storage Services (Warehousing)", "Construction Work for Buildings Onshore"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Guyana Deepwater Operations Inc.", profileSlug: "sbm_offshore", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Manpower and Crewing Services", "Engineering and Machining"], sampleNotices: ["SBM Offshore affiliate — FPSO operator"] },
  { companyName: "MODEC Guyana Inc.", profileSlug: "modec_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining", "Construction Work for Buildings Onshore"], sampleNotices: ["FPSO construction contractor"] },
  { companyName: "Stena Drilling Ltd", profileSlug: "stena_drilling", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Equipment Rental (Crane and other heavy-duty machinery)"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "G-Boats Inc.", profileSlug: "g_boats", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Transportation Services"], sampleNotices: ["Confirmed LCA Master Plan filer — weekly tenders"] },
  { companyName: "Weatherford Guyana", profileSlug: "weatherford_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining", "Borehole Testing Services"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Tenaris Guyana", profileSlug: "tenaris_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Structural Fabrication"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Seacor Marine LLC", profileSlug: "seacor_marine", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Manpower and Crewing Services"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "International SOS Incorporated", profileSlug: "international_sos", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Medical Services"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Leader Engineering Guyana Incorporated", profileSlug: "leader_engineering", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Engineering and Machining"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "Cataleya Energy Limited", profileSlug: "cataleya_energy", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["All Categories"], sampleNotices: ["Kaieteur Block — LCA Master Plan approved"] },
  { companyName: "Sustainable Environmental Solutions", profileSlug: "ses_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["Environment Services and Studies", "Waste Management"], sampleNotices: ["Confirmed LCA Master Plan filer"] },
  { companyName: "TotalEnergies Guyana", profileSlug: "totalenergies_guyana", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["All Categories"], sampleNotices: ["Canje Block, S4 Block operator"] },
  { companyName: "New Fortress Energy Guyana", profileSlug: "new_fortress_energy", noticeCount: 0, lastNoticedAt: null, procurementCategories: ["All Categories"], sampleNotices: ["LNG terminal operations"] },
];

async function upsertContractor(db: ReturnType<typeof getDb>, record: ContractorRecord) {
  try {
    await db.insert(lcsContractors).values({
      companyName: record.companyName,
      profileSlug: record.profileSlug,
      confirmedFiler: true,
      noticeCount: record.noticeCount,
      lastNoticedAt: record.lastNoticedAt ?? undefined,
      procurementCategories: record.procurementCategories,
      sampleNotices: record.sampleNotices,
      scrapedAt: new Date(),
      scrapeError: record.scrapeError,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: lcsContractors.profileSlug,
      set: {
        companyName: record.companyName,
        noticeCount: record.noticeCount,
        lastNoticedAt: record.lastNoticedAt ?? undefined,
        procurementCategories: record.procurementCategories,
        sampleNotices: record.sampleNotices,
        scrapedAt: new Date(),
        scrapeError: record.scrapeError,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate key") || msg.includes("unique")) return;
    throw err;
  }
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  LCS Opportunities Scraper  ·  LCA Desk");
  console.log("════════════════════════════════════════════\n");

  const db = getDb();

  console.log(`Phase 1: Seeding ${KNOWN_CONTRACTORS.length} known contractors...\n`);
  let seeded = 0;
  for (const contractor of KNOWN_CONTRACTORS) {
    await upsertContractor(db, { ...contractor, scrapeError: null });
    console.log(`  ✓ ${contractor.companyName}`);
    seeded++;
  }

  console.log(`\nPhase 2: Scraping LCS opportunities board...\n`);
  const allNotices = await scrapeAllNotices();
  const scraped = aggregateByCompany(allNotices);
  console.log(`\n  Found ${scraped.length} unique companies from opportunities board`);

  let added = 0, updated = 0, skipped = 0;
  for (const record of scraped) {
    if (record.companyName.length < 4) { skipped++; continue; }
    try {
      await upsertContractor(db, record);
      const isKnown = KNOWN_CONTRACTORS.some(k => k.companyName.toLowerCase() === record.companyName.toLowerCase());
      if (isKnown) { updated++; console.log(`  ↑ Updated: ${record.companyName} (${record.noticeCount} notices)`); }
      else { added++; console.log(`  + New: ${record.companyName} (${record.noticeCount} notices)`); }
    } catch { skipped++; console.log(`  ⚠ Skipped: ${record.companyName}`); }
  }

  console.log("\n════════════════════════════════════════════");
  console.log("  Complete");
  console.log("════════════════════════════════════════════");
  console.log(`  ✓ Seeded from research:   ${seeded}`);
  console.log(`  + New from scrape:        ${added}`);
  console.log(`  ↑ Updated from scrape:    ${updated}`);
  console.log(`  ⚠ Skipped:               ${skipped}`);
  console.log(`  Total in database:        ${seeded + added}`);
  console.log();
  process.exit(0);
}

main().catch((err) => { console.error("\nFatal error:", err); process.exit(1); });
