import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, tenants, tenantMembers, entities, jurisdictions, jobSeekerProfiles, supplierProfiles, reportingPeriods, expenditureRecords, employmentRecords } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "demo-password-2026";

export async function POST(req: NextRequest) {
  // Gate behind env-configured demo secret only
  const demoSecret = process.env.DEMO_SEED_SECRET;
  if (!demoSecret) {
    return NextResponse.json({ error: "Demo seeding is disabled" }, { status: 403 });
  }
  const { secret } = await req.json();
  if (secret !== demoSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const results: string[] = [];

  // Get Guyana jurisdiction
  const [guyana] = await db.select().from(jurisdictions).where(eq(jurisdictions.code, "GY")).limit(1);
  const jurisdictionId = guyana?.id || null;

  // ── Helper: create user if not exists ──
  async function ensureUser(email: string, name: string, role: string, isSuperAdmin = false) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return existing;
    const [user] = await db.insert(users).values({
      email, name, passwordHash, userRole: role, isSuperAdmin,
    }).returning();
    return user;
  }

  // ── Helper: create tenant + membership ──
  async function ensureTenant(userId: string, name: string, slug: string, plan: string, trialDays?: number) {
    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existing) {
      // Ensure membership exists
      const [membership] = await db.select().from(tenantMembers)
        .where(eq(tenantMembers.userId, userId)).limit(1);
      if (!membership) {
        await db.insert(tenantMembers).values({ tenantId: existing.id, userId, role: "owner" });
      }
      return existing;
    }

    const trialEndsAt = trialDays ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;
    const [tenant] = await db.insert(tenants).values({
      name, slug, jurisdictionId, plan,
      trialEndsAt,
      planEntityLimit: plan === "pro" ? 5 : plan === "enterprise" ? -1 : 1,
    }).returning();
    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId, role: "owner" });
    return tenant;
  }

  try {
    // ═══ 1. Filer (Lite) ═══
    const filerLite = await ensureUser("demo-filer-lite@lcadesk.com", "Sarah Mitchell", "filer");
    const tenantLite = await ensureTenant(filerLite.id, "Georgetown Supplies Ltd", "georgetown-supplies", "lite");
    results.push(`✓ Filer Lite: ${filerLite.email}`);

    // Create entity + sample data
    const [entityLite] = await db.select().from(entities).where(eq(entities.tenantId, tenantLite.id)).limit(1);
    if (!entityLite) {
      const [ent] = await db.insert(entities).values({
        tenantId: tenantLite.id, jurisdictionId, legalName: "Georgetown Supplies Ltd",
        companyType: "sub_contractor", contactName: "Sarah Mitchell", contactEmail: "sarah@georgetownsupplies.gy",
      }).returning();

      // Create a reporting period
      const [period] = await db.insert(reportingPeriods).values({
        entityId: ent.id, tenantId: tenantLite.id, jurisdictionId,
        reportType: "half_yearly_h1", periodStart: "2026-01-01", periodEnd: "2026-06-30",
        dueDate: "2026-07-30", fiscalYear: 2026, status: "in_progress",
      }).returning();

      // Sample expenditure
      await db.insert(expenditureRecords).values({
        reportingPeriodId: period.id, entityId: ent.id, tenantId: tenantLite.id,
        typeOfItemProcured: "Services", supplierName: "Guyana Shore Base Inc.",
        supplierCertificateId: "LCSR-abc12345", actualPayment: "150000",
        relatedSector: "Storage Services (Warehousing)", currencyOfPayment: "USD",
      });
      await db.insert(expenditureRecords).values({
        reportingPeriodId: period.id, entityId: ent.id, tenantId: tenantLite.id,
        typeOfItemProcured: "Goods", supplierName: "Baker Hughes International",
        actualPayment: "280000", relatedSector: "Engineering and Machining", currencyOfPayment: "USD",
      });

      // Sample employment
      await db.insert(employmentRecords).values({
        reportingPeriodId: period.id, entityId: ent.id, tenantId: tenantLite.id,
        jobTitle: "Warehouse Manager", employmentCategory: "Managerial",
        totalEmployees: 3, guyanaeseEmployed: 2,
      });
      await db.insert(employmentRecords).values({
        reportingPeriodId: period.id, entityId: ent.id, tenantId: tenantLite.id,
        jobTitle: "Equipment Operator", employmentCategory: "Non-Technical",
        totalEmployees: 12, guyanaeseEmployed: 11,
      });
    }

    // ═══ 2. Filer (Pro) ═══
    const filerPro = await ensureUser("demo-filer-pro@lcadesk.com", "Marcus Williams", "filer");
    const tenantPro = await ensureTenant(filerPro.id, "Demerara Oilfield Services", "demerara-oilfield", "pro");
    results.push(`✓ Filer Pro: ${filerPro.email}`);

    const [entityPro] = await db.select().from(entities).where(eq(entities.tenantId, tenantPro.id)).limit(1);
    if (!entityPro) {
      const [ent] = await db.insert(entities).values({
        tenantId: tenantPro.id, jurisdictionId, legalName: "Demerara Oilfield Services Inc.",
        companyType: "contractor", contactName: "Marcus Williams", contactEmail: "marcus@demerara-oilfield.gy",
      }).returning();

      const [period] = await db.insert(reportingPeriods).values({
        entityId: ent.id, tenantId: tenantPro.id, jurisdictionId,
        reportType: "half_yearly_h1", periodStart: "2026-01-01", periodEnd: "2026-06-30",
        dueDate: "2026-07-30", fiscalYear: 2026, status: "in_progress",
      }).returning();

      // Richer sample data for Pro
      for (const exp of [
        { supplier: "G-Boats Inc.", cert: "LCSR-gboat001", amount: "420000", sector: "Transportation Services" },
        { supplier: "GYSBI", cert: "LCSR-gysbi001", amount: "890000", sector: "Storage Services (Warehousing)" },
        { supplier: "Halliburton Guyana Inc.", cert: null, amount: "1250000", sector: "Engineering and Machining" },
        { supplier: "Local Catering Co.", cert: "LCSR-cater001", amount: "95000", sector: "Catering and Food Services" },
        { supplier: "SLB Guyana", cert: null, amount: "780000", sector: "Borehole Testing Services" },
      ]) {
        await db.insert(expenditureRecords).values({
          reportingPeriodId: period.id, entityId: ent.id, tenantId: tenantPro.id,
          typeOfItemProcured: "Services", supplierName: exp.supplier,
          supplierCertificateId: exp.cert, actualPayment: exp.amount,
          relatedSector: exp.sector, currencyOfPayment: "USD",
        });
      }

      for (const emp of [
        { title: "Operations Manager", cat: "Managerial", total: 4, gy: 3 },
        { title: "Drilling Engineer", cat: "Technical", total: 8, gy: 5 },
        { title: "HSE Officer", cat: "Technical", total: 3, gy: 2 },
        { title: "Admin Assistant", cat: "Non-Technical", total: 6, gy: 6 },
        { title: "Crane Operator", cat: "Non-Technical", total: 15, gy: 13 },
      ]) {
        await db.insert(employmentRecords).values({
          reportingPeriodId: period.id, entityId: ent.id, tenantId: tenantPro.id,
          jobTitle: emp.title, employmentCategory: emp.cat,
          totalEmployees: emp.total, guyanaeseEmployed: emp.gy,
        });
      }
    }

    // ═══ 3. Filer (Trial) ═══
    const filerTrial = await ensureUser("demo-filer-trial@lcadesk.com", "Priya Persaud", "filer");
    await ensureTenant(filerTrial.id, "Essequibo Marine Services", "essequibo-marine", "lite", 14);
    results.push(`✓ Filer Trial: ${filerTrial.email} (14-day trial)`);

    // ═══ 3b. Filer (Expired Trial) ═══
    const filerExpired = await ensureUser("demo-filer-expired@lcadesk.com", "James Rodrigues", "filer");
    await ensureTenant(filerExpired.id, "Atlantic Drilling Co.", "atlantic-drilling", "lite", -7); // expired 7 days ago
    results.push(`✓ Filer Expired: ${filerExpired.email} (trial expired 7 days ago)`);

    // ═══ 4. Job Seeker ═══
    const seeker = await ensureUser("demo-seeker@lcadesk.com", "Devon Campbell", "job_seeker");
    const [existingSeeker] = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, seeker.id)).limit(1);
    if (!existingSeeker) {
      await db.insert(jobSeekerProfiles).values({
        userId: seeker.id, currentJobTitle: "Mechanical Engineer",
        employmentCategory: "Technical", yearsExperience: 5,
        isGuyanese: true, guyaneseStatus: "citizen", nationality: "Guyanese",
        skills: ["Offshore operations", "FPSO maintenance", "Hydraulics", "AutoCAD", "Health & Safety"],
        locationPreference: "Georgetown", contractTypePreference: "Full-time",
        headline: "Mechanical Engineer with 5 years offshore O&G experience",
        profileVisible: true, alertsEnabled: true,
      });
    }
    results.push(`✓ Job Seeker: ${seeker.email}`);

    // ═══ 5. Supplier ═══
    const supplier = await ensureUser("demo-supplier@lcadesk.com", "Anil Raghunath", "supplier");
    const [existingSupplier] = await db.select().from(supplierProfiles).where(eq(supplierProfiles.userId, supplier.id)).limit(1);
    if (!existingSupplier) {
      await db.insert(supplierProfiles).values({
        userId: supplier.id, legalName: "Raghunath Engineering Solutions",
        lcsCertId: "LCSR-demo1234", lcsVerified: true, lcsStatus: "Active",
        serviceCategories: ["Engineering and Machining", "Structural Fabrication"],
        profileVisible: true,
      });
    }
    results.push(`✓ Supplier: ${supplier.email}`);

    // ═══ 6. Super Admin ═══
    const admin = await ensureUser("demo-admin@lcadesk.com", "Cole Kootch", "filer", true);
    await ensureTenant(admin.id, "LCA Desk Admin", "lcadesk-admin", "enterprise");
    results.push(`✓ Admin: ${admin.email} (superAdmin=true)`);

    return NextResponse.json({ success: true, results, password: DEMO_PASSWORD });
  } catch (error) {
    console.error("Demo seed error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
