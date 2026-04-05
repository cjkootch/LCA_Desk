import { db } from "@/server/db";
import { users, tenants, tenantMembers, jurisdictions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
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

    const { name, email, password, companyName } = parsed.data;

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
      })
      .returning();

    // Create membership
    await db.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: user.id,
      role: "owner",
    });

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
