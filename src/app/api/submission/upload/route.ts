import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 10 MB." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Accepted file types: PDF, Excel (.xlsx, .xls), JPG, PNG, WebP, GIF." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const fileKey = `${session.user.id}/${randomUUID()}.${ext}`;

  const blob = await put(fileKey, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return NextResponse.json({
    fileKey: blob.url,
    fileName: file.name,
    fileSize: file.size,
  });
}
