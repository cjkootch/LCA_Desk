import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

  // Vercel Blob URLs are direct public URLs — redirect to them
  if (fileKey.startsWith("http")) {
    return NextResponse.redirect(fileKey);
  }

  // Legacy local file fallback — return 404 since local storage doesn't persist on Vercel
  return NextResponse.json({ error: "File not found. It may have been uploaded before cloud storage was enabled." }, { status: 404 });
}
