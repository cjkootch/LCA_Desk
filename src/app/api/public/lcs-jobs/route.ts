import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { lcsEmploymentNotices } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await db
    .select({
      id: lcsEmploymentNotices.id,
      companyName: lcsEmploymentNotices.companyName,
      jobTitle: lcsEmploymentNotices.jobTitle,
      employmentCategory: lcsEmploymentNotices.employmentCategory,
      noticeType: lcsEmploymentNotices.noticeType,
      description: lcsEmploymentNotices.description,
      qualifications: lcsEmploymentNotices.qualifications,
      location: lcsEmploymentNotices.location,
      closingDate: lcsEmploymentNotices.closingDate,
      postedDate: lcsEmploymentNotices.postedDate,
      sourceUrl: lcsEmploymentNotices.sourceUrl,
      status: lcsEmploymentNotices.status,
      aiSummary: lcsEmploymentNotices.aiSummary,
    })
    .from(lcsEmploymentNotices)
    .orderBy(desc(lcsEmploymentNotices.scrapedAt))
    .limit(200);

  // Extract AI teaser and structured fields for marketing site
  const jobsWithTeaser = jobs.map(j => {
    let aiTeaser: string | null = null;
    let aiData: {
      summary?: string;
      responsibilities?: string[];
      skills?: string[];
      experience_required?: string;
      education_required?: string;
      employment_type?: string;
      how_to_apply?: string;
      guyanese_first_consideration?: boolean;
    } | null = null;

    if (j.aiSummary) {
      try {
        const parsed = JSON.parse(j.aiSummary);
        aiTeaser = parsed.summary || null;
        aiData = {
          summary: parsed.summary,
          responsibilities: parsed.responsibilities,
          skills: parsed.skills,
          experience_required: parsed.experience_required,
          education_required: parsed.education_required,
          employment_type: parsed.employment_type,
          how_to_apply: parsed.how_to_apply,
          guyanese_first_consideration: parsed.guyanese_first_consideration,
        };
      } catch {}
    }

    return {
      id: j.id,
      companyName: j.companyName,
      jobTitle: j.jobTitle,
      employmentCategory: j.employmentCategory,
      noticeType: j.noticeType,
      description: j.description,
      qualifications: j.qualifications,
      location: j.location,
      closingDate: j.closingDate,
      postedDate: j.postedDate,
      sourceUrl: j.sourceUrl,
      status: j.status,
      aiTeaser,
      aiData,
    };
  });

  const open = jobsWithTeaser.filter(j => j.status === "open");
  const closed = jobsWithTeaser.filter(j => j.status === "closed");

  return NextResponse.json({
    jobs: jobsWithTeaser,
    summary: {
      total: jobsWithTeaser.length,
      open: open.length,
      closed: closed.length,
      companies: [...new Set(jobsWithTeaser.map(j => j.companyName))].length,
      categories: [...new Set(jobsWithTeaser.map(j => j.employmentCategory).filter(Boolean))],
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
