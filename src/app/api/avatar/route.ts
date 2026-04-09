import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getDownloadUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("id");

  if (!userId || userId === "undefined" || userId === "null") {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const [user] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let rawUrl = user?.avatarUrl || "";

    if (!rawUrl) {
      return new NextResponse(null, { status: 404 });
    }

    // Handle old proxy format: /api/submission/download?key=BLOB_URL&name=...
    if (rawUrl.startsWith("/api/")) {
      try {
        const parsed = new URL(rawUrl, "https://app.lcadesk.com");
        rawUrl = parsed.searchParams.get("key") || "";
      } catch {}
    }

    if (!rawUrl) {
      return new NextResponse(null, { status: 404 });
    }

    // Vercel Blob URL — get signed download URL and redirect
    if (rawUrl.includes("blob.vercel-storage.com")) {
      const signedUrl = await getDownloadUrl(rawUrl);
      return NextResponse.redirect(signedUrl, 302);
    }

    // Any other http URL — redirect directly
    if (rawUrl.startsWith("http")) {
      return NextResponse.redirect(rawUrl, 302);
    }

    return new NextResponse(null, { status: 404 });
  } catch (err) {
    console.error("[avatar] error for userId", userId, ":", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
