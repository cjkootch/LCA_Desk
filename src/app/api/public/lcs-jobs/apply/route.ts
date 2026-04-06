import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { lcsEmploymentNotices } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendEmail } from "@/lib/email/client";

const applySchema = z.object({
  job_id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  cover_letter: z.string().optional(),
  resume_url: z.string().optional(),
  is_guyanese: z.boolean().default(true),
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
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400, headers: CORS_HEADERS });
    }

    const { job_id, name, email, phone, cover_letter, resume_url } = parsed.data;

    // Fetch the LCS job posting
    const [job] = await db.select().from(lcsEmploymentNotices)
      .where(eq(lcsEmploymentNotices.id, job_id)).limit(1);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Extract recruiter email from AI summary
    let recruiterEmail: string | null = null;
    if (job.aiSummary) {
      try {
        const parsed = JSON.parse(job.aiSummary);
        recruiterEmail = parsed.contact_email || null;
        // Also try how_to_apply for embedded emails
        if (!recruiterEmail && parsed.how_to_apply) {
          const emailMatch = parsed.how_to_apply.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) recruiterEmail = emailMatch[0].toLowerCase();
        }
      } catch {}
    }

    const jobTitle = job.jobTitle || "Open Position";
    const companyName = job.companyName || "Employer";

    // 1. Send to recruiter if we have their email
    let sentToRecruiter = false;
    if (recruiterEmail) {
      const result = await sendEmail({
        to: recruiterEmail,
        subject: `New Application: ${jobTitle} — via LCA Desk`,
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background: #064E3B; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <img src="https://app.lcadesk.com/logo-white-lca.png" alt="LCA Desk" width="120" />
            </div>
            <div style="background: #fff; padding: 32px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="margin: 0 0 8px; color: #0F172A;">New Application via LCA Desk</h2>
              <p style="color: #475569; font-size: 14px;">A candidate has applied for the following position through the LCA Desk Jobs Portal:</p>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #FAFBFC; border-radius: 8px;">
                <tr><td style="padding: 10px 16px; color: #94A3B8; font-size: 13px; width: 130px;">Position</td><td style="padding: 10px 16px; font-weight: 600; color: #0F172A; font-size: 13px;">${jobTitle}</td></tr>
                <tr><td style="padding: 10px 16px; color: #94A3B8; font-size: 13px;">Applicant</td><td style="padding: 10px 16px; font-weight: 600; color: #0F172A; font-size: 13px;">${name}</td></tr>
                <tr><td style="padding: 10px 16px; color: #94A3B8; font-size: 13px;">Email</td><td style="padding: 10px 16px; font-size: 13px;"><a href="mailto:${email}" style="color: #047857;">${email}</a></td></tr>
                ${phone ? `<tr><td style="padding: 10px 16px; color: #94A3B8; font-size: 13px;">Phone</td><td style="padding: 10px 16px; font-size: 13px;">${phone}</td></tr>` : ""}
              </table>

              ${cover_letter ? `<h3 style="color: #0F172A; font-size: 14px; margin: 0 0 8px;">Cover Letter</h3><div style="background: #FAFBFC; padding: 16px; border-radius: 8px; margin-bottom: 16px;"><p style="white-space: pre-wrap; color: #475569; font-size: 13px; margin: 0;">${cover_letter}</p></div>` : ""}
              ${resume_url ? `<p><a href="${resume_url}" style="display: inline-block; background: #047857; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">Download CV/Resume</a></p>` : ""}

              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
              <p style="font-size: 11px; color: #94A3B8; margin: 0;">
                This application was submitted through <a href="https://lcadesk.com/jobs" style="color: #047857;">LCA Desk</a>,
                Guyana's Local Content Act compliance platform. Under Section 12 of the LCA 2021,
                first consideration must be given to Guyanese nationals.
              </p>
            </div>
          </div>
        `,
        replyTo: email,
      });
      sentToRecruiter = result.success;
    }

    // 2. Send confirmation to applicant
    sendEmail({
      to: email,
      subject: `Application Submitted: ${jobTitle} at ${companyName}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #064E3B; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <img src="https://app.lcadesk.com/logo-white-lca.png" alt="LCA Desk" width="120" />
          </div>
          <div style="background: #fff; padding: 32px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="margin: 0 0 8px; color: #0F172A;">Application Submitted</h2>
            <p style="color: #475569; font-size: 14px;">Hi ${name},</p>
            <p style="color: #475569; font-size: 14px;">Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been submitted${sentToRecruiter ? " and forwarded to the employer" : ""}.</p>

            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-size: 13px; color: #065F46;">
                <strong>Your rights under the LCA:</strong> As a Guyanese national, you are entitled to
                first consideration for this position under Section 12 of the Local Content Act 2021,
                and equal pay under Section 18.
              </p>
            </div>

            <p style="font-size: 14px; color: #475569;">
              <a href="https://lcadesk.com/jobs" style="color: #047857; font-weight: 600;">Browse more positions →</a>
            </p>
          </div>
        </div>
      `,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      sentToRecruiter,
      companyName,
      jobTitle,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("LCS job application error:", error);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500, headers: CORS_HEADERS });
  }
}
