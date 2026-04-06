/**
 * LCS Employment Notices Scraper
 * Scrapes job postings from the LCS employment opportunities board.
 * These are individual employment notices posted by petroleum sector companies.
 *
 * Target: lcregister.petroleum.gov.gy/opportunities/notices-for-individual-employment/
 *
 * Run with: npm run scrape:jobs
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { lcsEmploymentNotices } from "../server/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const EMPLOYMENT_BASE = "https://lcregister.petroleum.gov.gy/opportunities/notices-for-individual-employment/";
const DELAY_MS = 700;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql);
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
    console.error(`  Fetch error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── COMPANY PATTERNS ────────────────────────────────────────────

const COMPANY_PATTERNS: [RegExp, string, string][] = [
  [/halliburton/i, "Halliburton Guyana Inc.", "halliburton_guyana"],
  [/saipem/i, "Saipem Guyana Inc.", "saipem_guyana"],
  [/exxon|EMGL/i, "ExxonMobil Guyana Limited", "exxonmobil_guyana"],
  [/GDO|guyana deepwater/i, "Guyana Deepwater Operations Inc.", "sbm_offshore"],
  [/GYSBI|guyana shore base/i, "Guyana Shore Base Inc. (GYSBI)", "gysbi"],
  [/stena/i, "Stena Drilling Ltd", "stena_drilling"],
  [/baker[\s-]?hughes/i, "Baker Hughes Guyana", "baker_hughes_guyana"],
  [/SLB|schlumberger/i, "SLB Guyana (Schlumberger)", "slb_guyana"],
  [/technipfmc/i, "TechnipFMC Guyana", "technipfmc_guyana"],
  [/weatherford/i, "Weatherford Guyana", "weatherford_guyana"],
  [/MODEC/i, "MODEC Guyana Inc.", "modec_guyana"],
  [/total[\s-]?energies/i, "TotalEnergies Guyana", "totalenergies_guyana"],
  [/hess/i, "Hess Guyana Exploration Ltd", "hess_guyana"],
  [/CNOOC/i, "CNOOC Petroleum Guyana Limited", "cnooc_guyana"],
  [/SES|sustainable[\s-]?env/i, "Sustainable Environmental Solutions", "ses_guyana"],
  [/bourbon/i, "Bourbon Guyana Inc.", "bourbon_guyana"],
  [/international[\s-]?sos/i, "International SOS Incorporated", "international_sos"],
  [/leader[\s-]?eng/i, "Leader Engineering Guyana Incorporated", "leader_engineering"],
  [/new[\s-]?fortress/i, "New Fortress Energy Guyana", "new_fortress_energy"],
  [/g[\s-]?boats/i, "G-Boats Inc.", "g_boats"],
  [/tenaris/i, "Tenaris Guyana", "tenaris_guyana"],
  [/seacor/i, "Seacor Marine LLC", "seacor_marine"],
  [/expro/i, "Expro", "expro"],
  [/worley/i, "Worley", "worley"],
  [/fugro/i, "Fugro", "fugro"],
];

function matchCompany(text: string): { name: string; slug: string } | null {
  for (const [pattern, name, slug] of COMPANY_PATTERNS) {
    if (pattern.test(text)) return { name, slug };
  }
  return null;
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/[,\s]+$/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) { const [, d, m, y] = dmy; return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  const cleaned = trimmed.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) return parsed.toISOString().slice(0, 10);
  } catch {}
  return null;
}

// ─── SLUG COLLECTION ─────────────────────────────────────────────

async function collectSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let page = 1;
  while (true) {
    // Pagination format: /notices-for-individual-employment/2/ (not /page/2/)
    const url = page === 1 ? EMPLOYMENT_BASE : `${EMPLOYMENT_BASE}${page}/`;
    console.log(`  Page ${page}: ${url}`);
    const html = await fetchPage(url);
    if (!html) break;

    const matches = [...html.matchAll(/\/i-employment-notices\/([^/"']+)\/?/gi)];
    const pageSlugs = [...new Set(matches.map(m => m[1]))];
    if (pageSlugs.length === 0) break;
    slugs.push(...pageSlugs);
    console.log(`  Found ${pageSlugs.length} notices on page ${page}`);

    // Check pagination: look for next page number in links
    const hasNext = html.includes(`/${page + 1}/`) || html.includes('rel="next"');
    if (!hasNext) break;
    page++;
    await sleep(DELAY_MS);
  }
  return [...new Set(slugs)];
}

// ─── NOTICE DETAIL SCRAPING ──────────────────────────────────────

interface ScrapedJob {
  companyName: string;
  companySlug: string | null;
  jobTitle: string;
  employmentCategory: string | null;
  noticeType: string | null;
  description: string | null;
  qualifications: string | null;
  location: string | null;
  closingDate: string | null;
  postedDate: string | null;
  sourceUrl: string;
  sourceSlug: string;
  attachmentUrl: string | null;
  attachmentUrls: string | null;
  pageContent: string | null;
}

async function scrapeJobDetail(slug: string): Promise<ScrapedJob | null> {
  const url = `https://lcregister.petroleum.gov.gy/i-employment-notices/${slug}/`;
  const html = await fetchPage(url);
  if (!html) return null;

  // Title
  const titleMatch = html.match(/<h1[^>]*>([^<]{5,200})<\/h1>/i) || html.match(/<title>([^<]{5,200})<\/title>/i);
  const rawTitle = titleMatch?.[1]?.replace(/\s*[–|]\s*Local Content Register.*$/i, "").trim();
  if (!rawTitle || rawTitle.length < 4) return null;

  // Full page content
  const contentMatch = html.match(/class="[^"]*entry-content[^"]*"[^>]*>([\s\S]{20,10000}?)<\/div>/i);
  const rawContent = contentMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
  const description = rawContent?.slice(0, 2000) || null;
  const pageContent = rawContent?.slice(0, 5000) || null;

  // Company name from title, slug, or content
  const searchText = `${rawTitle} ${slug} ${rawContent?.slice(0, 3000) || ""}`;
  const matched = matchCompany(searchText);
  let companyName = matched?.name || "Unknown";
  let companySlug = matched?.slug || null;

  // Fallback: identity link
  if (companyName === "Unknown") {
    const authorMatch =
      html.match(/class="[^"]*author[^"]*"[^>]*>([^<]{3,80})</i) ||
      html.match(/Posted by[:\s]*<[^>]+>([^<]{3,80})</i) ||
      html.match(/\/identity\/([^/"']+)\/?/);
    if (authorMatch?.[1] && authorMatch[1].length > 3) {
      companyName = authorMatch[1].trim();
    }
  }

  // Job title — clean up company prefix from the page title
  let jobTitle = rawTitle;
  // Remove company name prefix: "Halliburton Vacancy – Operator Assistant" → "Operator Assistant"
  jobTitle = jobTitle
    .replace(/^[^–\-:]+[–\-:]\s*/i, "") // remove "Company Name – " prefix
    .replace(/vacancy\s*[-–:]\s*/i, "")
    .replace(/vacancy\s*notice\s*[-–:]\s*/i, "")
    .trim();
  if (jobTitle.length < 3) jobTitle = rawTitle; // fallback if over-stripped

  // Notice type
  let noticeType: string | null = null;
  if (/internship|intern|graduate program/i.test(html)) noticeType = "Internship";
  else if (/training|DEEP\s+program/i.test(html)) noticeType = "Training Program";
  else noticeType = "Vacancy";

  // Employment category
  let employmentCategory: string | null = null;
  const catSearch = (jobTitle + " " + (description || "")).toLowerCase();
  if (/engineer|technical|technician|ndt|surveyor|geologist/i.test(catSearch)) employmentCategory = "Technical";
  else if (/manager|lead|supervisor|coordinator|superintendent|director/i.test(catSearch)) employmentCategory = "Management";
  else if (/admin|clerk|accountant|analyst|officer|specialist|hr\b|logistics|planner/i.test(catSearch)) employmentCategory = "Administrative";
  else if (/welder|operator|mechanic|rigger|electrician|fitter|crane|scaffolder/i.test(catSearch)) employmentCategory = "Skilled Labour";
  else if (/warehouse|driver|helper|assistant|associate|forklift/i.test(catSearch)) employmentCategory = "Semi-Skilled Labour";
  else if (/security|cleaner|labourer/i.test(catSearch)) employmentCategory = "Unskilled Labour";

  // Qualifications — try to extract from content
  let qualifications: string | null = null;
  const qualMatch = rawContent?.match(/(?:qualifications?|requirements?|must have|you should|we require)[:\s]*([\s\S]{20,1500}?)(?=(?:closing|deadline|how to apply|submit|responsibilities|$))/i);
  if (qualMatch) qualifications = qualMatch[1].trim().slice(0, 1000);

  // Location
  const locationMatch =
    html.match(/(?:location|based in|work location)[:\s]*([^\n<]{3,60})/i) ||
    rawContent?.match(/(?:Georgetown|Offshore|Linden|New Amsterdam|Houston|Demerara)/i);
  const location = locationMatch ? (typeof locationMatch === "string" ? locationMatch : locationMatch[1]?.trim() || locationMatch[0]) : null;

  // Closing date
  const closingMatch =
    html.match(/CLOSING\s*DATE[:\s]*<[^>]*>?\s*([^<\n]{5,40})/i) ||
    html.match(/closing[\s_-]*date[:\s]*([^\n<]{5,40})/i) ||
    html.match(/(?:deadline|submit by|application deadline)[:\s]*([^\n<]{5,40})/i);
  const closingDate = normalizeDate(closingMatch?.[1]?.trim() || null);

  // Posted date
  const postedMatch =
    html.match(/(?:posted|published|date posted)[:\s]*([^\n<]{5,40})/i) ||
    html.match(/class="[^"]*date[^"]*"[^>]*>([^<]{5,30})</i);
  const postedDate = normalizeDate(postedMatch?.[1]?.trim() || null);

  // Attachments
  const allAttachments = [...html.matchAll(/href="(https?:\/\/[^"]+\.(?:pdf|docx?|xlsx?))/gi)]
    .map(m => m[1])
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const attachmentUrl = allAttachments.find(u => u.endsWith(".pdf")) || allAttachments[0] || null;

  return {
    companyName, companySlug, jobTitle, employmentCategory, noticeType,
    description, qualifications, location, closingDate, postedDate,
    sourceUrl: url, sourceSlug: slug,
    attachmentUrl, attachmentUrls: allAttachments.length > 0 ? JSON.stringify(allAttachments) : null,
    pageContent,
  };
}

// ─── MAIN ────────────────────────────────────────────────────────

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  LCS Employment Notices Scraper · LCA Desk");
  console.log("════════════════════════════════════════════\n");

  const db = getDb();

  // ── Phase 1: Collect all employment notice slugs ──
  console.log("Phase 1: Collecting employment notice slugs...\n");
  const slugs = await collectSlugs();
  console.log(`\n  Total: ${slugs.length} unique employment notices\n`);

  // ── Phase 2: Scrape individual notice pages ──
  console.log("Phase 2: Scraping notice details...\n");
  let scraped = 0;
  let skipped = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const tag = `[${String(i + 1).padStart(3, " ")}/${slugs.length}]`;
    try {
      const job = await scrapeJobDetail(slug);
      if (job) {
        const validClosing = job.closingDate && /^\d{4}-\d{2}-\d{2}$/.test(job.closingDate) ? job.closingDate : undefined;
        const validPosted = job.postedDate && /^\d{4}-\d{2}-\d{2}$/.test(job.postedDate) ? job.postedDate : undefined;
        const status = validClosing && new Date(validClosing) < new Date() ? "closed" : "open";
        await db.insert(lcsEmploymentNotices).values({
          companyName: job.companyName,
          companySlug: job.companySlug,
          jobTitle: job.jobTitle,
          employmentCategory: job.employmentCategory,
          noticeType: job.noticeType,
          description: job.description,
          qualifications: job.qualifications,
          location: job.location,
          closingDate: validClosing,
          postedDate: validPosted,
          sourceUrl: job.sourceUrl,
          sourceSlug: job.sourceSlug,
          attachmentUrl: job.attachmentUrl,
          attachmentUrls: job.attachmentUrls,
          pageContent: job.pageContent,
          status,
        }).onConflictDoUpdate({
          target: lcsEmploymentNotices.sourceSlug,
          set: {
            companyName: job.companyName,
            jobTitle: job.jobTitle,
            employmentCategory: job.employmentCategory,
            description: job.description,
            qualifications: job.qualifications,
            location: job.location,
            closingDate: validClosing,
            postedDate: validPosted,
            attachmentUrl: job.attachmentUrl,
            attachmentUrls: job.attachmentUrls,
            pageContent: job.pageContent,
            status,
            scrapedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        scraped++;
        console.log(`${tag} 👤 ${job.companyName} — ${job.jobTitle.slice(0, 50)} ${status === "closed" ? "(closed)" : ""}`);
      } else {
        skipped++;
        console.log(`${tag} ⚠  ${slug} — skipped`);
      }
    } catch (err) {
      skipped++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`${tag} ❌  ${slug} — ${msg.slice(0, 80)}`);
      if (i === 2 && scraped === 0 && skipped === 3) {
        console.log("\n  ⚠ First 3 all failed — site may be blocking.\n");
        break;
      }
    }
    await sleep(DELAY_MS);
  }

  // ── Phase 2.5: Backfill company names from existing AI summaries ──
  // Also mark jobs that are no longer on the site as closed
  const allExisting = await db.select({ id: lcsEmploymentNotices.id, sourceSlug: lcsEmploymentNotices.sourceSlug, status: lcsEmploymentNotices.status })
    .from(lcsEmploymentNotices).limit(500);

  const scrapedSlugs = new Set(slugs);
  let closed = 0;
  for (const row of allExisting) {
    if (row.status === "open" && !scrapedSlugs.has(row.sourceSlug)) {
      await db.update(lcsEmploymentNotices).set({ status: "closed", updatedAt: new Date() })
        .where(eq(lcsEmploymentNotices.id, row.id));
      closed++;
    }
  }
  if (closed > 0) console.log(`  ✓ Marked ${closed} removed jobs as closed\n`);

  const unknowns = await db.select({ id: lcsEmploymentNotices.id, aiSummary: lcsEmploymentNotices.aiSummary })
    .from(lcsEmploymentNotices)
    .where(eq(lcsEmploymentNotices.companyName, "Unknown"))
    .limit(200);

  let backfilled = 0;
  for (const row of unknowns) {
    if (!row.aiSummary) continue;
    try {
      const parsed = JSON.parse(row.aiSummary);
      const aiName = parsed.company_name;
      if (aiName && aiName !== "Unknown" && aiName.length > 2) {
        const slugMatch = matchCompany(aiName);
        await db.update(lcsEmploymentNotices).set({
          companyName: slugMatch?.name || aiName,
          companySlug: slugMatch?.slug || null,
          updatedAt: new Date(),
        }).where(eq(lcsEmploymentNotices.id, row.id));
        backfilled++;
      }
    } catch {}
  }
  if (backfilled > 0) console.log(`\n  ✓ Backfilled ${backfilled} company names from AI summaries\n`);

  // ── Phase 3: AI analysis for jobs needing it ──
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.log("\n  ⚠ ANTHROPIC_API_KEY not set — skipping AI analysis\n");
  } else {
    console.log("\n════════════════════════════════════════════");
    console.log("  Phase 3: AI Job Analysis (Claude)");
    console.log("════════════════════════════════════════════\n");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const claude = new Anthropic({ apiKey: anthropicKey });

    const needsAnalysis = await db
      .select()
      .from(lcsEmploymentNotices)
      .limit(200);

    const toAnalyze = needsAnalysis.filter(n => {
      if (!n.aiSummary) return true;
      if (n.companyName === "Unknown") return true;
      return false;
    });

    console.log(`  Found ${toAnalyze.length} jobs needing AI analysis\n`);

    let aiOk = 0;
    for (let i = 0; i < toAnalyze.length; i++) {
      const job = toAnalyze[i];
      const tag = `[${String(i + 1).padStart(3, " ")}/${toAnalyze.length}]`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentBlocks: any[] = [];

        // Try to download PDF if available
        if (job.attachmentUrl?.endsWith(".pdf")) {
          try {
            const pdfRes = await fetch(job.attachmentUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; LCADesk/1.0)" },
              signal: AbortSignal.timeout(30_000),
            });
            if (pdfRes.ok) {
              const buf = await pdfRes.arrayBuffer();
              if (buf.byteLength < 8_000_000) {
                contentBlocks.push({
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: Buffer.from(buf).toString("base64") },
                });
              }
            }
          } catch {}
        }

        const pageContext = job.pageContent || job.description || "";

        const response = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              ...contentBlocks,
              {
                type: "text",
                text: `Analyze this employment/job notice from Guyana's petroleum sector.
Job title from page: "${job.jobTitle}"
Company (if known): "${job.companyName}"

Page content:
${pageContext}

Return a JSON object:
{
  "company_name": "Full legal company name",
  "job_title": "Clean job title",
  "department": "Department if mentioned",
  "employment_type": "Full-time | Part-time | Contract | Internship | Temporary",
  "location": "Work location",
  "summary": "2-3 sentence description of the role",
  "responsibilities": ["Key responsibilities"],
  "qualifications": ["Required qualifications"],
  "experience_required": "Years/type of experience needed",
  "education_required": "Education requirements",
  "skills": ["Required skills"],
  "salary_range": "If mentioned",
  "benefits": ["Any benefits mentioned"],
  "closing_date": "YYYY-MM-DD",
  "how_to_apply": "Application instructions",
  "contact_email": "Contact email if listed",
  "guyanese_first_consideration": true or false
}

Return ONLY JSON.`,
              },
            ],
          }],
        });

        const aiText = response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const summary = JSON.parse(jsonMatch[0]);

          // Save AI summary first (always safe — it's just text)
          await db.update(lcsEmploymentNotices).set({
            aiSummary: JSON.stringify(summary),
            updatedAt: new Date(),
          }).where(eq(lcsEmploymentNotices.id, job.id));

          // Then try updating other fields individually so one bad value doesn't block the rest
          if (job.companyName === "Unknown" && summary.company_name) {
            try {
              const slugMatch = matchCompany(summary.company_name);
              await db.update(lcsEmploymentNotices).set({
                companyName: slugMatch?.name || summary.company_name,
                companySlug: slugMatch?.slug || null,
              }).where(eq(lcsEmploymentNotices.id, job.id));
            } catch {}
          }

          if (summary.closing_date && !job.closingDate) {
            const normalized = normalizeDate(String(summary.closing_date));
            if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
              try {
                await db.update(lcsEmploymentNotices).set({
                  closingDate: normalized,
                  status: new Date(normalized) < new Date() ? "closed" : "open",
                }).where(eq(lcsEmploymentNotices.id, job.id));
              } catch { /* invalid date despite validation — skip */ }
            }
          }
          console.log(`${tag} 🤖 ${summary.company_name || job.companyName} — ${job.jobTitle.slice(0, 40)}`);
          aiOk++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // If it's a DB error, try saving just the aiSummary as a fallback
        if (msg.includes("Failed query")) {
          try {
            const aiText2 = `AI analysis completed but DB update failed: ${msg.slice(0, 100)}`;
            await db.update(lcsEmploymentNotices).set({ aiSummary: aiText2, updatedAt: new Date() }).where(eq(lcsEmploymentNotices.id, job.id));
          } catch {}
        }
        console.log(`${tag} ❌  ${msg.slice(0, 80)} — ${job.sourceSlug}`);
      }

      await sleep(1500);
    }

    console.log(`\n  AI analysis: ${aiOk} succeeded`);
  }

  console.log("\n════════════════════════════════════════════");
  console.log("  Complete");
  console.log("════════════════════════════════════════════");
  console.log(`  👤 Jobs scraped:    ${scraped}`);
  console.log(`  ⚠ Skipped:         ${skipped}`);
  console.log();
  process.exit(0);
}

main().catch((err) => { console.error("\nFatal error:", err); process.exit(1); });
