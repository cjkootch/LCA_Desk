"use server";

import { db } from "@/server/db";
import { courses, courseModules } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { seedLcaCourse } from "@/server/actions";

export async function GET() {
  try {
    // Force re-seed
    const courseId = await seedLcaCourse();
    
    // Verify the content was updated
    const modules = await db.select({
      id: courseModules.id,
      title: courseModules.title,
      contentLength: courseModules.content,
    }).from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(courseModules.orderIndex);
    
    const result = modules.map(m => ({
      title: m.title,
      contentLength: m.contentLength?.length || 0,
      preview: m.contentLength?.substring(0, 100) || "",
    }));
    
    return NextResponse.json({ courseId, modules: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
