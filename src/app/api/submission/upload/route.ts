import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
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

    const isImage = file.type.startsWith("image/");
    const isDoc = ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(file.type);

    if (!isImage && !isDoc) {
      return NextResponse.json({ error: `File type "${file.type}" not accepted.` }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || (isImage ? "jpg" : "bin");
    const fileKey = `${session.user.id}/${randomUUID()}.${ext}`;

    const blob = await put(fileKey, file, {
      access: "public",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN || process.env.LCA_DESK_BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      fileKey: blob.url,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
