import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions, entities, jobSeekerProfiles, supplierProfiles, teamInvites, referrals } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyWelcome } from "@/lib/email/unified-notify";
import { acceptPendingInvites } from "@/server/actions";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().optional(),
  accountType: z.enum(["self", "others"]).optional(),
  // Role-based registration
  role: z.enum(["filer", "job_seeker", "supplier", "secretariat"]).default("filer"),
  ref: z.string().optional(), // referral code
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

const ALLOWED_ORIGINS = ["https://lcadesk.com", "https://www.lcadesk.com"];

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  try {
    const raw = await req.json();
    // Normalize snake_case keys from marketing site to camelCase
    const body = {
      ...raw,
      companyName: raw.companyName ?? raw.company_name,
      accountType: raw.accountType ?? raw.account_type,
      currentJobTitle: raw.currentJobTitle ?? raw.current_job_title,
      employmentCategory: raw.employmentCategory ?? raw.employment_category,
      locationPreference: raw.locationPreference ?? raw.location_preference,
      isGuyanese: raw.isGuyanese ?? raw.is_guyanese,
      alertsEnabled: raw.alertsEnabled ?? raw.alerts_enabled,
      lcsCertId: raw.lcsCertId ?? raw.lcs_cert_id,
      lcsVerified: raw.lcsVerified ?? raw.lcs_verified,
      lcsStatus: raw.lcsStatus ?? raw.lcs_status,
      lcsExpirationDate: raw.lcsExpirationDate ?? raw.lcs_expiration_date,
      lcsLegalName: raw.lcsLegalName ?? raw.lcs_legal_name,
      serviceCategories: raw.serviceCategories ?? raw.service_categories,
    };
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400, headers: cors }
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
        { status: 409, headers: cors }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique referral code with collision retry
    const refBase = (name || "user").split(" ")[0].toUpperCase().slice(0, 6);
    let referralCode: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = Math.random().toString(36).substring(2, 7).toUpperCase(); // 5 chars = ~60M combos
      const candidate = `${refBase}-${suffix}`;
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, candidate)).limit(1);
      if (!existing) { referralCode = candidate; break; }
    }

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, userRole: role, referralCode })
      .returning();

    // Track referral if ref code was provided
    const refCode = parsed.data.ref;
    if (refCode) {
      try {
        const [referrer] = await db.select({ id: users.id }).from(users)
          .where(eq(users.referralCode, refCode)).limit(1);
        if (referrer) {
          await db.insert(referrals).values({
            referrerUserId: referrer.id,
            referredUserId: user.id,
            referredEmail: email,
            status: "signed_up",
          });
        }
      } catch {} // Don't block registration if referral tracking fails
    }

    // Send welcome notification (in-app + email)
    notifyWelcome({ userId: user.id, email, name, role });

    // ─── ACCEPT PENDING TEAM INVITES ──────────────────────────────
    // If this user was invited by an admin before they registered,
    // auto-join them to the team/office now.
    try {
      const accepted = await acceptPendingInvites(user.id, email);
      if (accepted > 0) {
        // User was invited — they'll be joined to the team automatically.
        // For filer invites, skip tenant creation below since they're joining an existing one.
        const hasTeamInvite = await db.select({ id: tenantMembers.id }).from(tenantMembers)
          .where(eq(tenantMembers.userId, user.id)).limit(1);
        if (hasTeamInvite.length > 0 && role === "filer") {
          return NextResponse.json(
            { success: true, userId: user.id, role, redirectTo: "/auth/login" },
            { headers: cors }
          );
        }
      }
    } catch (err) { console.error("Invite acceptance failed:", err); }

    // ─── SECRETARIAT REGISTRATION (invite only, no self-reg) ─────
    if (role === "secretariat") {
      // Secretariat users only register via invite link — invite acceptance
      // above handles team join. Just redirect to login.
      return NextResponse.json(
        { success: true, userId: user.id, role: "secretariat", redirectTo: "/auth/login" },
        { headers: cors }
      );
    }

    // ─── FILER REGISTRATION ──────────────────────────────────────
    if (role === "filer") {
      const [guyana] = await db
        .select()
        .from(jurisdictions)
        .where(eq(jurisdictions.code, "GY"))
        .limit(1);

      if (!guyana) {
        return NextResponse.json(
          { error: "System configuration error — jurisdiction not found. Please contact support." },
          { status: 500, headers: cors }
        );
      }

      const slug = (companyName || name)
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Trial starts after Stripe checkout (CC required) — trialEndsAt set by webhook
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: companyName || name,
          slug,
          jurisdictionId: guyana?.id,
          plan: "lite",
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

      // Sync filer to HubSpot
      try {
        const { syncSignup } = await import("@/lib/hubspot-sync");
        await syncSignup(email, name, companyName || name, "filer");
      } catch {}

      return NextResponse.json({
        success: true,
        userId: user.id,
        role: "filer",
        redirectTo: "/auth/login",
      }, { headers: cors });
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
        redirectTo: "/auth/login",
      }, { headers: cors });
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

      // Sync supplier to HubSpot
      try {
        const { syncSignup } = await import("@/lib/hubspot-sync");
        await syncSignup(email, name, parsed.data.lcsLegalName || companyName || name, "supplier");
      } catch {}

      return NextResponse.json({
        success: true,
        userId: user.id,
        role: "supplier",
        redirectTo: "/auth/login",
      }, { headers: cors });
    }

    return NextResponse.json(
      { success: true, userId: user.id, role, redirectTo: "/auth/login" },
      { headers: cors }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500, headers: cors }
    );
  }
}
