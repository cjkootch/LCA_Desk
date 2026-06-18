/**
 * Read-only analysis of trial tenants.
 *
 * A "trial" = tenants.trialEndsAt IS NOT NULL AND tenants.stripeSubscriptionId IS NULL
 * (matches getBillingAccess in src/lib/plans.ts).
 *
 * Run:  DATABASE_URL=... npx tsx src/scripts/analyze-trials.ts
 *
 * Does NOT write anything to the DB.
 */
import "dotenv/config";
import { isNull, isNotNull, and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { tenants, tenantMembers, users, entities } from "../server/db/schema";

// Free / personal email providers — a strong signal the signup is an individual.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "mail.com", "yandex.com",
  "zoho.com", "hey.com",
]);

function domainOf(email: string | null): string {
  if (!email) return "";
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

// Domains that are NOT a real business: placeholder/test domains, the demo seed,
// and obvious typos of free providers (e.g. 4gmail.com, gmail.come, gmale.com).
const JUNK_DOMAINS = new Set([
  "company.gy", "example.com", "email.com", "emil.com", "test.com",
  "lcadesk.com", "mail.com",
]);
const FREE_ROOT = /(gmail|googlemail|gmale|gmai|gmial|gmil|hotmail|hotmal|hotmai|yahoo|yaho|ymail|outlook|outlok|icloud|proton|aol|gmx|yandex|zoho|emil|email|moblie|mobile)/i;

/** A genuine business domain: not free, not a typo of a free provider, not junk/test. */
function isCorporateDomain(domain: string): boolean {
  if (!domain) return false;
  if (FREE_EMAIL_DOMAINS.has(domain)) return false;
  if (JUNK_DOMAINS.has(domain)) return false;
  if (FREE_ROOT.test(domain)) return false; // catches 4gmail.com, gmail.come, gmale.com, *.emil.com
  if (/\.(local|test|invalid|example)$/.test(domain)) return false;
  return domain.includes("."); // must at least look like a real FQDN
}

// Tiers, strongest business signal first.
type Tier = "corporate" | "named_business" | "individual";

/** Heuristic: how strongly does this trial look like a real business? */
function classify(tenantName: string, ownerEmail: string | null, entityCount: number): {
  tier: Tier;
  reasons: string[];
} {
  const reasons: string[] = [];
  const domain = domainOf(ownerEmail);
  const corporate = isCorporateDomain(domain);

  if (corporate) reasons.push(`corporate email domain (@${domain})`);
  else if (domain) reasons.push(`personal/junk email domain (@${domain})`);

  // Company-name signals: org suffixes or business-y words.
  const name = (tenantName || "").trim();
  const corpSuffix = /\b(inc|ltd|llc|llp|plc|corp|co|company|companies|group|holdings|services|solutions|energy|oil|gas|petroleum|mining|construction|engineering|consult\w*|trading|logistics|enterprises?|limited|farm|n\.?v\.?|s\.?a\.?)\b/i;
  const hasCorpName = corpSuffix.test(name);

  if (hasCorpName) reasons.push(`company-style name ("${name}")`);
  if (entityCount > 0) reasons.push(`${entityCount} entit${entityCount === 1 ? "y" : "ies"} created`);

  // Tier A: a genuine corporate email domain is the strongest, hardest-to-fake signal.
  if (corporate) return { tier: "corporate", reasons };
  // Tier B: business-style name on a free/personal email — likely a small business.
  if (hasCorpName) return { tier: "named_business", reasons };
  // Otherwise: an individual.
  return { tier: "individual", reasons };
}

async function main() {
  // All trial tenants.
  const trialTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      trialEndsAt: tenants.trialEndsAt,
      createdAt: tenants.createdAt,
      stripeCustomerId: tenants.stripeCustomerId,
    })
    .from(tenants)
    .where(and(isNotNull(tenants.trialEndsAt), isNull(tenants.stripeSubscriptionId)));

  const now = Date.now();
  type Row = {
    tier: Tier;
    name: string;
    owner: string;
    email: string;
    members: number;
    entities: number;
    daysLeft: number | null;
    status: string;
    reasons: string[];
    createdAt: Date | null;
  };
  const rows: Row[] = [];

  for (const t of trialTenants) {
    // Owner = first member by created date (fallback: any member).
    const members = await db
      .select({
        userName: users.name,
        email: users.email,
        role: tenantMembers.role,
        memberCreatedAt: tenantMembers.createdAt,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.userId))
      .where(eq(tenantMembers.tenantId, t.id));

    const owner =
      members.find((m) => m.role === "owner") ??
      members.slice().sort((a, b) => (a.memberCreatedAt?.getTime() ?? 0) - (b.memberCreatedAt?.getTime() ?? 0))[0] ??
      null;

    const entityRows = await db
      .select({ id: entities.id, legalName: entities.legalName })
      .from(entities)
      .where(eq(entities.tenantId, t.id));

    const daysLeft = t.trialEndsAt
      ? Math.ceil((t.trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24))
      : null;

    const { tier, reasons } = classify(t.name, owner?.email ?? null, entityRows.length);

    rows.push({
      tier,
      name: t.name,
      owner: owner?.userName ?? "—",
      email: owner?.email ?? "—",
      members: members.length,
      entities: entityRows.length,
      daysLeft,
      status: daysLeft === null ? "?" : daysLeft > 0 ? "active" : "expired",
      reasons,
      createdAt: t.createdAt,
    });
  }

  const order: Record<Tier, number> = { corporate: 0, named_business: 1, individual: 2 };
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return order[a.tier] - order[b.tier];
    return (b.entities - a.entities) || (b.members - a.members);
  });

  const corporate = rows.filter((r) => r.tier === "corporate");
  const named = rows.filter((r) => r.tier === "named_business");
  const individuals = rows.filter((r) => r.tier === "individual");
  const active = rows.filter((r) => r.status === "active").length;
  const withEntity = rows.filter((r) => r.entities > 0).length;

  console.log(`\n=== TRIAL TENANTS: ${rows.length} total (${active} active / ${rows.length - active} expired) ===`);
  console.log(`Engaged (created ≥1 entity): ${withEntity}`);
  console.log(`Tier A — corporate email domain: ${corporate.length}`);
  console.log(`Tier B — business name, personal email: ${named.length}`);
  console.log(`Individuals: ${individuals.length}\n`);

  const print = (label: string, list: typeof rows) => {
    console.log(`\n──────── ${label} (${list.length}) ────────`);
    for (const r of list) {
      console.log(
        `• ${r.name}  [${r.status}${r.daysLeft !== null ? `, ${r.daysLeft}d` : ""}]\n` +
        `    owner: ${r.owner} <${r.email}>  | members: ${r.members} | entities: ${r.entities}\n` +
        `    signals: ${r.reasons.join("; ") || "none"}`
      );
    }
  };

  print("TIER A — LIKELY REAL COMPANIES (corporate email domain)", corporate);
  print("TIER B — POSSIBLE SMALL BUSINESSES (business name, personal email)", named);
  // Individuals are the long tail — print a compact count by status instead of all 150+.
  console.log(`\n──────── INDIVIDUALS (${individuals.length}) ────────`);
  console.log(`  active: ${individuals.filter((r) => r.status === "active").length}, expired: ${individuals.filter((r) => r.status === "expired").length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
