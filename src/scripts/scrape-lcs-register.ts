/**
 * LCS Register Scraper
 * Scrapes Guyana's Local Content Register and populates the lcs_register table.
 *
 * Run with: npm run scrape:lcs
 *
 * Uses Playwright ONLY for Phase 1 (collecting slugs from the JS-rendered listing page).
 * Uses plain fetch() for Phase 2 (scraping individual static profile pages).
 */

import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { lcsRegister } from "../server/db/schema";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── CONFIG ───────────────────────────────────────────────────────

const REGISTER_URL =
  "https://lcregister.petroleum.gov.gy/local-content-register/";
const IDENTITY_BASE = "https://lcregister.petroleum.gov.gy/identity/";
const DELAY_MS = 700;

// ─── DATABASE ─────────────────────────────────────────────────────

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, {
    schema: { lcsRegister },
  });
}

// ─── PHASE 1: COLLECT ALL SLUGS ───────────────────────────────────

async function collectAllSlugs(): Promise<string[]> {
  console.log("Phase 1: Collecting company slugs from register...");
  console.log("Launching Chromium (headless)...\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(REGISTER_URL, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    await page.waitForSelector('a[href*="/identity/"]', { timeout: 30_000 });

    let previousHeight = 0;
    let scrollRound = 0;

    while (scrollRound < 25) {
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight)
      );
      await page.waitForTimeout(1_500);

      const currentHeight = await page.evaluate(
        () => document.body.scrollHeight
      );
      if (currentHeight === previousHeight) break;

      previousHeight = currentHeight;
      scrollRound++;
      process.stdout.write(
        `\r  Scrolling to load all companies... round ${scrollRound}`
      );
    }

    try {
      const moreBtn = page.locator("text=More results");
      if (await moreBtn.isVisible({ timeout: 3_000 })) {
        await moreBtn.click();
        await page.waitForTimeout(2_000);
        console.log('\n  Clicked "More results" button');
      }
    } catch {
      // No more-results button
    }

    const slugs = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll('a[href*="/identity/"]')
      );
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
  scrapeError: string | null;
}

async function scrapeProfile(slug: string): Promise<ScrapedProfile> {
  const url = `${IDENTITY_BASE}${slug}/`;
  const profile: ScrapedProfile = {
    certId: null,
    profileSlug: slug,
    profileUrl: url,
    legalName: slug,
    tradingName: null,
    status: null,
    expirationDate: null,
    address: null,
    email: null,
    website: null,
    phone: null,
    serviceCategories: [],
    scrapeError: null,
  };

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LCADesk-Scraper/1.0; +https://lcadesk.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      profile.scrapeError = `HTTP ${res.status}`;
      return profile;
    }

    const html = await res.text();

    // Legal Name
    const nameMatch =
      html.match(
        /Name of Business[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,300})/i
      ) || html.match(/Name of Business[:\s]*<\/[^>]+>\s*([^<]{2,300})/i);
    if (nameMatch?.[1]) profile.legalName = nameMatch[1].trim();

    // Trading Name
    const tradingMatch =
      html.match(/Trading Name[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,300})/i) ||
      html.match(/Trading Name[:\s]*<\/[^>]+>\s*([^<]{2,300})/i);
    if (tradingMatch?.[1]) profile.tradingName = tradingMatch[1].trim();

    // Status
    const statusMatch =
      html.match(/class="user-status[^"]*">\s*([^<]+)</i) ||
      html.match(/Status[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{2,50})/i);
    if (statusMatch?.[1])
      profile.status = statusMatch[1].trim().toLowerCase();

    // Certification ID — LCSR- + 8 hex chars
    const certMatch = html.match(/LCSR-([a-f0-9]{8})/i);
    if (certMatch) profile.certId = `LCSR-${certMatch[1].toLowerCase()}`;

    // Expiration Date
    const expiryMatch = html.match(
      /Expir(?:ation|y) Date[:\s]*<\/[^>]+>[\s\S]{0,100}?(\d{4}-\d{2}-\d{2})/i
    );
    if (expiryMatch?.[1]) profile.expirationDate = expiryMatch[1];

    // Address
    const addressMatch =
      html.match(/Address[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{5,300})/i) ||
      html.match(/Address[:\s]*<\/[^>]+>\s*([^<]{5,300})/i);
    if (addressMatch?.[1]) profile.address = addressMatch[1].trim();

    // Email
    const emailMatch =
      html.match(/href="mailto:([^"]+)"/i) ||
      html.match(
        /Business [Ee]mail[:\s]*<\/[^>]+>[\s\S]{0,100}?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
      );
    if (emailMatch?.[1]) profile.email = emailMatch[1].trim();

    // Website
    const websiteMatch = html.match(
      /Business Website[:\s]*<\/[^>]+>[\s\S]{0,200}?href="(https?:\/\/(?!lcregister)[^"]+)"/i
    );
    if (websiteMatch?.[1]) profile.website = websiteMatch[1].trim();

    // Phone
    const phoneMatch =
      html.match(/Business Tel[:\s]*<\/[^>]+>\s*<[^>]+>\s*([^<]{3,50})/i) ||
      html.match(/Business Tel[:\s]*<\/[^>]+>\s*([^<]{3,50})/i);
    if (phoneMatch?.[1]) profile.phone = phoneMatch[1].trim();

    // Service Categories
    const catTagMatches = html.match(
      /class="supplier-cat-tags[^"]*">([^<]+)</gi
    );
    if (catTagMatches && catTagMatches.length > 0) {
      profile.serviceCategories = catTagMatches
        .map((m) => {
          const inner = m.match(/>([^<]+)</);
          return inner?.[1]?.trim() ?? null;
        })
        .filter((c): c is string => c !== null && c.length > 2);
    } else {
      const servicesBlock = html.match(
        /Types of Services[^<]*<\/[^>]+>([\s\S]{1,600}?)(?:<footer|id="footer|class="footer)/i
      );
      if (servicesBlock?.[1]) {
        const raw = servicesBlock[1]
          .replace(/<[^>]+>/g, "\n")
          .split("\n")
          .map((s) => s.trim())
          .filter(
            (s) =>
              s.length > 3 &&
              !s.includes("{") &&
              !s.includes("function") &&
              !s.startsWith(".")
          );
        profile.serviceCategories = raw.slice(0, 15);
      }
    }
  } catch (err) {
    profile.scrapeError =
      err instanceof Error ? err.message : "Unknown fetch error";
  }

  return profile;
}

// ─── UPSERT TO DATABASE ───────────────────────────────────────────

async function upsertProfile(
  db: ReturnType<typeof getDb>,
  profile: ScrapedProfile
) {
  try {
    await db
      .insert(lcsRegister)
      .values({
        certId: profile.certId,
        profileSlug: profile.profileSlug,
        profileUrl: profile.profileUrl,
        legalName: profile.legalName,
      tradingName: profile.tradingName,
      status: profile.status,
      expirationDate: profile.expirationDate ?? undefined,
      address: profile.address,
      email: profile.email,
      website: profile.website,
      phone: profile.phone,
      serviceCategories: profile.serviceCategories,
      scrapedAt: new Date(),
      scrapeError: profile.scrapeError,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: lcsRegister.profileSlug,
      set: {
        certId: profile.certId,
        legalName: profile.legalName,
        tradingName: profile.tradingName,
        status: profile.status,
        expirationDate: profile.expirationDate ?? undefined,
        address: profile.address,
        email: profile.email,
        website: profile.website,
        phone: profile.phone,
        serviceCategories: profile.serviceCategories,
        scrapedAt: new Date(),
        scrapeError: profile.scrapeError,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    // Duplicate cert_id across different companies — skip silently
    const message = err instanceof Error ? err.message : "";
    if (message.includes("duplicate key") || message.includes("unique")) {
      profile.scrapeError = "duplicate_cert_id";
    } else {
      throw err;
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  LCS Register Scraper  ·  LCA Desk");
  console.log("════════════════════════════════════════════\n");

  const db = getDb();

  // Phase 1: collect slugs
  const slugs = await collectAllSlugs();

  if (slugs.length === 0) {
    console.error(
      "ERROR: No slugs collected — the register page structure may have changed."
    );
    process.exit(1);
  }

  // Phase 2: scrape each profile
  console.log(`Phase 2: Scraping ${slugs.length} profiles...\n`);

  let ok = 0;
  let noCert = 0;
  let errors = 0;

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const tag = `[${String(i + 1).padStart(4, " ")}/${slugs.length}]`;

    const profile = await scrapeProfile(slug);
    await upsertProfile(db, profile);

    if (profile.scrapeError) {
      errors++;
      console.log(`${tag} ❌  ${slug} — ${profile.scrapeError}`);
    } else if (!profile.certId) {
      noCert++;
      console.log(`${tag} ⚠   ${profile.legalName} (no cert ID found)`);
    } else {
      ok++;
      console.log(`${tag} ✓   ${profile.certId}  ${profile.legalName}`);
    }

    await sleep(DELAY_MS);
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

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
