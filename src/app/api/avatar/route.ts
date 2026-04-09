import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getDownloadUrl } from "@vercel/blob";

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

    if (!user?.avatarUrl) {
      return new NextResponse(null, { status: 404 });
    }

    const rawUrl = user.avatarUrl;

    // If it's a blob URL, get a signed download URL and proxy it
    if (rawUrl.includes("blob.vercel-storage.com")) {
      const signedUrl = await getDownloadUrl(rawUrl);
      const res = await fetch(signedUrl);
      if (!res.ok) return new NextResponse(null, { status: 404 });

      return new NextResponse(res.body, {
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // If it's any other URL, redirect
    if (rawUrl.startsWith("http")) {
      return NextResponse.redirect(rawUrl);
    }

    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
