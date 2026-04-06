import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readFile } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "uploads", "submissions");

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fileKey = url.searchParams.get("key");
  const fileName = url.searchParams.get("name") || "report";

  if (!fileKey || fileKey.includes("..") || fileKey.includes("/")) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  try {
    const buffer = await readFile(join(UPLOAD_DIR, fileKey));
    const ext = fileKey.split(".").pop()?.toLowerCase();
    const contentType = ext === "pdf" ? "application/pdf" :
      ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
      "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
