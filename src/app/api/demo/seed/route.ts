import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  users, tenants, tenantMembers, entities, jurisdictions,
  jobSeekerProfiles, supplierProfiles, reportingPeriods,
  expenditureRecords, employmentRecords, capacityDevelopmentRecords,
  secretariatOffices, secretariatMembers, courses, userCourseProgress,
} from "@/server/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "demo-password-2026";

export async function POST(req: NextRequest) {
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

  const [guyana] = await db.select().from(jurisdictions).where(eq(jurisdictions.code, "GY")).limit(1);
  const jurisdictionId = guyana?.id || null;

  async function ensureUser(email: string, name: string, role: string, isSuperAdmin = false) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return existing;
    const [user] = await db.insert(users).values({
      email, name, passwordHash, userRole: role, isSuperAdmin,
    }).returning();
    return user;
  }

  async function ensureTenant(
    userId: string, name: string, slug: string, plan: string,
    opts?: { trialDays?: number; stripeStatus?: string }
  ) {
    const [existing] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (existing) {
      // Update existing demo tenants to have correct billing state
      if (opts?.stripeStatus) {
        const trialEndsAt = opts.trialDays ? new Date(Date.now() + opts.trialDays * 24 * 60 * 60 * 1000) : null;
        await db.update(tenants).set({
          stripeSubscriptionId: opts.stripeStatus !== "canceled" ? `demo_sub_${slug}` : null,
          stripeSubscriptionStatus: opts.stripeStatus,
          trialEndsAt,
        }).where(eq(tenants.id, existing.id));
      }
      const [membership] = await db.select().from(tenantMembers)
        .where(eq(tenantMembers.userId, userId)).limit(1);
      if (!membership) {
        await db.insert(tenantMembers).values({ tenantId: existing.id, userId, role: "owner" });
      }
      return existing;
    }

    const trialEndsAt = opts?.trialDays ? new Date(Date.now() + opts.trialDays * 24 * 60 * 60 * 1000) : null;
    const [tenant] = await db.insert(tenants).values({
      name, slug, jurisdictionId, plan,
      trialEndsAt,
      planEntityLimit: plan === "pro" ? 5 : plan === "enterprise" ? -1 : 1,
      stripeSubscriptionId: opts?.stripeStatus && opts.stripeStatus !== "canceled" ? `demo_sub_${slug}` : null,
      stripeSubscriptionStatus: opts?.stripeStatus ?? null,
    }).returning();
    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId, role: "owner" });
    return tenant;
  }

  try {
    // ═══ 1. Filer (Essentials) ═══
    const filerLite = await ensureUser("demo-filer-lite@lcadesk.com", "Sarah Mitchell", "filer");
    const tenantLite = await ensureTenant(filerLite.id, "Georgetown Supplies Ltd", "georgetown-supplies", "lite", { stripeStatus: "active" });
    results.push(`✓ Filer Essentials: ${filerLite.email}`);

    const [entityLite] = await db.select().from(entities).where(eq(entities.tenantId, tenantLite.id)).limit(1);
    if (!entityLite) {
      const [ent] = await db.insert(entities).values({
        tenantId: tenantLite.id, jurisdictionId, legalName: "Georgetown Supplies Ltd",
        companyType: "sub_contractor", contactName: "Sarah Mitchell", contactEmail: "sarah@georgetownsupplies.gy",
        lcsCertificateId: "LCSR-demo0001",
      }).returning();

      const [period] = await db.insert(reportingPeriods).values({
        entityId: ent.id, tenantId: tenantLite.id, jurisdictionId,
        reportType: "half_yearly_h1", periodStart: "2026-01-01", periodEnd: "2026-06-30",
        dueDate: "2026-07-30", fiscalYear: 2026, status: "in_progress",
      }).returning();

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

    // ═══ 2. Filer (Professional) — with SUBMITTED report for secretariat ═══
    const filerPro = await ensureUser("demo-filer-pro@lcadesk.com", "Marcus Williams", "filer");
    const tenantPro = await ensureTenant(filerPro.id, "Demerara Oilfield Services", "demerara-oilfield", "pro", { stripeStatus: "active" });
    results.push(`✓ Filer Professional: ${filerPro.email}`);

    const [entityPro] = await db.select().from(entities).where(eq(entities.tenantId, tenantPro.id)).limit(1);
    if (!entityPro) {
      const [ent] = await db.insert(entities).values({
        tenantId: tenantPro.id, jurisdictionId, legalName: "Demerara Oilfield Services Inc.",
        companyType: "contractor", contactName: "Marcus Williams", contactEmail: "marcus@demerara-oilfield.gy",
        lcsCertificateId: "LCSR-demo0002",
      }).returning();

      // In-progress H1
      const [period] = await db.insert(reportingPeriods).values({
        entityId: ent.id, tenantId: tenantPro.id, jurisdictionId,
        reportType: "half_yearly_h1", periodStart: "2026-01-01", periodEnd: "2026-06-30",
        dueDate: "2026-07-30", fiscalYear: 2026, status: "in_progress",
      }).returning();

      // Submitted H2 2025 (visible to secretariat)
      const [submittedPeriod] = await db.insert(reportingPeriods).values({
        entityId: ent.id, tenantId: tenantPro.id, jurisdictionId,
        reportType: "half_yearly_h2", periodStart: "2025-07-01", periodEnd: "2025-12-31",
        dueDate: "2026-01-30", fiscalYear: 2025, status: "submitted",
        submittedAt: new Date("2026-01-28"), lockedAt: new Date("2026-01-28"),
        attestation: "I certify that the information contained in this report is true and accurate.",
        attestedBy: filerPro.id, attestedAt: new Date("2026-01-28"),
      }).returning();

      for (const exp of [
        { supplier: "G-Boats Inc.", cert: "LCSR-gboat001", amount: "420000", sector: "Transportation Services" },
        { supplier: "GYSBI", cert: "LCSR-gysbi001", amount: "890000", sector: "Storage Services (Warehousing)" },
        { supplier: "Halliburton Guyana Inc.", cert: null, amount: "1250000", sector: "Engineering and Machining" },
        { supplier: "Local Catering Co.", cert: "LCSR-cater001", amount: "95000", sector: "Catering and Food Services" },
        { supplier: "SLB Guyana", cert: null, amount: "780000", sector: "Borehole Testing Services" },
      ]) {
        // Insert for both periods
        for (const pid of [period.id, submittedPeriod.id]) {
          await db.insert(expenditureRecords).values({
            reportingPeriodId: pid, entityId: ent.id, tenantId: tenantPro.id,
            typeOfItemProcured: "Services", supplierName: exp.supplier,
            supplierCertificateId: exp.cert, actualPayment: exp.amount,
            relatedSector: exp.sector, currencyOfPayment: "USD",
          });
        }
      }

      for (const emp of [
        { title: "Operations Manager", cat: "Managerial", total: 4, gy: 3 },
        { title: "Drilling Engineer", cat: "Technical", total: 8, gy: 5 },
        { title: "HSE Officer", cat: "Technical", total: 3, gy: 2 },
        { title: "Admin Assistant", cat: "Non-Technical", total: 6, gy: 6 },
        { title: "Crane Operator", cat: "Non-Technical", total: 15, gy: 13 },
      ]) {
        for (const pid of [period.id, submittedPeriod.id]) {
          await db.insert(employmentRecords).values({
            reportingPeriodId: pid, entityId: ent.id, tenantId: tenantPro.id,
            jobTitle: emp.title, employmentCategory: emp.cat,
            totalEmployees: emp.total, guyanaeseEmployed: emp.gy,
          });
        }
      }

      // Capacity development records for submitted period
      await db.insert(capacityDevelopmentRecords).values({
        reportingPeriodId: submittedPeriod.id, entityId: ent.id, tenantId: tenantPro.id,
        activity: "Offshore Safety Training (BOSIET)", category: "Technical Training",
        participantType: "employee", totalParticipants: 12, guyanaeseParticipantsOnly: 10,
        startDate: "2025-09-15", durationDays: 5, expenditureOnCapacity: "45000",
      });
    }

    // ═══ 3. Filer (30-day Trial) ═══
    const filerTrial = await ensureUser("demo-filer-trial@lcadesk.com", "Priya Persaud", "filer");
    await ensureTenant(filerTrial.id, "Essequibo Marine Services", "essequibo-marine", "lite", { trialDays: 30, stripeStatus: "trialing" });
    results.push(`✓ Filer Trial: ${filerTrial.email} (30-day Professional trial)`);

    // ═══ 4. Filer (Expired Trial) ═══
    const filerExpired = await ensureUser("demo-filer-expired@lcadesk.com", "James Rodrigues", "filer");
    await ensureTenant(filerExpired.id, "Atlantic Drilling Co.", "atlantic-drilling", "lite", { trialDays: -7, stripeStatus: "canceled" });
    results.push(`✓ Filer Expired: ${filerExpired.email} (trial expired 7 days ago)`);

    // ═══ 6. Job Seeker ═══
    const seeker = await ensureUser("demo-seeker@lcadesk.com", "Devon Campbell", "job_seeker");
    const [existingSeeker] = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, seeker.id)).limit(1);
    if (!existingSeeker) {
      await db.insert(jobSeekerProfiles).values({
        userId: seeker.id, currentJobTitle: "Mechanical Engineer",
        employmentCategory: "Technical", yearsExperience: 5,
        isGuyanese: true, guyaneseStatus: "citizen", nationality: "Guyanese",
        educationLevel: "bachelors", educationField: "Mechanical Engineering",
        skills: ["Offshore operations", "FPSO maintenance", "Hydraulics", "AutoCAD", "Health & Safety"],
        certifications: ["BOSIET", "HUET", "H2S Alive"],
        locationPreference: "Georgetown", contractTypePreference: "Full-time",
        headline: "Mechanical Engineer with 5 years offshore O&G experience",
        profileVisible: true, alertsEnabled: true,
        resumeContent: `DEVON CAMPBELL
Mechanical Engineer | Offshore O&G Specialist

Georgetown, Guyana · devon.campbell@email.com · +592-600-1234

PROFESSIONAL SUMMARY
Results-driven Mechanical Engineer with 5 years of experience in offshore oil and gas operations, specializing in FPSO maintenance, rotating equipment, and hydraulic systems. Proven track record of reducing equipment downtime through proactive maintenance planning and root cause analysis. Committed to advancing Guyana's petroleum sector through technical excellence and local content development.

EXPERIENCE

Mechanical Engineer — SBM Offshore Guyana (2022–Present)
• Lead maintenance planning for rotating equipment on the Liza Unity FPSO, achieving 97% uptime
• Manage a team of 8 local technicians, providing mentorship and skills transfer
• Developed predictive maintenance program using vibration analysis, reducing unplanned shutdowns by 35%
• Coordinate with OEM vendors for critical spare parts and overhaul scheduling
• Ensure compliance with ASME, API, and DNV standards for pressure vessels and piping

Junior Mechanical Engineer — Halliburton Guyana (2020–2022)
• Supported wellhead and Christmas tree maintenance operations offshore
• Performed hydraulic system troubleshooting and BOP stack testing
• Created detailed technical reports for equipment failure analysis
• Assisted in implementation of local content employment tracking systems

Engineering Intern — Guyana Water Inc. (2019–2020)
• Designed pump station upgrades for rural water distribution networks
• Conducted flow analysis and pipe sizing calculations using AutoCAD
• Assisted with procurement specifications for centrifugal pumps

EDUCATION

BSc Mechanical Engineering — University of Guyana (2015–2019)
• First Class Honours
• Final Year Project: "Optimization of Heat Exchanger Design for Tropical Climates"

CERTIFICATIONS
• BOSIET (Basic Offshore Safety Induction and Emergency Training) — OPITO Certified, 2022
• HUET (Helicopter Underwater Escape Training) — Current
• H2S Alive — ENFORM Certified, 2022
• AutoCAD Professional Certification — Autodesk, 2020

SKILLS
Technical: FPSO systems, rotating equipment, hydraulics, pneumatics, PFDs, P&IDs, vibration analysis, thermodynamics, AutoCAD, SolidWorks, SAP PM
Safety: PTW systems, JSA/risk assessment, SIMOPS, confined space entry
Soft Skills: Team leadership, cross-cultural communication, technical writing, vendor management

REFERENCES
Available upon request.`,
      });
    } else if (!existingSeeker.resumeContent) {
      // Backfill resume for existing profile
      await db.update(jobSeekerProfiles).set({
        resumeContent: `DEVON CAMPBELL
Mechanical Engineer | Offshore O&G Specialist

Georgetown, Guyana · devon.campbell@email.com · +592-600-1234

PROFESSIONAL SUMMARY
Results-driven Mechanical Engineer with 5 years of experience in offshore oil and gas operations, specializing in FPSO maintenance, rotating equipment, and hydraulic systems. Proven track record of reducing equipment downtime through proactive maintenance planning and root cause analysis. Committed to advancing Guyana's petroleum sector through technical excellence and local content development.

EXPERIENCE

Mechanical Engineer — SBM Offshore Guyana (2022–Present)
• Lead maintenance planning for rotating equipment on the Liza Unity FPSO, achieving 97% uptime
• Manage a team of 8 local technicians, providing mentorship and skills transfer
• Developed predictive maintenance program using vibration analysis, reducing unplanned shutdowns by 35%
• Coordinate with OEM vendors for critical spare parts and overhaul scheduling
• Ensure compliance with ASME, API, and DNV standards for pressure vessels and piping

Junior Mechanical Engineer — Halliburton Guyana (2020–2022)
• Supported wellhead and Christmas tree maintenance operations offshore
• Performed hydraulic system troubleshooting and BOP stack testing
• Created detailed technical reports for equipment failure analysis
• Assisted in implementation of local content employment tracking systems

Engineering Intern — Guyana Water Inc. (2019–2020)
• Designed pump station upgrades for rural water distribution networks
• Conducted flow analysis and pipe sizing calculations using AutoCAD
• Assisted with procurement specifications for centrifugal pumps

EDUCATION

BSc Mechanical Engineering — University of Guyana (2015–2019)
• First Class Honours
• Final Year Project: "Optimization of Heat Exchanger Design for Tropical Climates"

CERTIFICATIONS
• BOSIET (Basic Offshore Safety Induction and Emergency Training) — OPITO Certified, 2022
• HUET (Helicopter Underwater Escape Training) — Current
• H2S Alive — ENFORM Certified, 2022
• AutoCAD Professional Certification — Autodesk, 2020

SKILLS
Technical: FPSO systems, rotating equipment, hydraulics, pneumatics, PFDs, P&IDs, vibration analysis, thermodynamics, AutoCAD, SolidWorks, SAP PM
Safety: PTW systems, JSA/risk assessment, SIMOPS, confined space entry
Soft Skills: Team leadership, cross-cultural communication, technical writing, vendor management

REFERENCES
Available upon request.`,
      }).where(eq(jobSeekerProfiles.userId, seeker.id));
    }
    results.push(`✓ Job Seeker: ${seeker.email}`);

    // ═══ 6b. Additional Job Seekers (display-only, no login needed) ═══

    // --- Keisha Persaud: All training complete, all badges earned ---
    const seeker2 = await ensureUser("demo-seeker-2@lcadesk.com", "Keisha Persaud", "job_seeker");
    const [existingSeeker2] = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, seeker2.id)).limit(1);
    if (!existingSeeker2) {
      await db.insert(jobSeekerProfiles).values({
        userId: seeker2.id, currentJobTitle: "HSE Coordinator",
        employmentCategory: "Management", yearsExperience: 8,
        isGuyanese: true, guyaneseStatus: "citizen", nationality: "Guyanese",
        educationLevel: "masters", educationField: "Occupational Health & Safety",
        skills: ["HSE management", "Risk assessment", "Incident investigation", "OSHA standards", "Permit to Work", "Emergency response", "ISO 14001", "Environmental auditing"],
        certifications: ["NEBOSH IGC", "IOSH Managing Safely", "Lead Auditor ISO 45001", "First Aid at Work"],
        locationPreference: "Georgetown", contractTypePreference: "Full-time",
        headline: "HSE Coordinator | 8 years O&G safety leadership | NEBOSH certified",
        profileVisible: true, alertsEnabled: true,
        resumeContent: `KEISHA PERSAUD
HSE Coordinator | Oil & Gas Safety Leadership

Georgetown, Guyana · keisha.persaud@email.com · +592-600-5678

PROFESSIONAL SUMMARY
Experienced HSE Coordinator with 8 years managing safety programs across onshore and offshore petroleum operations. Led implementation of ISO 45001 management systems and reduced recordable incident rates by 60%. Passionate about building safety culture and mentoring local HSE professionals in Guyana's growing energy sector.

EXPERIENCE

HSE Coordinator — CNOOC Petroleum Guyana (2021–Present)
• Manage HSE programs for Payara development project, overseeing 200+ personnel
• Led ISO 45001 certification achieving zero major non-conformities
• Reduced Total Recordable Incident Rate (TRIR) from 1.8 to 0.7 over 2 years
• Conduct monthly safety leadership workshops for local supervisors

HSE Officer — Tullow Oil Guyana (2018–2021)
• Managed Permit to Work system for offshore drilling campaigns
• Investigated 50+ incidents using ICAM methodology with corrective action tracking
• Developed emergency response procedures for offshore platforms

Safety Officer — Guyana Energy Agency (2016–2018)
• Conducted safety inspections across petroleum storage facilities
• Developed national safety guidelines for emerging petroleum sector

EDUCATION
MSc Occupational Health & Safety — University of the West Indies (2016)
BSc Environmental Science — University of Guyana (2014)

CERTIFICATIONS
• NEBOSH International General Certificate (IGC) — 2019
• IOSH Managing Safely — 2020
• Lead Auditor ISO 45001 — 2021
• Advanced First Aid at Work — Current`,
      });
    }
    // Seed ALL course badges for Keisha (all training complete)
    const allCourses = await db.select({ id: courses.id }).from(courses);
    for (const course of allCourses) {
      const [existingProgress] = await db.select({ id: userCourseProgress.id }).from(userCourseProgress)
        .where(and(eq(userCourseProgress.userId, seeker2.id), eq(userCourseProgress.courseId, course.id))).limit(1);
      if (!existingProgress) {
        await db.insert(userCourseProgress).values({
          userId: seeker2.id, courseId: course.id, status: "completed",
          completedAt: new Date(), badgeEarnedAt: new Date(), quizScore: 95,
        });
      }
    }
    results.push(`✓ Job Seeker 2 (all badges): ${seeker2.email}`);

    // --- Ryan Bacchus: 2 badges, mid-career technical ---
    const seeker3 = await ensureUser("demo-seeker-3@lcadesk.com", "Ryan Bacchus", "job_seeker");
    const [existingSeeker3] = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, seeker3.id)).limit(1);
    if (!existingSeeker3) {
      await db.insert(jobSeekerProfiles).values({
        userId: seeker3.id, currentJobTitle: "Subsea Engineer",
        employmentCategory: "Technical", yearsExperience: 3,
        isGuyanese: true, guyaneseStatus: "citizen", nationality: "Guyanese",
        educationLevel: "bachelors", educationField: "Civil Engineering",
        skills: ["Subsea systems", "Pipeline engineering", "ROV operations", "Structural analysis", "DNV standards"],
        certifications: ["BOSIET", "Marine Survival"],
        locationPreference: "Georgetown", contractTypePreference: "Full-time",
        headline: "Subsea Engineer | Pipeline & ROV specialist",
        profileVisible: true, alertsEnabled: true,
        resumeContent: `RYAN BACCHUS
Subsea Engineer

Georgetown, Guyana · ryan.bacchus@email.com · +592-600-9012

PROFESSIONAL SUMMARY
Subsea engineer with 3 years of experience in pipeline design, installation support, and ROV inspection campaigns. Strong background in structural analysis and compliance with DNV offshore standards.

EXPERIENCE

Subsea Engineer — TechnipFMC Guyana (2022–Present)
• Support subsea installation campaigns for Liza Phase 2 and Payara developments
• Perform pipeline route analysis and seabed survey data interpretation
• Coordinate ROV inspection scopes and report defect classification
• Assist with subsea equipment maintenance planning

Graduate Engineer — Guyana Shore Base Inc. (2021–2022)
• Structural analysis for port facility upgrades
• Supported logistics planning for offshore supply vessel operations

EDUCATION
BSc Civil Engineering — University of Guyana (2021)

CERTIFICATIONS
• BOSIET — OPITO Certified, 2022
• Marine Survival — Current`,
      });
    }
    // Seed 2 badges for Ryan (LCA Fundamentals + Platform Mastery)
    const twoBadgeCourses = await db.select({ id: courses.id }).from(courses)
      .where(inArray(courses.slug, ["lca-fundamentals", "mastering-lca-desk"])).limit(2);
    for (const course of twoBadgeCourses) {
      const [existing] = await db.select({ id: userCourseProgress.id }).from(userCourseProgress)
        .where(and(eq(userCourseProgress.userId, seeker3.id), eq(userCourseProgress.courseId, course.id))).limit(1);
      if (!existing) {
        await db.insert(userCourseProgress).values({
          userId: seeker3.id, courseId: course.id, status: "completed",
          completedAt: new Date(), badgeEarnedAt: new Date(), quizScore: 88,
        });
      }
    }
    results.push(`✓ Job Seeker 3 (2 badges): ${seeker3.email}`);

    // --- Priya Doobay: No badges, entry-level, just registered ---
    const seeker4 = await ensureUser("demo-seeker-4@lcadesk.com", "Priya Doobay", "job_seeker");
    const [existingSeeker4] = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, seeker4.id)).limit(1);
    if (!existingSeeker4) {
      await db.insert(jobSeekerProfiles).values({
        userId: seeker4.id, currentJobTitle: "Recent Graduate",
        employmentCategory: "Non-Technical", yearsExperience: 0,
        isGuyanese: true, guyaneseStatus: "citizen", nationality: "Guyanese",
        educationLevel: "bachelors", educationField: "Business Administration",
        skills: ["Microsoft Office", "Data entry", "Customer service", "Report writing"],
        certifications: [],
        locationPreference: "Georgetown", contractTypePreference: "Full-time",
        headline: "Business Administration graduate seeking entry-level O&G role",
        profileVisible: true, alertsEnabled: true,
      });
    }
    results.push(`✓ Job Seeker 4 (no badges, entry-level): ${seeker4.email}`);

    // ═══ 7. Supplier (with full profile) ═══
    const supplier = await ensureUser("demo-supplier@lcadesk.com", "Anil Raghunath", "supplier");
    const [existingSupplier] = await db.select().from(supplierProfiles).where(eq(supplierProfiles.userId, supplier.id)).limit(1);
    if (!existingSupplier) {
      await db.insert(supplierProfiles).values({
        userId: supplier.id, legalName: "Raghunath Engineering Solutions",
        tradingName: "RES Guyana",
        lcsCertId: "LCSR-demo1234", lcsVerified: true, lcsStatus: "Active",
        lcsExpirationDate: "2027-06-30",
        serviceCategories: ["Engineering and Machining", "Structural Fabrication", "Equipment Supply"],
        contactEmail: "anil@res-guyana.com", contactPhone: "+592-222-3456",
        website: "https://res-guyana.com",
        employeeCount: 45, yearEstablished: 2015, isGuyaneseOwned: true,
        capabilityStatement: "Raghunath Engineering Solutions provides structural fabrication, equipment maintenance, and machining services to the petroleum sector. With 45 employees and ISO 9001 certification, we have completed projects for ExxonMobil, CNOOC, and Hess.",
        profileVisible: true, tier: "pro",
      });
    }
    results.push(`✓ Supplier (Pro): ${supplier.email}`);

    // ═══ 8. Secretariat User ═══
    const secretariatUser = await ensureUser("demo-secretariat@lcadesk.com", "Dr. Martin Pertab", "secretariat");
    results.push(`✓ Secretariat: ${secretariatUser.email}`);

    // Ensure secretariat office and membership
    const [existingOffice] = await db.select().from(secretariatOffices).limit(1);
    let officeId: string;
    if (existingOffice) {
      officeId = existingOffice.id;
    } else {
      const [office] = await db.insert(secretariatOffices).values({
        name: "Local Content Secretariat",
        jurisdictionId,
      }).returning();
      officeId = office.id;
    }

    const [existingMembership] = await db.select().from(secretariatMembers)
      .where(eq(secretariatMembers.userId, secretariatUser.id)).limit(1);
    if (!existingMembership) {
      await db.insert(secretariatMembers).values({
        officeId, userId: secretariatUser.id, role: "admin",
      });
    }

    // ═══ 9. Super Admin ═══
    const admin = await ensureUser("demo-admin@lcadesk.com", "Cole Kootch", "filer", true);
    await ensureTenant(admin.id, "LCA Desk Admin", "lcadesk-admin", "enterprise", { stripeStatus: "active" });
    results.push(`✓ Admin: ${admin.email} (superAdmin=true)`);

    return NextResponse.json({ success: true, results, password: DEMO_PASSWORD });
  } catch (error) {
    console.error("Demo seed error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
