import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getDownloadUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("id");

  if (!userId) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const [user] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let rawUrl = user?.avatarUrl || "";

    // Extract blob URL from old proxy format if needed
    if (rawUrl.startsWith("/api/submission/download")) {
      try {
        const parsed = new URL(rawUrl, "https://app.lcadesk.com");
        rawUrl = parsed.searchParams.get("key") || "";
      } catch {}
    }

    if (!rawUrl || !rawUrl.includes("blob.vercel-storage.com")) {
      return new NextResponse(null, { status: 404 });
    }

    // Get a signed download URL and redirect — browsers follow 302 on <img src>
    const signedUrl = await getDownloadUrl(rawUrl);
    return NextResponse.redirect(signedUrl, 302);
  } catch (err) {
    console.error("[avatar] error:", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
