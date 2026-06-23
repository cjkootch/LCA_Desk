import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, passwordResetTokens } from "@/server/db/schema";
import { eq, and, gte, isNull } from "drizzle-orm";
import { sendEmail } from "@/lib/email/client";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: "If an account exists with that email, you will receive a password reset link.",
    });

    const [user] = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) return successResponse;

    // Rate limit: max 3 unused tokens per user in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTokens = await db.select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        gte(passwordResetTokens.createdAt, oneHourAgo),
        isNull(passwordResetTokens.usedAt),
      ));

    if (recentTokens.length >= 3) return successResponse;

    // Generate a secure token (64 hex chars)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetUrl = `${process.env.NEXTAUTH_URL || "https://app.lcadesk.com"}/auth/reset-password?token=${token}`;
    const firstName = (user.name || "").split(" ")[0] || "there";

    await sendEmail({
      to: normalizedEmail,
      subject: "Reset your LCA Desk password",
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FAFBFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFBFC;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
<tr><td style="background-color:#047857;padding:24px 32px;">
  <img src="https://app.lcadesk.com/logo-white-lca.png" alt="LCA Desk" width="120" style="display:block;" />
</td></tr>
<tr><td style="padding:32px;">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;">Reset your password</h1>
  <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
    Hi ${firstName}, we received a request to reset the password for your LCA Desk account. Click the button below to set a new password.
  </p>
  <a href="${resetUrl}" style="display:inline-block;background-color:#047857;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;margin:0 0 20px;">
    Reset Password
  </a>
  <p style="margin:0 0 8px;font-size:12px;color:#94A3B8;line-height:1.5;">
    This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
  </p>
  <p style="margin:0;font-size:11px;color:#CBD5E1;word-break:break-all;">
    ${resetUrl}
  </p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0;text-align:center;">
  <p style="margin:0;font-size:11px;color:#94A3B8;">LCA Desk — Local Content Compliance Platform</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
    });

    return successResponse;
  } catch (err) {
    console.error("Password reset request error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
