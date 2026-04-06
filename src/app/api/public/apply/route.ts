import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { jobApplications, jobPostings, tenants, tenantMembers, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { notifyApplicationReceived } from "@/lib/email/unified-notify";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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

    // Notify employer (fire and forget)
    const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, posting.tenantId)).limit(1);
    const members = await db
      .select({ email: users.email })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.userId, users.id))
      .where(eq(tenantMembers.tenantId, posting.tenantId));

    for (const member of members) {
      if (member.email) {
        const [memberUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, member.email)).limit(1);
        if (memberUser) {
          notifyApplicationReceived({
            userId: memberUser.id,
            tenantId: posting.tenantId,
            employerName: tenant?.name || "",
            applicantName: data.applicant_name,
            jobTitle: posting.jobTitle,
            isGuyanese: data.is_guyanese,
            postingId: posting.id,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      applicationId: application.id,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Application error:", error);
    return NextResponse.json({ error: "Application failed" }, { status: 500, headers: CORS_HEADERS });
  }
}
