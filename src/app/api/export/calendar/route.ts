import { auth } from "@/auth";
import { db } from "@/server/db";
import { tenantMembers, entities, reportingPeriods } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateDeadlines } from "@/lib/compliance/deadlines";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
  });
  if (!membership) return new Response("No tenant", { status: 403 });

  const ents = await db.select().from(entities)
    .where(and(eq(entities.tenantId, membership.tenantId), eq(entities.active, true)));

  const periods = await db.select().from(reportingPeriods)
    .where(eq(reportingPeriods.tenantId, membership.tenantId));

  // Generate ICS calendar
  const now = new Date();
  const currentYear = now.getFullYear();
  const events: string[] = [];

  // Add existing period deadlines
  for (const period of periods) {
    if (period.status === "submitted" || period.status === "acknowledged") continue;
    const entityName = ents.find(e => e.id === period.entityId)?.legalName || "Entity";
    const reportLabel = period.reportType === "half_yearly_h1" ? "H1 Half-Yearly" :
      period.reportType === "half_yearly_h2" ? "H2 Half-Yearly" :
      period.reportType === "annual_plan" ? "Annual Plan" : "Performance Report";

    const dueDate = new Date(period.dueDate);
    const uid = `lca-${period.id}@lcadesk.com`;

    // Main deadline event
    events.push(formatEvent({
      uid,
      summary: `LCA Filing Due: ${reportLabel} — ${entityName}`,
      description: `Local Content ${reportLabel} Report for ${entityName} is due.\\n\\nPeriod: ${period.periodStart} to ${period.periodEnd}\\n\\nSubmit to: localcontent@nre.gov.gy\\n\\nManage: https://app.lcadesk.com/dashboard/entities/${period.entityId}/periods/${period.id}`,
      dtstart: formatDate(dueDate),
      dtend: formatDate(dueDate),
      location: "Local Content Secretariat, Ministry of Natural Resources",
    }));

    // 14-day reminder
    const reminder14 = new Date(dueDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    if (reminder14 > now) {
      events.push(formatEvent({
        uid: `lca-${period.id}-14d@lcadesk.com`,
        summary: `14 Days: ${reportLabel} Due — ${entityName}`,
        description: `Your ${reportLabel} report for ${entityName} is due in 14 days.\\n\\nStart preparing: https://app.lcadesk.com/dashboard/entities/${period.entityId}/periods/${period.id}`,
        dtstart: formatDate(reminder14),
        dtend: formatDate(reminder14),
      }));
    }

    // 7-day reminder
    const reminder7 = new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (reminder7 > now) {
      events.push(formatEvent({
        uid: `lca-${period.id}-7d@lcadesk.com`,
        summary: `⚠ 7 Days: ${reportLabel} Due — ${entityName}`,
        description: `URGENT: Your ${reportLabel} report for ${entityName} is due in 7 days.\\n\\nFinalize and submit: https://app.lcadesk.com/dashboard/entities/${period.entityId}/periods/${period.id}/export`,
        dtstart: formatDate(reminder7),
        dtend: formatDate(reminder7),
      }));
    }
  }

  // Also add upcoming deadlines for next year if no periods created yet
  for (const entity of ents) {
    // Use entity's jurisdiction for future deadlines
    const entityJurisdiction = entity.jurisdictionId ? "GY" : "GY"; // TODO: lookup from jurisdictions table
    const futureDeadlines = calculateDeadlines(entityJurisdiction, currentYear + 1);
    for (const dl of futureDeadlines) {
      const exists = periods.some(p => p.entityId === entity.id && p.reportType === dl.type && p.fiscalYear === currentYear + 1);
      if (!exists && dl.due_date > now) {
        events.push(formatEvent({
          uid: `lca-future-${entity.id}-${dl.type}-${currentYear + 1}@lcadesk.com`,
          summary: `LCA Filing: ${dl.label} — ${entity.legalName}`,
          description: `${dl.label} for ${entity.legalName} will be due.\\n\\nPeriod: ${dl.period_start.toISOString().slice(0, 10)} to ${dl.period_end.toISOString().slice(0, 10)}`,
          dtstart: formatDate(dl.due_date),
          dtend: formatDate(dl.due_date),
        }));
      }
    }
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LCA Desk//Compliance Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:LCA Desk — Compliance Deadlines",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=lca_desk_compliance_calendar.ics",
    },
  });
}

function formatDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").slice(0, 15) + "Z";
}

function formatEvent(e: { uid: string; summary: string; description: string; dtstart: string; dtend: string; location?: string }): string {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART;VALUE=DATE:${e.dtstart.slice(0, 8)}`,
    `DTEND;VALUE=DATE:${e.dtend.slice(0, 8)}`,
    `SUMMARY:${e.summary}`,
    `DESCRIPTION:${e.description}`,
  ];
  if (e.location) lines.push(`LOCATION:${e.location}`);
  lines.push("BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${e.summary}`, "END:VALARM");
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}
