import { NextResponse } from "next/server";
import { auth } from "@/auth";

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!;
const QBO_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "https://lcadesk.com"}/api/integrations/qbo/callback`;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL || "https://lcadesk.com"));
  }

  const state = Buffer.from(JSON.stringify({ userId: session.user.id, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    client_id: QBO_CLIENT_ID,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: QBO_REDIRECT_URI,
    state,
  });

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
