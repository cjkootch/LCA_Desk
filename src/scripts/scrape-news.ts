/**
 * Industry News Scraper — LCA Desk
 *
 * Scrapes petroleum sector news from:
 * - Kaieteur News (Oil & Gas section)
 * - OilNOW (Featured articles)
 *
 * Enriches each article with AI-generated:
 * - Summary (2-3 sentences)
 * - Category classification
 * - Relevance score (1-10 for Guyana petroleum)
 * - Companies mentioned
 *
 * Usage: npm run scrape:news
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

const { industryNews } = schema;

interface ScrapedArticle {
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string | null;
  imageUrl: string | null;
}

// ─── KAIETEUR NEWS SCRAPER ──────────────────────────────────────

async function scrapeKaieteurNews(): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];

  for (let page = 1; page <= 3; page++) {
    const url = page === 1
      ? "https://www.kaieteurnewsonline.com/category/news/oil-gas/"
      : `https://www.kaieteurnewsonline.com/category/news/oil-gas/page/${page}/`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LCA Desk News Scraper (compliance platform)" },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract article links and titles from listing page
      const articleMatches = html.matchAll(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
      for (const match of articleMatches) {
        const sourceUrl = match[1];
        const title = match[2].replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&#038;/g, "&").replace(/&amp;/g, "&").trim();

        // Extract date from URL pattern: /YYYY/MM/DD/
        const dateMatch = sourceUrl.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        const publishedAt = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

        articles.push({
          title,
          summary: "",
          sourceUrl,
          sourceName: "Kaieteur News",
          publishedAt,
          imageUrl: null,
        });
      }
    } catch (err) {
      console.log(`  ⚠ Kaieteur page ${page} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return articles;
}

// ─── OILNOW SCRAPER ────────────────────────────────────────────

async function scrapeOilNow(): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];

  for (let page = 1; page <= 3; page++) {
    const url = page === 1
      ? "https://oilnow.gy/category/featured/"
      : `https://oilnow.gy/category/featured/page/${page}/`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LCA Desk News Scraper (compliance platform)" },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Extract articles — OilNOW uses standard WordPress markup
      const articleMatches = html.matchAll(/<h[23][^>]*[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
      for (const match of articleMatches) {
        const sourceUrl = match[1];
        if (!sourceUrl.includes("oilnow.gy")) continue;
        const title = match[2].replace(/&#8217;/g, "'").replace(/&#8211;/g, "–").replace(/&#038;/g, "&").replace(/&amp;/g, "&").trim();

        // Try to extract date from URL
        const dateMatch = sourceUrl.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        const publishedAt = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

        // Skip navigation/category links
        if (title.length < 15 || title.includes("Category") || title.includes("Menu")) continue;

        articles.push({
          title,
          summary: "",
          sourceUrl,
          sourceName: "OilNOW",
          publishedAt,
          imageUrl: null,
        });
      }
    } catch (err) {
      console.log(`  ⚠ OilNOW page ${page} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return articles;
}

// ─── FETCH ARTICLE CONTENT ──────────────────────────────────────

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LCA Desk News Scraper (compliance platform)" },
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Strip HTML tags, get text content
    const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
      || html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (!bodyMatch) return "";

    return bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000); // First 3000 chars for AI
  } catch {
    return "";
  }
}

// ─── AI ENRICHMENT ──────────────────────────────────────────────

async function enrichArticle(title: string, content: string): Promise<{
  summary: string;
  category: string;
  relevanceScore: number;
  companies: string[];
}> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Analyze this Guyana petroleum sector news article.

Title: ${title}
Content: ${content.slice(0, 2000)}

Return JSON only:
{
  "summary": "2-3 sentence summary focused on what matters for local content compliance",
  "category": "one of: contracts, policy, production, local_content, employment, general",
  "relevance_score": 1-10 (10 = directly about Guyana local content, 1 = barely related),
  "companies": ["list of companies mentioned"]
}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { summary: "", category: "general", relevanceScore: 5, companies: [] };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || "",
      category: parsed.category || "general",
      relevanceScore: parsed.relevance_score || 5,
      companies: parsed.companies || [],
    };
  } catch {
    return { summary: "", category: "general", relevanceScore: 5, companies: [] };
  }
}

// ─── MAIN ───────────────────────────────────────────────────────

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("  Industry News Scraper  ·  LCA Desk");
  console.log("════════════════════════════════════════════\n");

  const db = getDb();

  // Phase 1: Scrape listings
  console.log("Phase 1: Scraping news sources...\n");

  const kaieteur = await scrapeKaieteurNews();
  console.log(`  Kaieteur News: ${kaieteur.length} articles found`);

  const oilnow = await scrapeOilNow();
  console.log(`  OilNOW: ${oilnow.length} articles found`);

  const allArticles = [...kaieteur, ...oilnow];
  console.log(`  Total: ${allArticles.length} articles\n`);

  // Phase 2: Upsert to DB (skip existing)
  console.log("Phase 2: Saving to database...\n");
  let inserted = 0;
  let skipped = 0;

  for (const article of allArticles) {
    try {
      await db.insert(industryNews).values({
        title: article.title,
        summary: article.summary || null,
        sourceUrl: article.sourceUrl,
        sourceName: article.sourceName,
        publishedAt: article.publishedAt,
        imageUrl: article.imageUrl,
      }).onConflictDoNothing();
      inserted++;
    } catch {
      skipped++;
    }
  }

  console.log(`  Inserted: ${inserted}, Skipped: ${skipped}\n`);

  // Phase 3: AI enrichment for articles without summaries
  console.log("Phase 3: AI enrichment...\n");

  const needsEnrichment = await db.select()
    .from(industryNews)
    .where(eq(industryNews.aiSummary, ""))
    .limit(30);

  // Also get ones with null aiSummary
  const needsEnrichment2 = await db.select()
    .from(industryNews)
    .limit(200);

  const toEnrich = needsEnrichment2.filter(a => !a.aiSummary);

  console.log(`  Found ${toEnrich.length} articles needing AI enrichment\n`);

  let enriched = 0;
  for (const article of toEnrich.slice(0, 30)) {
    try {
      const content = await fetchArticleContent(article.sourceUrl);
      if (!content) {
        console.log(`  ⚠ No content for: ${article.title.slice(0, 50)}`);
        continue;
      }

      const ai = await enrichArticle(article.title, content);

      await db.update(industryNews).set({
        aiSummary: ai.summary,
        summary: ai.summary,
        category: ai.category,
        relevanceScore: ai.relevanceScore,
        companies: ai.companies.length > 0 ? ai.companies : null,
      }).where(eq(industryNews.id, article.id));

      console.log(`  🤖 [${ai.relevanceScore}/10] ${article.title.slice(0, 50)}`);
      enriched++;

      // Rate limit
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.log(`  ❌ ${article.title.slice(0, 40)}: ${err instanceof Error ? err.message.slice(0, 50) : "error"}`);
    }
  }

  console.log(`\n  AI enrichment: ${enriched} articles processed`);

  console.log("\n════════════════════════════════════════════");
  console.log("  Complete");
  console.log("════════════════════════════════════════════");
  console.log(`  Articles found:    ${allArticles.length}`);
  console.log(`  New to database:   ${inserted}`);
  console.log(`  AI enriched:       ${enriched}`);
}

main().catch(console.error);
