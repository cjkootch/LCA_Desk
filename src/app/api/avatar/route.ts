import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("id");

  if (!userId) {
    return new NextResponse("Missing id", { status: 400 });
  }

  try {
    const [user] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const rawUrl = user?.avatarUrl;
    if (!rawUrl) {
      return new NextResponse(null, { status: 404 });
    }

    console.log("[avatar] rawUrl:", rawUrl.slice(0, 100));

    // Old proxy format: /api/submission/download?key=BLOB_URL&name=...
    // Extract the actual blob URL from the key param
    let blobUrl = rawUrl;
    if (rawUrl.startsWith("/api/submission/download")) {
      try {
        const parsed = new URL(rawUrl, "https://app.lcadesk.com");
        blobUrl = parsed.searchParams.get("key") || rawUrl;
        console.log("[avatar] extracted from proxy:", blobUrl.slice(0, 100));
      } catch {}
    }

    // Vercel Blob URL — get signed download and proxy bytes
    if (blobUrl.includes("blob.vercel-storage.com")) {
      const signedUrl = await getDownloadUrl(blobUrl);
      const res = await fetch(signedUrl);
      if (!res.ok) {
        console.error("[avatar] blob fetch failed:", res.status);
        return new NextResponse(null, { status: 502 });
      }

      return new NextResponse(res.body, {
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // Any other http URL — redirect
    if (blobUrl.startsWith("http")) {
      return NextResponse.redirect(blobUrl);
    }

    console.error("[avatar] unrecognized format:", blobUrl.slice(0, 100));
    return new NextResponse(null, { status: 404 });
  } catch (err) {
    console.error("[avatar] error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
