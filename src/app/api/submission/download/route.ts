import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fileKey = url.searchParams.get("key");
  const fileName = url.searchParams.get("name") || "file";

  if (!fileKey) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  // Avatar images (used in <img> tags) — skip auth, proxy the bytes
  const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) || fileKey.includes("/avatars/");

  // Non-image files require authentication
  if (!isImage) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
  }

  try {
    if (fileKey.includes("blob.vercel-storage.com")) {
      // Get signed URL and fetch the actual bytes to serve directly
      const downloadUrl = await getDownloadUrl(fileKey);
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Blob fetch failed");

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const body = response.body;

      return new NextResponse(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(isImage ? {} : { "Content-Disposition": `attachment; filename="${fileName}"` }),
        },
      });
    }

    if (fileKey.startsWith("http")) {
      return NextResponse.redirect(fileKey);
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
  }
}
