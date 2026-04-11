import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const description = formData.get("description") as string;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, and GIF images allowed" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${randomUUID()}.${ext}`;

  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`course-images/${filename}`, file, { access: "public" });
    return NextResponse.json({ url: blob.url, description: description.trim() });
  } catch {
    // Fallback: write to public/uploads/course-images/
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");
    const dir = join(process.cwd(), "public", "uploads", "course-images");
    await mkdir(dir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(join(dir, filename), Buffer.from(bytes));
    return NextResponse.json({ url: `/uploads/course-images/${filename}`, description: description.trim() });
  }
}
