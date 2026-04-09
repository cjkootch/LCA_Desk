import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getDownloadUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    if (!rawUrl) return new NextResponse(null, { status: 404 });

    // Handle old proxy format
    if (rawUrl.startsWith("/api/")) {
      try {
        const parsed = new URL(rawUrl, "https://app.lcadesk.com");
        rawUrl = parsed.searchParams.get("key") || "";
      } catch {}
    }

    if (!rawUrl) return new NextResponse(null, { status: 404 });

    // For private blobs, get signed URL; public blobs work directly
    let imageUrl = rawUrl;
    if (rawUrl.includes("blob.vercel-storage.com") && !rawUrl.includes("public")) {
      imageUrl = await getDownloadUrl(rawUrl);
    }

    // Stream the image through — don't buffer the whole thing
    const upstream = await fetch(imageUrl);
    if (!upstream.ok) {
      console.error("[avatar] upstream fetch failed:", upstream.status, upstream.statusText);
      return new NextResponse(null, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Content-Length": upstream.headers.get("content-length") || "",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[avatar] error:", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
