import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { jobApplications, jobPostings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const applySchema = z.object({
  job_posting_id: z.string().uuid(),
  applicant_name: z.string().min(1),
  applicant_email: z.string().email(),
  applicant_phone: z.string().optional(),
  is_guyanese: z.boolean().default(true),
  nationality: z.string().optional(),
  cover_note: z.string().optional(),
  cv_url: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const data = parsed.data;

    // Verify posting exists and is open
    const [posting] = await db
      .select()
      .from(jobPostings)
      .where(eq(jobPostings.id, data.job_posting_id))
      .limit(1);

    if (!posting || posting.status !== "open") {
      return NextResponse.json({ error: "Position not found or closed" }, { status: 404 });
    }

    const [application] = await db
      .insert(jobApplications)
      .values({
        jobPostingId: data.job_posting_id,
        applicantName: data.applicant_name,
        applicantEmail: data.applicant_email,
        applicantPhone: data.applicant_phone || null,
        isGuyanese: data.is_guyanese,
        nationality: data.is_guyanese ? "Guyanese" : (data.nationality || null),
        coverNote: data.cover_note || null,
        cvUrl: data.cv_url || null,
        status: "received",
      })
      .returning();

    return NextResponse.json({
      success: true,
      applicationId: application.id,
    });
  } catch (error) {
    console.error("Application error:", error);
    return NextResponse.json({ error: "Application failed" }, { status: 500 });
  }
}
