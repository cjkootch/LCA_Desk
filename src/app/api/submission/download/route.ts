import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDownloadUrl } from "@vercel/blob";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fileKey = url.searchParams.get("key");
  const fileName = url.searchParams.get("name") || "file";

  if (!fileKey) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  try {
    // Vercel Blob private URL — get a signed download URL
    if (fileKey.includes("blob.vercel-storage.com")) {
      const downloadUrl = await getDownloadUrl(fileKey);
      return NextResponse.redirect(downloadUrl);
    }

    // Direct URL (legacy or already signed)
    if (fileKey.startsWith("http")) {
      return NextResponse.redirect(fileKey);
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
  }
}
