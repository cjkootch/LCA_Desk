import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions, entities } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
  accountType: z.enum(["self", "others"]).optional(),
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

    const { name, email, password, companyName, accountType } = parsed.data;

    // Check if user exists
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

    // Create user
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .returning();

    // Get Guyana jurisdiction
    const [guyana] = await db
      .select()
      .from(jurisdictions)
      .where(eq(jurisdictions.code, "GY"))
      .limit(1);

    // Create tenant
    const slug = companyName
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: companyName,
        slug,
        jurisdictionId: guyana?.id,
        // Give "others" (consultants) a higher entity limit
        planEntityLimit: accountType === "others" ? 5 : 1,
      })
      .returning();

    // Create membership
    await db.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: user.id,
      role: "owner",
    });

    // If filing for self, auto-create the first entity from signup info
    if (accountType === "self" && guyana) {
      await db.insert(entities).values({
        tenantId: tenant.id,
        jurisdictionId: guyana.id,
        legalName: companyName,
        companyType: "contractor",
        contactName: name,
        contactEmail: email,
      });
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      tenantId: tenant.id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
