import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions, entities, jobSeekerProfiles, supplierProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().optional(),
  accountType: z.enum(["self", "others"]).optional(),
  // Role-based registration
  role: z.enum(["filer", "job_seeker", "supplier"]).default("filer"),
  // Job seeker fields
  currentJobTitle: z.string().optional(),
  employmentCategory: z.string().optional(),
  locationPreference: z.string().optional(),
  isGuyanese: z.boolean().optional(),
  alertsEnabled: z.boolean().optional(),
  // Supplier fields
  lcsCertId: z.string().optional(),
  lcsVerified: z.boolean().optional(),
  lcsStatus: z.string().optional(),
  lcsExpirationDate: z.string().optional(),
  lcsLegalName: z.string().optional(),
  serviceCategories: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, companyName, accountType, role } = parsed.data;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, userRole: role })
      .returning();

    // ─── FILER REGISTRATION ──────────────────────────────────────
    if (role === "filer") {
      const [guyana] = await db
        .select()
        .from(jurisdictions)
        .where(eq(jurisdictions.code, "GY"))
        .limit(1);

      const slug = (companyName || name)
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const [tenant] = await db
        .insert(tenants)
        .values({
          name: companyName || name,
          slug,
          jurisdictionId: guyana?.id,
          planEntityLimit: accountType === "others" ? 5 : 1,
        })
        .returning();

      await db.insert(tenantMembers).values({
        tenantId: tenant.id,
        userId: user.id,
        role: "owner",
      });

      if (accountType === "self" && guyana) {
        await db.insert(entities).values({
          tenantId: tenant.id,
          jurisdictionId: guyana.id,
          legalName: companyName || name,
          companyType: "contractor",
          contactName: name,
          contactEmail: email,
        });
      }

      return NextResponse.json({
        success: true,
        userId: user.id,
        role: "filer",
        redirectTo: "/dashboard",
      });
    }

    // ─── JOB SEEKER REGISTRATION ─────────────────────────────────
    if (role === "job_seeker") {
      await db.insert(jobSeekerProfiles).values({
        userId: user.id,
        currentJobTitle: parsed.data.currentJobTitle || null,
        employmentCategory: parsed.data.employmentCategory || null,
        isGuyanese: parsed.data.isGuyanese ?? true,
        locationPreference: parsed.data.locationPreference || "Any",
        alertsEnabled: parsed.data.alertsEnabled ?? true,
      });

      return NextResponse.json({
        success: true,
        userId: user.id,
        role: "job_seeker",
        redirectTo: "/seeker/dashboard",
      });
    }

    // ─── SUPPLIER REGISTRATION ───────────────────────────────────
    if (role === "supplier") {
      await db.insert(supplierProfiles).values({
        userId: user.id,
        lcsCertId: parsed.data.lcsCertId || null,
        lcsVerified: parsed.data.lcsVerified ?? false,
        lcsStatus: parsed.data.lcsStatus || null,
        legalName: parsed.data.lcsLegalName || companyName || null,
        serviceCategories: parsed.data.serviceCategories || [],
      });

      return NextResponse.json({
        success: true,
        userId: user.id,
        role: "supplier",
        redirectTo: "/supplier-portal/dashboard",
      });
    }

    return NextResponse.json({ success: true, userId: user.id, role });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
