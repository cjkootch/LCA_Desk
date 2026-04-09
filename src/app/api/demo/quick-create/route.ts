import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions, jobSeekerProfiles, supplierProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "demo-password-2026";

export async function POST(req: NextRequest) {
  const { secret, name, role, jurisdiction } = await req.json();

  const demoSecret = process.env.DEMO_SEED_SECRET;
  if (!demoSecret || secret !== demoSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!name || !role) {
    return NextResponse.json({ error: "Name and role are required" }, { status: 400 });
  }

  // Generate a unique demo email
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const email = `demo-${slug}@lcadesk.com`;

  // Check if email already exists
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: `User ${email} already exists`, email }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Create the user
  const [user] = await db.insert(users).values({
    name, email, passwordHash, userRole: role, isDemo: true,
  }).returning();

  // Get jurisdiction
  const jCode = jurisdiction || "GY";
  const [j] = await db.select().from(jurisdictions).where(eq(jurisdictions.code, jCode)).limit(1);

  // Role-specific setup
  if (role === "filer") {
    const tenantSlug = `demo-${slug}`;
    const [tenant] = await db.insert(tenants).values({
      name, slug: tenantSlug, jurisdictionId: j?.id, plan: "lite", isDemo: true,
      planEntityLimit: 1,
    }).returning();
    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId: user.id, role: "owner" });
  }

  if (role === "job_seeker") {
    await db.insert(jobSeekerProfiles).values({
      userId: user.id,
      currentJobTitle: "Demo Job Seeker",
      employmentCategory: "Technical",
      isGuyanese: jCode === "GY",
      nationality: jCode === "GY" ? "Guyanese" : jCode === "NG" ? "Nigerian" : jCode === "SR" ? "Surinamese" : "Namibian",
      profileVisible: true,
      alertsEnabled: true,
      locationPreference: jCode === "GY" ? "Georgetown" : jCode === "NG" ? "Lagos" : jCode === "SR" ? "Paramaribo" : "Windhoek",
    });
  }

  if (role === "supplier") {
    await db.insert(supplierProfiles).values({
      userId: user.id,
      legalName: name,
      contactEmail: email,
      tier: "free",
    });
  }

  return NextResponse.json({
    success: true,
    email,
    userId: user.id,
    role,
    jurisdiction: jCode,
  });
}
