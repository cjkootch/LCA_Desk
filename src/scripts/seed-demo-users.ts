/**
 * One-off script to ensure demo-secretariat and demo-seeker users exist in the DB.
 * Run with: npx tsx src/scripts/seed-demo-users.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import {
  users, jurisdictions, secretariatOffices, secretariatMembers, jobSeekerProfiles,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";

const DEMO_PASSWORD = "demo-password-2026";

async function run() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const [guyana] = await db.select().from(jurisdictions).where(eq(jurisdictions.code, "GY")).limit(1);
  const jurisdictionId = guyana?.id ?? null;
  console.log("Jurisdiction ID (GY):", jurisdictionId);

  // Helper: upsert a user
  async function ensureUser(email: string, name: string, role: string) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await db.update(users).set({ passwordHash, isDemo: true, name }).where(eq(users.id, existing.id));
      console.log(`  ↺ Updated existing user: ${email}`);
      return existing;
    }
    const [user] = await db.insert(users).values({
      email, name, passwordHash, userRole: role, isDemo: true,
    }).returning();
    console.log(`  + Created user: ${email}`);
    return user;
  }

  // ── 1. demo-secretariat ──────────────────────────────────────────────────
  console.log("\n[1] demo-secretariat@lcadesk.com");
  const secUser = await ensureUser("demo-secretariat@lcadesk.com", "Michael Munroe", "secretariat");

  // Ensure a secretariat office exists
  const [existingOffice] = await db.select().from(secretariatOffices).limit(1);
  let officeId: string;
  if (existingOffice) {
    officeId = existingOffice.id;
    console.log("  ↺ Using existing secretariat office:", existingOffice.name);
  } else {
    const [office] = await db.insert(secretariatOffices).values({
      name: "Local Content Secretariat",
      jurisdictionId,
    }).returning();
    officeId = office.id;
    console.log("  + Created secretariat office");
  }

  // Ensure membership
  const [existingMembership] = await db.select().from(secretariatMembers)
    .where(eq(secretariatMembers.userId, secUser.id)).limit(1);
  if (!existingMembership) {
    await db.insert(secretariatMembers).values({ officeId, userId: secUser.id, role: "admin" });
    console.log("  + Added to secretariatMembers");
  } else {
    console.log("  ↺ Already a secretariatMember");
  }

  // ── 2. demo-seeker ───────────────────────────────────────────────────────
  console.log("\n[2] demo-seeker@lcadesk.com");
  const seekerUser = await ensureUser("demo-seeker@lcadesk.com", "Devon Campbell", "job_seeker");

  // Ensure job seeker profile
  const [existingProfile] = await db.select().from(jobSeekerProfiles)
    .where(eq(jobSeekerProfiles.userId, seekerUser.id)).limit(1);
  if (!existingProfile) {
    await db.insert(jobSeekerProfiles).values({
      userId: seekerUser.id,
      currentJobTitle: "Mechanical Engineer",
      employmentCategory: "Technical",
      yearsExperience: 5,
      isGuyanese: true,
      guyaneseStatus: "citizen",
      nationality: "Guyanese",
      educationLevel: "bachelors",
      educationField: "Mechanical Engineering",
      profileVisible: true,
      alertsEnabled: true,
    });
    console.log("  + Created job seeker profile");
  } else {
    console.log("  ↺ Job seeker profile already exists");
  }

  console.log("\n✓ Done. Demo users are ready.");
  console.log(`  demo-secretariat@lcadesk.com / ${DEMO_PASSWORD}`);
  console.log(`  demo-seeker@lcadesk.com / ${DEMO_PASSWORD}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
