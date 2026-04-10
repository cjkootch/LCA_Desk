import { db } from "@/server/db";
import { courses, courseModules } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Inline the seed logic to avoid "use server" conflicts
function _getLcaModuleData() {
  // We just need to trigger the update, so import dynamically
  return null;
}

export async function GET() {
  try {
    // Directly update the modules in the database
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "lca-fundamentals")).limit(1);
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    // Get existing modules
    const existingModules = await db.select({ 
      id: courseModules.id, 
      orderIndex: courseModules.orderIndex,
      contentLen: courseModules.content 
    }).from(courseModules)
      .where(eq(courseModules.courseId, course.id))
      .orderBy(courseModules.orderIndex);

    // Import and call the seed function using dynamic import pattern
    const { seedLcaCourse } = await import("@/server/actions/training");
    
    // The seed function should update in place
    const result = await seedLcaCourse();

    // Re-check modules after seed
    const updatedModules = await db.select({ 
      id: courseModules.id, 
      title: courseModules.title,
      content: courseModules.content 
    }).from(courseModules)
      .where(eq(courseModules.courseId, course.id))
      .orderBy(courseModules.orderIndex);

    return NextResponse.json({ 
      courseId: course.id,
      seedResult: result,
      before: existingModules.map(m => ({ orderIndex: m.orderIndex, contentLen: m.contentLen?.length })),
      after: updatedModules.map(m => ({ 
        title: m.title, 
        contentLen: m.content?.length,
        preview: m.content?.substring(0, 80) 
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: String(error), stack: (error as Error).stack }, { status: 500 });
  }
}
