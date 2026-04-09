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
    if (!rawUrl) return new NextResponse(null, { status: 404 });

    // Handle old proxy format
    if (rawUrl.startsWith("/api/")) {
      try {
        const parsed = new URL(rawUrl, "https://app.lcadesk.com");
        rawUrl = parsed.searchParams.get("key") || "";
      } catch {}
    }

    if (!rawUrl) return new NextResponse(null, { status: 404 });

    // Get the actual image bytes and serve them directly
    let imageUrl = rawUrl;
    if (rawUrl.includes("blob.vercel-storage.com")) {
      imageUrl = await getDownloadUrl(rawUrl);
    }

    const res = await fetch(imageUrl);
    if (!res.ok) return new NextResponse(null, { status: 502 });

    const blob = await res.arrayBuffer();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[avatar] error for userId", userId, ":", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
