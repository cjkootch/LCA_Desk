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

/** Heuristic: does this look like a real company vs. an individual kicking tires? */
function classify(tenantName: string, ownerEmail: string | null, entityCount: number): {
  verdict: "company" | "individual";
  reasons: string[];
} {
  const reasons: string[] = [];
  const domain = domainOf(ownerEmail);
  const free = FREE_EMAIL_DOMAINS.has(domain);

  if (domain && !free) reasons.push(`corporate email domain (@${domain})`);
  if (free) reasons.push(`free email domain (@${domain})`);

  // Company-name signals: suffixes / multi-word org-looking names.
  const name = (tenantName || "").trim();
  const corpSuffix = /\b(inc|ltd|llc|llp|plc|corp|co|company|group|holdings|services|solutions|energy|oil|gas|petroleum|engineering|consult\w*|enterprises?|limited|n\.?v\.?|s\.?a\.?)\b/i;
  const looksLikePersonName = /^[A-Z][a-z]+(\s+[A-Z]\.?)?\s+[A-Z][a-z]+$/.test(name) && !corpSuffix.test(name);

  if (corpSuffix.test(name)) reasons.push(`company-style name ("${name}")`);
  else if (looksLikePersonName) reasons.push(`looks like a person's name ("${name}")`);

  if (entityCount > 0) reasons.push(`${entityCount} entit${entityCount === 1 ? "y" : "ies"} created`);

  // Score it: corporate domain OR company suffix => company. Otherwise individual.
  const companyScore =
    (domain && !free ? 2 : 0) +
    (corpSuffix.test(name) ? 2 : 0) +
    (entityCount > 0 ? 1 : 0) +
    (looksLikePersonName ? -1 : 0);

  return { verdict: companyScore >= 2 ? "company" : "individual", reasons };
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
  const rows = [];

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

    const { verdict, reasons } = classify(t.name, owner?.email ?? null, entityRows.length);

    rows.push({
      verdict,
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

  rows.sort((a, b) => {
    if (a.verdict !== b.verdict) return a.verdict === "company" ? -1 : 1;
    return (b.entities - a.entities) || (b.members - a.members);
  });

  const companies = rows.filter((r) => r.verdict === "company");
  const individuals = rows.filter((r) => r.verdict === "individual");

  console.log(`\n=== TRIAL TENANTS: ${rows.length} total ===`);
  console.log(`Likely companies: ${companies.length}   |   Likely individuals: ${individuals.length}\n`);

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

  print("LIKELY COMPANIES", companies);
  print("LIKELY INDIVIDUALS", individuals);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
