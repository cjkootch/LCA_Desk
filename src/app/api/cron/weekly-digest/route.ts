import { db } from "@/server/db";
import { tenants, tenantMembers, users, entities, reportingPeriods, expenditureRecords, employmentRecords, lcsOpportunities, lcsRegister } from "@/server/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all active tenants
    const allTenants = await db.select().from(tenants).where(eq(tenants.active, true)).limit(500);
    let sent = 0;

    for (const tenant of allTenants) {
      // Get team members
      const members = await db
        .select({ userId: tenantMembers.userId, email: users.email, name: users.name, notificationPreferences: users.notificationPreferences })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tenantMembers.tenantId, tenant.id));

      // Check if anyone has weekly digest enabled
      const recipients = members.filter(m => {
        if (!m.notificationPreferences) return true; // default on
        try { const prefs = JSON.parse(m.notificationPreferences); return prefs.weekly_digest !== false; }
        catch { return true; }
      });

      if (recipients.length === 0) continue;

      // Get tenant data
      const ents = await db.select().from(entities).where(and(eq(entities.tenantId, tenant.id), eq(entities.active, true)));
      const periods = await db.select().from(reportingPeriods).where(eq(reportingPeriods.tenantId, tenant.id));
      const allExp = await db.select().from(expenditureRecords).where(eq(expenditureRecords.tenantId, tenant.id));
      const allEmp = await db.select().from(employmentRecords).where(eq(employmentRecords.tenantId, tenant.id));

      if (ents.length === 0) continue; // skip empty tenants

      // Calculate metrics
      const totalSpend = allExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
      const guySpend = allExp.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
      const lcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 10) / 10 : 0;

      const totalEmp = allEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
      const guyEmp = allEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
      const empPct = totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 10) / 10 : 0;

      // Upcoming deadlines
      const now = new Date();
      const upcoming = periods
        .filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) > now)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 3);

      const overdue = periods.filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) < now);

      // Expiring supplier certs
      const certIds = [...new Set(allExp.filter(e => e.supplierCertificateId).map(e => e.supplierCertificateId))];
      const expiringCerts: string[] = [];
      for (const certId of certIds.slice(0, 20)) {
        if (!certId) continue;
        const [reg] = await db.select({ expirationDate: lcsRegister.expirationDate, legalName: lcsRegister.legalName })
          .from(lcsRegister).where(eq(lcsRegister.certId, certId)).limit(1);
        if (reg?.expirationDate) {
          const daysLeft = Math.ceil((new Date(reg.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 60 && daysLeft > 0) expiringCerts.push(`${reg.legalName} (${daysLeft} days)`);
        }
      }

      // New opportunities this week
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newOpps = await db.select({ id: lcsOpportunities.id })
        .from(lcsOpportunities)
        .where(and(eq(lcsOpportunities.status, "active"), gte(lcsOpportunities.scrapedAt, oneWeekAgo)))
        .limit(50);

      // Build email
      const html = buildDigestEmail({
        companyName: tenant.name,
        lcRate, empPct, totalEmp, guyEmp,
        entityCount: ents.length,
        upcoming: upcoming.map(p => ({
          entity: ents.find(e => e.id === p.entityId)?.legalName || "Unknown",
          type: p.reportType.replace(/_/g, " "),
          dueDate: new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          daysLeft: Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        })),
        overdueCount: overdue.length,
        expiringCerts,
        newOpportunities: newOpps.length,
      });

      // Send to each recipient
      for (const member of recipients) {
        if (!member.email) continue;
        await sendEmail({
          to: member.email,
          subject: `Weekly Compliance Digest — ${tenant.name}`,
          html,
        });
        sent++;
      }
    }

    return NextResponse.json({ success: true, emailsSent: sent });
  } catch (error) {
    console.error("Weekly digest error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

function buildDigestEmail(data: {
  companyName: string;
  lcRate: number;
  empPct: number;
  totalEmp: number;
  guyEmp: number;
  entityCount: number;
  upcoming: Array<{ entity: string; type: string; dueDate: string; daysLeft: number }>;
  overdueCount: number;
  expiringCerts: string[];
  newOpportunities: number;
}) {
  const accent = "#047857";
  const warning = "#D97706";
  const danger = "#DC2626";

  const deadlineRows = data.upcoming.map(d => `
    <tr>
      <td style="padding:8px;font-size:13px;color:#0F172A;">${d.entity}</td>
      <td style="padding:8px;font-size:13px;color:#475569;">${d.type}</td>
      <td style="padding:8px;font-size:13px;color:#475569;">${d.dueDate}</td>
      <td style="padding:8px;font-size:13px;font-weight:600;color:${d.daysLeft <= 14 ? danger : d.daysLeft <= 30 ? warning : accent};">${d.daysLeft}d</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAFBFC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
<tr><td style="background:${accent};padding:24px 32px;">
  <img src="https://app.lcadesk.com/logo-white-lca.png" alt="LCA Desk" width="120" />
</td></tr>
<tr><td style="padding:32px;">
  <h2 style="margin:0 0 4px;color:#0F172A;font-size:18px;">Weekly Compliance Digest</h2>
  <p style="margin:0 0 24px;color:#94A3B8;font-size:13px;">${data.companyName} — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

  ${data.overdueCount > 0 ? `
  <div style="background:#FEF2F2;border:1px solid #FCA5A520;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
    <p style="margin:0;font-size:13px;color:${danger};font-weight:600;">⚠ ${data.overdueCount} overdue report${data.overdueCount !== 1 ? "s" : ""} — action required</p>
  </div>
  ` : ""}

  <table style="width:100%;margin-bottom:24px;">
    <tr>
      <td style="text-align:center;padding:12px;background:#FAFBFC;border-radius:8px;">
        <p style="margin:0;font-size:24px;font-weight:700;color:${data.lcRate >= 50 ? accent : warning};">${data.lcRate}%</p>
        <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;">LC Rate</p>
      </td>
      <td style="width:12px;"></td>
      <td style="text-align:center;padding:12px;background:#FAFBFC;border-radius:8px;">
        <p style="margin:0;font-size:24px;font-weight:700;color:${data.empPct >= 60 ? accent : warning};">${data.empPct}%</p>
        <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;">GY Employment</p>
      </td>
      <td style="width:12px;"></td>
      <td style="text-align:center;padding:12px;background:#FAFBFC;border-radius:8px;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#0F172A;">${data.entityCount}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;">Entities</p>
      </td>
    </tr>
  </table>

  ${data.upcoming.length > 0 ? `
  <h3 style="margin:0 0 8px;font-size:14px;color:#0F172A;">Upcoming Deadlines</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#FAFBFC;border-radius:8px;">
    <tr style="border-bottom:1px solid #E2E8F0;">
      <th style="padding:8px;font-size:11px;color:#94A3B8;text-align:left;">Entity</th>
      <th style="padding:8px;font-size:11px;color:#94A3B8;text-align:left;">Report</th>
      <th style="padding:8px;font-size:11px;color:#94A3B8;text-align:left;">Due</th>
      <th style="padding:8px;font-size:11px;color:#94A3B8;text-align:left;">Days</th>
    </tr>
    ${deadlineRows}
  </table>
  ` : ""}

  ${data.expiringCerts.length > 0 ? `
  <h3 style="margin:0 0 8px;font-size:14px;color:#0F172A;">Supplier Cert Expiring</h3>
  <ul style="margin:0 0 20px;padding-left:20px;">
    ${data.expiringCerts.map(c => `<li style="font-size:13px;color:#475569;margin:4px 0;">${c}</li>`).join("")}
  </ul>
  ` : ""}

  ${data.newOpportunities > 0 ? `
  <div style="background:#ECFDF5;border:1px solid ${accent}20;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;font-size:13px;color:${accent};font-weight:600;">${data.newOpportunities} new opportunities posted this week</p>
  </div>
  ` : ""}

  <a href="https://app.lcadesk.com/dashboard" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Dashboard</a>

  <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
  <p style="margin:0;font-size:11px;color:#94A3B8;">
    <a href="https://app.lcadesk.com/dashboard/settings" style="color:${accent};">Manage notification preferences</a>
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
