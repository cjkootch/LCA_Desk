/**
 * LCS Register Scraper
 * Scrapes Guyana's Local Content Register and populates the lcs_register table.
 *
 * Run with: npm run scrape:lcs
 *
 * Phase 1: Playwright collects slugs from JS-rendered listing (scrolls until no more)
 * Phase 2: fetch() scrapes individual static profile pages
 * Phase 3: AI enrichment via Claude for structured company analysis
 */

import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { lcsRegister } from "../server/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const REGISTER_URL = "https://lcregister.petroleum.gov.gy/local-content-register/";
const IDENTITY_BASE = "https://lcregister.petroleum.gov.gy/identity/";
const DELAY_MS = 700;

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env.local");
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema: { lcsRegister } });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── PHASE 1: COLLECT ALL SLUGS ─────────────────────────────────

async function collectAllSlugs(): Promise<string[]> {
  console.log("Phase 1: Collecting company slugs from register...");
  console.log("Launching Chromium (headless)...\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(REGISTER_URL, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector('a[href*="/identity/"]', { timeout: 30_000 });

    let previousCount = 0;
    let scrollRound = 0;
    let staleRounds = 0;

    // Scroll aggressively until no new companies load
    while (scrollRound < 100 && staleRounds < 5) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2_000);

      const currentCount = await page.evaluate(() =>
        document.querySelectorAll('a[href*="/identity/"]').length
      );

      if (currentCount === previousCount) {
        staleRounds++;
        // Try clicking "More results" button
        try {
          const moreBtn = page.locator("text=More results");
          if (await moreBtn.isVisible({ timeout: 1_000 })) {
            await moreBtn.click();
            await page.waitForTimeout(3_000);
            staleRounds = 0; // reset since we clicked
            console.log(`\n  Clicked "More results" — loading more...`);
          }
        } catch {}
      } else {
        staleRounds = 0;
      }

      previousCount = currentCount;
      scrollRound++;
      process.stdout.write(`\r  Scrolling... round ${scrollRound}, ${currentCount} companies found`);
    }

    const slugs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/identity/"]'));
      const seen = new Set<string>();
      links.forEach((link) => {
        const href = (link as HTMLAnchorElement).href;
        const match = href.match(/\/identity\/([^/]+)\/?$/);
        if (match?.[1]) seen.add(match[1]);
      });
      return Array.from(seen);
    });

    console.log(`\n\n  Found ${slugs.length} company slugs\n`);
    return slugs;
  } finally {
    await browser.close();
  }
}

// ─── PHASE 2: SCRAPE INDIVIDUAL PROFILES ─────────────────────────

interface ScrapedProfile {
  certId: string | null;
  profileSlug: string;
  profileUrl: string;
  legalName: string;
  tradingName: string | null;
  status: string | null;
  expirationDate: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  serviceCategories: string[];
  pageContent: string | null;
  scrapeError: string | null;
}

async function scrapeProfile(slug: string): Promise<ScrapedProfile> {
  const url = `${IDENTITY_BASE}${slug}/`;
  const profile: ScrapedProfile = {
    certId: null, profileSlug: slug, profileUrl: url, legalName: slug,
    tradingName: null, status: null, expirationDate: null, address: null,
    email: null, website: null, phone: null, serviceCategories: [],
    pageContent: null, scrapeError: null,
  };

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LCADesk-Scraper/1.0; +https://lcadesk.com)", Accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { profile.scrapeError = `HTTP ${res.status}`; return profile; }
    const html = await res.text();

    // Extract full page text for AI
    const contentMatch = html.match(/class="[^"]*entry-content[^"]*"[^>]*>([\s\S]{20,10000}?)<\/div>/i) ||
      html.match(/<main[^>]*>([\s\S]{20,10000}?)<\/main>/i);
    const rawContent = contentMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    profile.pageContent = rawContent?.slice(0, 5000) || null;

    // Legal Name
    const nameMatch = html.match(/Name of Business[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,300})/i) ||
      html.match(/Name of Business[:\s]*<\/[^>]+>\s*([^<]{2,300})/i);
    if (nameMatch?.[1]) profile.legalName = nameMatch[1].trim();

    // Trading Name
    const tradingMatch = html.match(/Trading Name[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,300})/i) ||
      html.match(/Trading Name[:\s]*<\/[^>]+>\s*([^<]{2,300})/i);
    if (tradingMatch?.[1]) profile.tradingName = tradingMatch[1].trim();

    // Status
    const statusMatch = html.match(/class="user-status[^"]*">\s*([^<]+)</i) ||
      html.match(/Status[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,50})/i);
    if (statusMatch?.[1]) profile.status = statusMatch[1].trim();

    // Cert ID
    const certMatch = html.match(/LCSR-([a-f0-9]{8})/i);
    if (certMatch) profile.certId = `LCSR-${certMatch[1].toLowerCase()}`;

    // Expiration Date
    const expiryMatch = html.match(/Expir(?:ation|y) Date[:\s]*<\/[^>]+>[\s\S]{0,100}?(\d{4}-\d{2}-\d{2})/i);
    if (expiryMatch?.[1]) profile.expirationDate = expiryMatch[1];

    // Address
    const addressMatch = html.match(/Address[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{5,300})/i) ||
      html.match(/Address[:\s]*<\/[^>]+>\s*([^<]{5,300})/i);
    if (addressMatch?.[1]) profile.address = addressMatch[1].trim();

    // Email
    const emailMatch = html.match(/href="mailto:([^"]+)"/i) ||
      html.match(/Business [Ee]mail[:\s]*<\/[^>]+>[\s\S]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (emailMatch?.[1]) profile.email = emailMatch[1].trim();

    // Website
    const websiteMatch = html.match(/Business Website[:\s]*<\/[^>]+>[\s\S]{0,200}?href="(https?:\/\/(?!lcregister)[^"]+)"/i);
    if (websiteMatch?.[1]) profile.website = websiteMatch[1].trim();

    // Phone
    const phoneMatch = html.match(/Business Tel[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{3,50})/i) ||
      html.match(/Business Tel[:\s]*<\/[^>]+>\s*([^<]{3,50})/i);
    if (phoneMatch?.[1]) profile.phone = phoneMatch[1].trim();

    // Service Categories
    const catTagMatches = html.match(/class="supplier-cat-tags[^"]*">([^<]+)</gi);
    if (catTagMatches?.length) {
      profile.serviceCategories = catTagMatches
        .map(m => m.match(/>([^<]+)</)?.[1]?.trim())
        .filter((c): c is string => !!c && c.length > 2);
    } else {
      const servicesBlock = html.match(/Types of Services[^<]*<\/[^>]+>([\s\S]{1,600}?)(?:<footer|id="footer|class="footer)/i);
      if (servicesBlock?.[1]) {
        profile.serviceCategories = servicesBlock[1]
          .replace(/<[^>]+>/g, "\n").split("\n")
          .map(s => s.trim())
          .filter(s => s.length > 3 && !s.includes("{") && !s.includes("function") && !s.startsWith("."))
          .slice(0, 15);
      }
    }
  } catch (err) {
    profile.scrapeError = err instanceof Error ? err.message : "Unknown error";
  }

  return profile;
}

// ─── UPSERT ──────────────────────────────────────────────────────

async function upsertProfile(db: ReturnType<typeof getDb>, profile: ScrapedProfile) {
  try {
    await db.insert(lcsRegister).values({
      certId: profile.certId, profileSlug: profile.profileSlug, profileUrl: profile.profileUrl,
      legalName: profile.legalName, tradingName: profile.tradingName, status: profile.status,
      expirationDate: profile.expirationDate ?? undefined, address: profile.address,
      email: profile.email, website: profile.website, phone: profile.phone,
      serviceCategories: profile.serviceCategories, pageContent: profile.pageContent,
      scrapedAt: new Date(), scrapeError: profile.scrapeError, updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: lcsRegister.profileSlug,
      set: {
        certId: profile.certId, legalName: profile.legalName, tradingName: profile.tradingName,
        status: profile.status, expirationDate: profile.expirationDate ?? undefined,
        address: profile.address, email: profile.email, website: profile.website,
        phone: profile.phone, serviceCategories: profile.serviceCategories,
        pageContent: profile.pageContent,
        scrapedAt: new Date(), scrapeError: profile.scrapeError, updatedAt: new Date(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("duplicate key") && !msg.includes("unique")) throw err;
  }
}

// ─── MAIN ────────────────────────────────────────────────────────

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  LCS Register Scraper  ·  LCA Desk");
  console.log("════════════════════════════════════════════\n");

  const db = getDb();

  // Phase 1: collect slugs
  const slugs = await collectAllSlugs();
  if (slugs.length === 0) { console.error("ERROR: No slugs collected"); process.exit(1); }

  // Phase 2: scrape each profile
  console.log(`Phase 2: Scraping ${slugs.length} profiles...\n`);
  let ok = 0, noCert = 0, errors = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const tag = `[${String(i + 1).padStart(4, " ")}/${slugs.length}]`;
    const profile = await scrapeProfile(slug);
    try {
      await upsertProfile(db, profile);
    } catch (dbErr) {
      errors++;
      console.log(`${tag} ❌  ${slug} — DB error: ${dbErr instanceof Error ? dbErr.message.slice(0, 60) : "unknown"}`);
      await sleep(2000); // wait a bit on DB errors
      continue;
    }

    if (profile.scrapeError) { errors++; console.log(`${tag} ❌  ${slug} — ${profile.scrapeError}`); }
    else if (!profile.certId) { noCert++; console.log(`${tag} ⚠   ${profile.legalName} (no cert ID)`); }
    else { ok++; console.log(`${tag} ✓   ${profile.certId}  ${profile.legalName}`); }

    await sleep(DELAY_MS);
  }

  // Phase 3: AI enrichment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.log("\n  ⚠ ANTHROPIC_API_KEY not set — skipping AI enrichment\n");
  } else {
    console.log("\n════════════════════════════════════════════");
    console.log("  Phase 3: AI Company Enrichment (Claude)");
    console.log("════════════════════════════════════════════\n");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const claude = new Anthropic({ apiKey: anthropicKey });

    // Get companies needing enrichment
    const allCompanies = await db.select({
      id: lcsRegister.id,
      legalName: lcsRegister.legalName,
      pageContent: lcsRegister.pageContent,
      aiSummary: lcsRegister.aiSummary,
      certId: lcsRegister.certId,
      status: lcsRegister.status,
      serviceCategories: lcsRegister.serviceCategories,
    }).from(lcsRegister).limit(2000);

    const needsEnrichment = allCompanies.filter(c => !c.aiSummary);
    console.log(`  Found ${needsEnrichment.length} companies needing AI enrichment\n`);

    let aiOk = 0;
    for (let i = 0; i < needsEnrichment.length; i++) {
      const company = needsEnrichment[i];
      const tag = `[${String(i + 1).padStart(4, " ")}/${needsEnrichment.length}]`;

      try {
        const context = [
          `Company: ${company.legalName}`,
          company.certId ? `LCS Certificate: ${company.certId}` : null,
          company.status ? `Registration Status: ${company.status}` : null,
          company.serviceCategories?.length ? `Service Categories: ${company.serviceCategories.join(", ")}` : null,
          company.pageContent ? `\nProfile page content:\n${company.pageContent}` : null,
        ].filter(Boolean).join("\n");

        const response = await claude.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{
            role: "user",
            content: `Analyze this LCS-registered company from Guyana's petroleum sector. Based on the company name, service categories, and any available profile data, provide a structured analysis.

${context}

Return JSON:
{
  "company_description": "1-2 sentence description of what this company does",
  "industry_focus": "Primary industry focus area",
  "company_type": "Contractor | Sub-Contractor | Supplier | Service Provider | Consultant",
  "likely_filing_obligation": true or false,
  "employee_count_estimate": "Estimate if mentioned, else null",
  "years_in_business": "If mentioned, else null",
  "key_services": ["Top 3-5 specific services they provide"],
  "parent_company": "If mentioned, else null",
  "notable_clients": ["If any clients/partners mentioned"],
  "guyana_presence": "Description of their Guyana operations"
}

Return ONLY JSON.`,
          }],
        });

        const aiText = response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          await db.update(lcsRegister).set({
            aiSummary: jsonMatch[0],
            updatedAt: new Date(),
          }).where(eq(lcsRegister.id, company.id));
          console.log(`${tag} 🤖 ${company.legalName}`);
          aiOk++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`${tag} ❌  ${msg.slice(0, 60)} — ${company.legalName}`);
      }

      await sleep(1000); // rate limit
      if ((i + 1) % 50 === 0) console.log(`  ... ${i + 1}/${needsEnrichment.length} enriched\n`);
    }

    console.log(`\n  AI enrichment: ${aiOk} succeeded`);
  }

  // Summary
  console.log("\n════════════════════════════════════════════");
  console.log("  Complete");
  console.log("════════════════════════════════════════════");
  console.log(`  ✓  Successfully scraped:  ${ok}`);
  console.log(`  ⚠  No cert ID found:      ${noCert}`);
  console.log(`  ❌  Errors:                ${errors}`);
  console.log(`  Total processed:           ${slugs.length}`);
  console.log();
  process.exit(0);
}

main().catch((err) => { console.error("\nFatal error:", err); process.exit(1); });
