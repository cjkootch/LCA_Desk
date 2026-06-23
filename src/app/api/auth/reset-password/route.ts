import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, passwordResetTokens } from "@/server/db/schema";
import { eq, and, gte, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid reset link" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const now = new Date();

    const [resetToken] = await db.select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
    }).from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt),
      ))
      .limit(1);

    if (!resetToken) {
      return NextResponse.json({ error: "This reset link is invalid or has already been used." }, { status: 400 });
    }

    if (new Date(resetToken.expiresAt) < now) {
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);

    await db.update(users)
      .set({ passwordHash: hash })
      .where(eq(users.id, resetToken.userId));

    await db.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return NextResponse.json({ success: true, message: "Password has been reset. You can now sign in." });
  } catch (err) {
    console.error("Password reset error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
