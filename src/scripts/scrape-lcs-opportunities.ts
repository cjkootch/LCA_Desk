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
import { lcsContractors, lcsOpportunities } from "../server/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const OPPORTUNITIES_BASE = "https://lcregister.petroleum.gov.gy/opportunities/";
const EMPLOYMENT_BASE = "https://lcregister.petroleum.gov.gy/opportunities/notices-for-individual-employment/";
const DELAY_MS = 500;

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env.local");
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema: { lcsContractors, lcsOpportunities } });
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

  // ── Phase 3: Scrape individual notice pages ──
  console.log("\nPhase 3: Scraping individual notice pages...\n");

  const [supplierSlugs, employmentSlugs] = await Promise.all([
    collectNoticeSlugsSupplier(),
    collectNoticeSlugsEmployment(),
  ]);

  console.log(`  Found ${supplierSlugs.length} supplier notice slugs`);
  console.log(`  Found ${employmentSlugs.length} employment notice slugs\n`);

  let noticesOk = 0;
  let noticesSkipped = 0;

  for (let i = 0; i < supplierSlugs.length; i++) {
    const slug = supplierSlugs[i];
    const tag = `[${String(i + 1).padStart(3, " ")}/${supplierSlugs.length}]`;
    try {
      const notice = await scrapeNoticeDetail(slug, "supplier");
      if (notice) {
        await upsertNotice(db, notice);
        noticesOk++;
        console.log(`${tag} 📋 ${notice.contractorName} — ${notice.title.slice(0, 60)}`);
      } else {
        noticesSkipped++;
        console.log(`${tag} ⚠  ${slug} — skipped`);
      }
    } catch (err) {
      noticesSkipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${tag} ❌  ${slug} — ${msg.slice(0, 80)}`);
      // If first 3 all fail, likely site is blocking — skip remaining to save time
      if (i === 2 && noticesOk === 0 && noticesSkipped === 3) {
        console.log("\n  ⚠ First 3 notices all failed — site may be blocking. Skipping remaining.\n");
        break;
      }
    }
    await sleep(DELAY_MS);
  }

  for (let i = 0; i < employmentSlugs.length; i++) {
    const slug = employmentSlugs[i];
    const tag = `[${String(i + 1).padStart(3, " ")}/${employmentSlugs.length}]`;
    try {
      const notice = await scrapeNoticeDetail(slug, "employment");
      if (notice) {
        await upsertNotice(db, notice);
        noticesOk++;
        console.log(`${tag} 👤 ${notice.contractorName} — ${notice.title.slice(0, 60)}`);
      } else {
        noticesSkipped++;
        console.log(`${tag} ⚠  ${slug} — skipped`);
      }
    } catch (err) {
      noticesSkipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${tag} ❌  ${slug} — ${msg.slice(0, 80)}`);
    }
    await sleep(DELAY_MS);
  }

  // ── Phase 4: AI-powered PDF analysis ──
  console.log("\n════════════════════════════════════════════");
  console.log("  Phase 4: AI PDF Analysis (Claude)");
  console.log("════════════════════════════════════════════\n");

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.log("  ⚠ ANTHROPIC_API_KEY not set — skipping AI analysis\n");
  } else {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const claude = new Anthropic({ apiKey: anthropicKey });

    // Get notices with PDF attachments that don't have AI summaries yet
    const needsAnalysis = await db
      .select({
        id: lcsOpportunities.id,
        attachmentUrl: lcsOpportunities.attachmentUrl,
        aiSummary: lcsOpportunities.aiSummary,
        sourceSlug: lcsOpportunities.sourceSlug,
        contractorName: lcsOpportunities.contractorName,
        title: lcsOpportunities.title,
      })
      .from(lcsOpportunities)
      .where(isNotNull(lcsOpportunities.attachmentUrl))
      .limit(500);

    const toAnalyze = needsAnalysis.filter(n => n.attachmentUrl?.endsWith(".pdf") && !n.aiSummary);

    console.log(`  Found ${toAnalyze.length} PDFs needing AI analysis\n`);

    let aiOk = 0;
    let aiSkipped = 0;

    for (let i = 0; i < toAnalyze.length; i++) {
      const notice = toAnalyze[i];
      const tag = `[${String(i + 1).padStart(3, " ")}/${toAnalyze.length}]`;

      try {
        // Download PDF as base64
        const pdfRes = await fetch(notice.attachmentUrl!, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; LCADesk/1.0)" },
          signal: AbortSignal.timeout(30_000),
        });
        if (!pdfRes.ok) { aiSkipped++; console.log(`${tag} ⚠  HTTP ${pdfRes.status} — ${notice.sourceSlug}`); continue; }

        const pdfBuffer = await pdfRes.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

        // Skip very large PDFs (>10MB)
        if (pdfBuffer.byteLength > 10_000_000) {
          aiSkipped++;
          console.log(`${tag} ⚠  PDF too large (${Math.round(pdfBuffer.byteLength / 1024 / 1024)}MB) — ${notice.sourceSlug}`);
          continue;
        }

        const response = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              },
              {
                type: "text",
                text: `You are analyzing a procurement or employment opportunity notice from Guyana's petroleum sector. Extract ALL available information from this PDF — check letterheads, headers, footers, signature blocks, tables, and body text thoroughly.

Return a JSON object with these fields. Be thorough — extract every field you can find. Use null ONLY if truly not present in the document.

{
  "issuing_company": "Full legal company name from letterhead, header, or body (e.g. 'ExxonMobil Guyana Limited', 'Halliburton Guyana Inc.')",
  "parent_company": "Parent/global company if different from issuing (e.g. 'ExxonMobil Corporation')",
  "reference_number": "Document reference, RFQ/EOI/RFP number, or tender ID",
  "opportunity_type": "EOI | RFQ | RFP | RFI | Tender | Pre-Qualification | Notice | Other",
  "title": "Full title of the opportunity as stated in the document",
  "scope_of_work": "Detailed 3-5 sentence summary of what is being procured, including specific services, equipment, or goods required",
  "requirements": ["Every requirement, certification, qualification, or prerequisite listed — include LCS registration, insurance, safety certs, experience requirements, etc."],
  "eligibility": "Who can apply — any restrictions on company size, nationality, registration status",
  "submission_deadline": "YYYY-MM-DD format",
  "project_start_date": "YYYY-MM-DD format if mentioned",
  "project_end_date": "YYYY-MM-DD format if mentioned",
  "contract_duration": "Duration as stated (e.g. '2 years', '6 months', '1 year with option to extend')",
  "estimated_value": "Dollar amount or range if mentioned, with currency",
  "location": "Specific project location (e.g. 'Stabroek Block, Offshore Guyana', 'Shore Base, Houston, Guyana')",
  "contact_name": "Primary contact person's full name",
  "contact_title": "Contact person's job title",
  "contact_emails": ["Every email address found in the document"],
  "contact_phone": "Phone number(s) found",
  "contact_address": "Physical address if listed",
  "submission_method": "How to submit (email, portal, physical delivery, etc.)",
  "submission_instructions": "Any specific instructions for responding",
  "lca_categories": ["Relevant Local Content Act categories this falls under"],
  "industry_sector": "Specific sector (e.g. 'Upstream Oil & Gas', 'Marine Services', 'Construction')",
  "lcs_registration_required": true or false,
  "key_dates": ["All dates mentioned with context, e.g. 'Site visit: 2024-03-15', 'Q&A deadline: 2024-03-20'"],
  "evaluation_criteria": ["How responses will be evaluated if mentioned"],
  "attachments_referenced": ["Any referenced attachments, appendices, or forms mentioned"]
}

Return ONLY the JSON object, no markdown, no explanation.`,
              },
            ],
          }],
        });

        const aiText = response.content[0].type === "text" ? response.content[0].text : "";
        // Extract JSON from response (handle potential markdown wrapping)
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const summary = JSON.parse(jsonMatch[0]);
          const summaryJson = JSON.stringify(summary);

          // Update DB with AI summary
          const updates: Record<string, unknown> = {
            aiSummary: summaryJson,
            updatedAt: new Date(),
          };

          // Use AI-extracted company name if current is Unknown
          if (notice.contractorName === "Unknown" && summary.issuing_company) {
            updates.contractorName = summary.issuing_company;
            // Also try pattern match for consistent slug
            const slugMatch = matchContractor(summary.issuing_company);
            if (slugMatch) {
              updates.contractorName = slugMatch.name;
              updates.contractorSlug = slugMatch.slug;
            }
          }

          await db
            .update(lcsOpportunities)
            .set(updates)
            .where(eq(lcsOpportunities.id, notice.id));

          const company = (updates.contractorName as string) || notice.contractorName;
          console.log(`${tag} 🤖 ${company} — ${summary.opportunity_type || "Notice"} — ${notice.sourceSlug}`);
          aiOk++;
        } else {
          aiSkipped++;
          console.log(`${tag} ⚠  No JSON in response — ${notice.sourceSlug}`);
        }
      } catch (err) {
        aiSkipped++;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`${tag} ❌  ${msg.slice(0, 80)} — ${notice.sourceSlug}`);
      }

      // Rate limit: 1.5s between API calls
      await sleep(1500);

      if ((i + 1) % 10 === 0) {
        console.log(`  ... ${i + 1}/${toAnalyze.length} analyzed\n`);
      }
    }

    console.log(`\n  AI analysis: ${aiOk} succeeded, ${aiSkipped} skipped`);
  }

  console.log("\n════════════════════════════════════════════");
  console.log("  Complete");
  console.log("════════════════════════════════════════════");
  console.log(`  ✓ Seeded from research:   ${seeded}`);
  console.log(`  + New from scrape:        ${added}`);
  console.log(`  ↑ Updated from scrape:    ${updated}`);
  console.log(`  ⚠ Companies skipped:     ${skipped}`);
  console.log(`  📋 Notices scraped:       ${noticesOk}`);
  console.log(`  ⚠ Notices skipped:       ${noticesSkipped}`);
  console.log();
  process.exit(0);
}

// ─── PHASE 3: INDIVIDUAL NOTICE SCRAPING ──────────────────────────

async function collectNoticeSlugsSupplier(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  while (true) {
    const url = page === 1 ? OPPORTUNITIES_BASE : `${OPPORTUNITIES_BASE}page/${page}/`;
    const html = await fetchPage(url);
    if (!html) break;
    const matches = [...html.matchAll(/\/supplier-notice\/([^/"']+)\/?/gi)];
    const pageSlugs = matches.map(m => m[1]).filter((v, i, arr) => arr.indexOf(v) === i);
    if (pageSlugs.length === 0) break;
    slugs.push(...pageSlugs);
    if (!html.includes(`page/${page + 1}/`) && !html.includes('rel="next"')) break;
    page++;
    await sleep(DELAY_MS);
  }
  return [...new Set(slugs)];
}

async function collectNoticeSlugsEmployment(): Promise<string[]> {
  const html = await fetchPage(EMPLOYMENT_BASE);
  if (!html) return [];
  const matches = [...html.matchAll(/\/supplier-notice\/([^/"']+)\/?/gi)];
  return [...new Set(matches.map(m => m[1]))];
}

interface ScrapedNotice {
  contractorName: string;
  contractorSlug: string | null;
  type: "supplier" | "employment";
  noticeType: string | null;
  title: string;
  description: string | null;
  lcaCategory: string | null;
  postedDate: string | null;
  deadline: string | null;
  sourceUrl: string;
  sourceSlug: string;
  attachmentUrl: string | null;
  attachmentContent: string | null;
}

async function extractPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LCADesk-Scraper/1.0; +https://lcadesk.com)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(Buffer.from(buffer));
    // Limit to first 3000 chars to avoid huge storage
    return data.text?.slice(0, 3000).replace(/\s+/g, " ").trim() || null;
  } catch {
    return null;
  }
}

// ─── COMPANY NAME EXTRACTION ──────────────────────────────────────
// Match company names from notice titles, slugs, and content
const COMPANY_PATTERNS: [RegExp, string, string][] = [
  [/halliburton/i, "Halliburton Guyana Inc.", "halliburton_guyana"],
  [/GDO[\s-]SCM|guyana deepwater|GDO-/i, "Guyana Deepwater Operations Inc.", "sbm_offshore"],
  [/GYSBI|guyana shore base|GSB\d/i, "Guyana Shore Base Inc. (GYSBI)", "gysbi"],
  [/G[\s-]?BOATS|g-boats/i, "G-Boats Inc.", "g_boats"],
  [/STENA|stena[\s-]?gu/i, "Stena Drilling Ltd", "stena_drilling"],
  [/exxon|EMGL|esso/i, "ExxonMobil Guyana Limited", "exxonmobil_guyana"],
  [/baker[\s-]?hughes/i, "Baker Hughes Guyana", "baker_hughes_guyana"],
  [/schlumberger|SLB[\s-]/i, "SLB Guyana (Schlumberger)", "slb_guyana"],
  [/technip|FMC/i, "TechnipFMC Guyana", "technipfmc_guyana"],
  [/saipem/i, "Saipem Guyana Inc.", "saipem_guyana"],
  [/MODEC/i, "MODEC Guyana Inc.", "modec_guyana"],
  [/weatherford/i, "Weatherford Guyana", "weatherford_guyana"],
  [/tenaris/i, "Tenaris Guyana", "tenaris_guyana"],
  [/seacor/i, "Seacor Marine LLC", "seacor_marine"],
  [/international[\s-]?sos/i, "International SOS Incorporated", "international_sos"],
  [/leader[\s-]?eng/i, "Leader Engineering Guyana Incorporated", "leader_engineering"],
  [/cataleya/i, "Cataleya Energy Limited", "cataleya_energy"],
  [/total[\s-]?energies/i, "TotalEnergies Guyana", "totalenergies_guyana"],
  [/new[\s-]?fortress/i, "New Fortress Energy Guyana", "new_fortress_energy"],
  [/hess[\s-]?guyana/i, "Hess Guyana Exploration Ltd", "hess_guyana"],
  [/CNOOC/i, "CNOOC Petroleum Guyana Limited", "cnooc_guyana"],
  [/SES[\s-]guyana|sustainable[\s-]?env/i, "Sustainable Environmental Solutions", "ses_guyana"],
  [/vanuatu/i, "Guyana Deepwater Operations Inc.", "sbm_offshore"],
  // Additional patterns from attachment filenames
  [/noble/i, "Noble Corporation", "noble_corp"],
  [/bristow/i, "Bristow Group", "bristow"],
  [/schlumberger/i, "SLB Guyana (Schlumberger)", "slb_guyana"],
  [/ocean[\s-]?rig/i, "Ocean Rig", "ocean_rig"],
  [/tullow/i, "Tullow Oil", "tullow_oil"],
  [/CGX/i, "CGX Energy", "cgx_energy"],
  [/repsol/i, "Repsol", "repsol"],
  [/maersk/i, "Maersk Drilling", "maersk"],
  [/noble[\s-]?bob/i, "Noble Corporation", "noble_corp"],
  [/borr[\s-]?drilling/i, "Borr Drilling", "borr_drilling"],
  [/guyana[\s-]?oil|GOCL/i, "Guyana Oil Company Ltd", "gocl"],
  [/wood[\s-]?group|wood[\s-]?plc/i, "Wood PLC", "wood_plc"],
  [/worley/i, "Worley", "worley"],
  [/mcdermott/i, "McDermott International", "mcdermott"],
  [/subsea[\s-]?7/i, "Subsea 7", "subsea7"],
  [/diamond[\s-]?offshore/i, "Diamond Offshore", "diamond_offshore"],
  [/trans[\s-]?ocean/i, "Transocean", "transocean"],
  [/nabors/i, "Nabors Industries", "nabors"],
  [/core[\s-]?labs/i, "Core Laboratories", "core_labs"],
  [/newpark/i, "Newpark Resources", "newpark"],
];

function matchContractor(text: string): { name: string; slug: string } | null {
  for (const [pattern, name, slug] of COMPANY_PATTERNS) {
    if (pattern.test(text)) return { name, slug };
  }
  return null;
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  // DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Try parsing natural dates like "January 15, 2024"
  try {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  } catch {}
  return null;
}

async function scrapeNoticeDetail(slug: string, type: "supplier" | "employment"): Promise<ScrapedNotice | null> {
  const url = `https://lcregister.petroleum.gov.gy/supplier-notice/${slug}/`;
  const html = await fetchPage(url);
  if (!html) return null;

  const titleMatch = html.match(/<h1[^>]*>([^<]{5,200})<\/h1>/i) || html.match(/<title>([^<]{5,200})<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s*[–|]\s*Local Content Register.*$/i, "").trim();
  if (!title || title.length < 4) return null;

  // Extract attachment filenames — company name is often in the PDF filename
  const attachmentFilenames = [...html.matchAll(/href="[^"]*\/([^/"]+\.(?:pdf|docx?|xlsx?))/gi)]
    .map(m => decodeURIComponent(m[1]).replace(/[_\-\.]/g, " "))
    .join(" ");

  // Extract alt text from images — sometimes company logos have alt text
  const imgAlts = [...html.matchAll(/alt="([^"]{3,80})"/gi)]
    .map(m => m[1])
    .join(" ");

  // Try pattern matching on title + slug + attachments + full page content
  const searchText = `${title} ${slug} ${attachmentFilenames} ${imgAlts} ${html.slice(0, 5000)}`;
  const matched = matchContractor(searchText);

  // Fallback: try HTML author/posted-by patterns
  let contractorName = matched?.name || "Unknown";
  let contractorSlug = matched?.slug || null;

  // Second fallback: try to extract from attachment filename directly
  if (contractorName === "Unknown" && attachmentFilenames.length > 3) {
    // Many filenames are like "Saipem_RFI_Cleaning.pdf" or "GYSBI_EOI_2024.pdf"
    const filenameMatch = matchContractor(attachmentFilenames);
    if (filenameMatch) {
      contractorName = filenameMatch.name;
      contractorSlug = filenameMatch.slug;
    }
  }

  // Third fallback: extract from identity links on the page
  if (contractorName === "Unknown") {
    const authorMatch =
      html.match(/class="[^"]*author[^"]*"[^>]*>([^<]{3,80})</i) ||
      html.match(/Posted by[:\s]*<[^>]+>([^<]{3,80})</i) ||
      html.match(/\/identity\/([^/"']+)\/?/);
    if (authorMatch?.[1] && authorMatch[1].length > 3) {
      contractorName = authorMatch[1].trim();
      const slugFromIdentity = html.match(/\/identity\/([^/"']+)\/?/);
      contractorSlug = slugFromIdentity?.[1] || null;
    }
  }

  let noticeType: string | null = null;
  if (/EOI|Expression of Interest/i.test(html)) noticeType = "EOI";
  else if (/RFQ|Request for Quotation/i.test(html)) noticeType = "RFQ";
  else if (/RFP|Request for Proposal/i.test(html)) noticeType = "RFP";
  else if (/RFI|Request for Information/i.test(html)) noticeType = "RFI";

  const contentMatch = html.match(/class="[^"]*entry-content[^"]*"[^>]*>([\s\S]{20,2000}?)<\/div>/i);
  const description = contentMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000) || null;

  const catMatch = html.match(/supply_category\/([^/"']+)/i);
  const lcaCategory = catMatch?.[1]?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || null;

  const dateMatch = html.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})|(\w+ \d{1,2},\s*\d{4})/);
  const postedDate = normalizeDate(dateMatch?.[0] || null);

  const deadlineMatch = html.match(/(?:deadline|closing date|submit by|due date)[:\s]*([^\n<]{5,40})/i);
  const deadline = normalizeDate(deadlineMatch?.[1]?.trim() || null);

  // Extract first PDF attachment URL
  const pdfMatch = html.match(/href="(https?:\/\/[^"]+\.pdf)"/i);
  const attachmentUrl = pdfMatch?.[1] || null;

  return {
    contractorName, contractorSlug, type, noticeType, title, description,
    lcaCategory, postedDate, deadline, sourceUrl: url, sourceSlug: slug,
    attachmentUrl, attachmentContent: null, // filled in Phase 4
  };
}

async function upsertNotice(db: ReturnType<typeof getDb>, notice: ScrapedNotice) {
  const status = notice.deadline ? (new Date(notice.deadline) < new Date() ? "expired" : "active") : "active";
  try {
    await db.insert(lcsOpportunities).values({
      contractorName: notice.contractorName,
      contractorSlug: notice.contractorSlug,
      type: notice.type,
      noticeType: notice.noticeType,
      title: notice.title,
      description: notice.description,
      lcaCategory: notice.lcaCategory,
      postedDate: notice.postedDate ?? undefined,
      deadline: notice.deadline ?? undefined,
      sourceUrl: notice.sourceUrl,
      sourceSlug: notice.sourceSlug,
      attachmentUrl: notice.attachmentUrl,
      attachmentContent: notice.attachmentContent,
      status,
      scrapedAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: lcsOpportunities.sourceSlug,
      set: {
        contractorName: notice.contractorName,
        title: notice.title,
        description: notice.description,
        lcaCategory: notice.lcaCategory,
        attachmentUrl: notice.attachmentUrl,
        // Don't overwrite attachmentContent if already extracted
        deadline: notice.deadline ?? undefined,
        status,
        scrapedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate key") || msg.includes("unique")) return;
    throw err;
  }
}

main().catch((err) => { console.error("\nFatal error:", err); process.exit(1); });
