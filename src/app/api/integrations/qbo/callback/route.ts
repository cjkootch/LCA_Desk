import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { tenants, tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!;
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!;
const QBO_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "https://lcadesk.com"}/api/integrations/qbo/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lcadesk.com";

  if (error || !code || !realmId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?qbo=error`);
  }

  try {
    const stateData = JSON.parse(Buffer.from(state || "", "base64url").toString());
    const userId = stateData.userId;

    // Exchange code for tokens
    const basicAuth = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64");
    const tokenResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: QBO_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("QBO token exchange failed:", await tokenResponse.text());
      return NextResponse.redirect(`${appUrl}/dashboard/settings?qbo=error`);
    }

    const tokens = await tokenResponse.json();

    // Fetch company info
    const companyResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Accept": "application/json",
        },
      }
    );

    let companyName = "";
    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      companyName = companyData.CompanyInfo?.CompanyName || "";
    }

    // Store on tenant
    const membership = await db.query.tenantMembers.findFirst({
      where: eq(tenantMembers.userId, userId),
    });

    if (membership) {
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      await db
        .update(tenants)
        .set({
          qboRealmId: realmId,
          qboCompanyName: companyName,
          qboAccessToken: tokens.access_token,
          qboRefreshToken: tokens.refresh_token,
          qboTokenExpiresAt: expiresAt,
          qboConnectedAt: new Date(),
        })
        .where(eq(tenants.id, membership.tenantId));
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?qbo=connected`);
  } catch (err) {
    console.error("QBO callback error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?qbo=error`);
  }
}
