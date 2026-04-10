import { db } from "@/server/db";
import { reportingPeriods, entities, tenantMembers, users, expenditureRecords, employmentRecords, capacityDevelopmentRecords, narrativeDrafts } from "@/server/db/schema";
import { eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { notifyDeadlineReminder } from "@/lib/email/unified-notify";
import { startCronRun, completeCronRun, isAlreadyRunning } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const JOB_NAME = "deadline-reminders";

// Runs weekly via Vercel Cron — checks for upcoming deadlines and sends reminders
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isAlreadyRunning(JOB_NAME)) {
    return NextResponse.json({ skipped: "already running" }, { status: 200 });
  }

  const runId = await startCronRun(JOB_NAME);
  let recordsProcessed = 0;
  let cronError: string | undefined;

  try {
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find periods with deadlines in the next 30 days that aren't submitted
    const upcomingPeriods = await db
      .select({
        periodId: reportingPeriods.id,
        reportType: reportingPeriods.reportType,
        periodStart: reportingPeriods.periodStart,
        periodEnd: reportingPeriods.periodEnd,
        dueDate: reportingPeriods.dueDate,
        status: reportingPeriods.status,
        entityId: reportingPeriods.entityId,
        tenantId: reportingPeriods.tenantId,
        entityName: entities.legalName,
      })
      .from(reportingPeriods)
      .innerJoin(entities, eq(reportingPeriods.entityId, entities.id))
      .where(
        gte(reportingPeriods.dueDate, now.toISOString().slice(0, 10))
      )
      .limit(200);

    // Filter to non-submitted with due date within 30 days
    const needsReminder = upcomingPeriods.filter(p => {
      if (p.status === "submitted" || p.status === "acknowledged") return false;
      const dueDate = new Date(p.dueDate);
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      // Send at 30, 14, 7, 3, 1 days
      return [30, 14, 7, 3, 1].includes(daysRemaining);
    });

    let sent = 0;

    for (const period of needsReminder) {
      // Get team members for this tenant
      const members = await db
        .select({ userId: tenantMembers.userId, email: users.email, name: users.name })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tenantMembers.tenantId, period.tenantId));

      // Check what's missing
      const [expCount] = await db.select({ id: expenditureRecords.id }).from(expenditureRecords).where(eq(expenditureRecords.reportingPeriodId, period.periodId)).limit(1);
      const [empCount] = await db.select({ id: employmentRecords.id }).from(employmentRecords).where(eq(employmentRecords.reportingPeriodId, period.periodId)).limit(1);
      const [capCount] = await db.select({ id: capacityDevelopmentRecords.id }).from(capacityDevelopmentRecords).where(eq(capacityDevelopmentRecords.reportingPeriodId, period.periodId)).limit(1);
      const [narCount] = await db.select({ id: narrativeDrafts.id }).from(narrativeDrafts).where(eq(narrativeDrafts.reportingPeriodId, period.periodId)).limit(1);

      const missingItems: string[] = [];
      if (!expCount) missingItems.push("Expenditure records — no data entered");
      if (!empCount) missingItems.push("Employment records — no data entered");
      if (!capCount) missingItems.push("Capacity development records — no data entered");
      if (!narCount) missingItems.push("AI narrative drafts — not generated");

      const dueDate = new Date(period.dueDate);
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const reportTypeNames: Record<string, string> = {
        half_yearly_h1: "Half-Yearly (H1)", half_yearly_h2: "Half-Yearly (H2)",
        annual_plan: "Annual Plan", performance_report: "Performance Report",
      };

      // Generate AI suggestion if Anthropic key is available
      let aiSuggestion: string | undefined;
      if (process.env.ANTHROPIC_API_KEY && missingItems.length > 0 && daysRemaining <= 14) {
        try {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const response = await claude.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 150,
            messages: [{
              role: "user",
              content: `A company "${period.entityName}" has ${daysRemaining} days to submit their ${reportTypeNames[period.reportType] || period.reportType} report. Missing: ${missingItems.join(", ")}. Write 1-2 sentences of actionable advice for completing the report on time. Be specific and urgent but professional.`,
            }],
          });
          aiSuggestion = response.content[0].type === "text" ? response.content[0].text : undefined;
        } catch {}
      }

      // Send to all team members (in-app + email via unified dispatcher)
      for (const member of members) {
        if (!member.userId) continue;
        await notifyDeadlineReminder({
          userId: member.userId,
          tenantId: period.tenantId,
          userName: member.name || "Team Member",
          entityName: period.entityName || "",
          reportType: reportTypeNames[period.reportType] || period.reportType,
          periodLabel: `${period.periodStart} to ${period.periodEnd}`,
          dueDate: dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          daysRemaining,
          missingItems,
          aiSuggestion,
          link: `/dashboard/entities/${period.entityId}`,
        });
        sent++;
      }
    }

    recordsProcessed = sent;
    return NextResponse.json({
      success: true,
      periodsChecked: upcomingPeriods.length,
      remindersNeeded: needsReminder.length,
      emailsSent: sent,
    });
  } catch (error) {
    cronError = error instanceof Error ? error.message : String(error);
    console.error("Deadline reminder cron error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  } finally {
    await completeCronRun(runId, cronError ? "failed" : "success", recordsProcessed, cronError);
  }
}
