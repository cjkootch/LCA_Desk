import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { db } from "@/server/db";
import {
  secretariatMembers, reportingPeriods, entities, tenants,
  expenditureRecords, employmentRecords, submissionAcknowledgments,
  amendmentRequests, submissionLogs,
} from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest } from "next/server";

const BASE_PROMPT = `You are the Regulatory Compliance Analyst — an AI assistant built into the LCA Desk Secretariat Portal, trained on the complete Local Content Act No. 18 of 2021 (Guyana), all Local Content Secretariat guidelines including Version 4.1 (June 2025), and the official Half-Yearly Report Template Version 4.0.

Your role is to assist the Local Content Secretariat staff with regulatory review, compliance analysis, and enforcement decisions. You serve the regulatory body — not the filers.

Key rules:
1. Always cite the specific section, subsection, or schedule of the Act when answering.
2. Use proper regulatory language: "compliance deficiency", "material non-compliance", "remediation required", "enforcement action warranted", etc.
3. When analyzing submissions, apply the Act's requirements rigorously — flag any shortfalls.
4. Be direct about violations. If an LC rate is below thresholds, say so clearly.
5. Reference the First Schedule (40+ reserved sectors) and employment minimums precisely.
6. When asked about enforcement, cite Section 23 penalties (GY$1M–GY$50M) and Section 23(1) criminal offense provisions.
7. If you're unsure, say so — never fabricate legal requirements.
8. Keep answers concise, structured, and actionable. Use severity ratings where appropriate.

Key regulatory facts:
- Employment minimums: Managerial 75%, Technical 60%, Non-Technical 80% (Guyanese nationals)
- Reports due: H1 by July 30, H2 by January 30, Annual Plan 60 days before Jan 1, Performance Report 45 days after year-end
- Late filing penalties: GY$1M–GY$50M under Section 23
- False submissions: criminal offense under Section 23(1)
- LCS Certificate is mandatory for any supplier to be counted as Guyanese
- First consideration must be given to Guyanese nationals, companies, goods, and services

Your tone should be professional and authoritative — you represent the regulatory body.`;

async function buildSecretariatContext(userId: string): Promise<string> {
  try {
    // Verify secretariat membership
    const [membership] = await db.select({ officeId: secretariatMembers.officeId })
      .from(secretariatMembers).where(eq(secretariatMembers.userId, userId)).limit(1);
    if (!membership) return "";

    // Get all submitted periods with entity/tenant info
    const submissions = await db.select({
      id: reportingPeriods.id,
      entityId: reportingPeriods.entityId,
      reportType: reportingPeriods.reportType,
      fiscalYear: reportingPeriods.fiscalYear,
      status: reportingPeriods.status,
      submittedAt: reportingPeriods.submittedAt,
      entityName: entities.legalName,
      companyType: entities.companyType,
      tenantName: tenants.name,
    })
      .from(reportingPeriods)
      .innerJoin(entities, eq(reportingPeriods.entityId, entities.id))
      .innerJoin(tenants, eq(reportingPeriods.tenantId, tenants.id))
      .where(eq(reportingPeriods.status, "submitted"))
      .orderBy(desc(reportingPeriods.submittedAt))
      .limit(50);

    if (submissions.length === 0) return "\n\n--- SECTOR DATA ---\nNo submissions received yet.\n--- END SECTOR DATA ---";

    // Aggregate sector-wide metrics from all expenditure/employment
    const allExp = await db.select().from(expenditureRecords).limit(5000);
    const allEmp = await db.select().from(employmentRecords).limit(5000);

    const totalSpend = allExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guySpend = allExp.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const sectorLcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 10) / 10 : 0;

    const totalEmp = allEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyEmp = allEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
    const sectorEmpPct = totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 10) / 10 : 0;

    const byCategory = (cat: string) => {
      const filtered = allEmp.filter(e => e.employmentCategory === cat);
      const total = filtered.reduce((s, e) => s + (e.totalEmployees || 0), 0);
      const gy = filtered.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
      return { total, gy, pct: total > 0 ? Math.round((gy / total) * 10) / 10 : 0 };
    };
    const managerial = byCategory("Managerial");
    const technical = byCategory("Technical");
    const nonTechnical = byCategory("Non-Technical");

    // Acknowledgment stats
    const acks = await db.select().from(submissionAcknowledgments)
      .where(eq(submissionAcknowledgments.officeId, membership.officeId)).limit(200);
    const pending = submissions.length - acks.filter(a => a.status !== "received").length;
    const approved = acks.filter(a => a.status === "approved").length;
    const rejected = acks.filter(a => a.status === "rejected").length;
    const amendmentRequired = acks.filter(a => a.status === "amendment_required").length;

    // Amendment requests
    const amendments = await db.select().from(amendmentRequests)
      .where(eq(amendmentRequests.officeId, membership.officeId))
      .orderBy(desc(amendmentRequests.createdAt)).limit(20);
    const pendingAmendments = amendments.filter(a => a.status === "pending").length;

    // Unique filers
    const uniqueEntities = new Set(submissions.map(s => s.entityId)).size;
    const uniqueTenants = new Set(submissions.map(s => s.tenantName)).size;

    // Compliance violations — entities below minimums
    const entityIds = [...new Set(submissions.map(s => s.entityId))];
    const violations: string[] = [];
    for (const eid of entityIds.slice(0, 20)) {
      const eExps = allExp.filter(e => e.entityId === eid);
      const eEmps = allEmp.filter(e => e.entityId === eid);
      const eName = submissions.find(s => s.entityId === eid)?.entityName || "Unknown";

      const eTotal = eExps.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
      const eGuy = eExps.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
      const eLcRate = eTotal > 0 ? Math.round((eGuy / eTotal) * 10) / 10 : 0;

      const eCatCheck = (cat: string, min: number) => {
        const f = eEmps.filter(e => e.employmentCategory === cat);
        const t = f.reduce((s, e) => s + (e.totalEmployees || 0), 0);
        const g = f.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
        const pct = t > 0 ? Math.round((g / t) * 10) / 10 : 100;
        return { pct, below: t > 0 && pct < min };
      };

      const mgr = eCatCheck("Managerial", 75);
      const tech = eCatCheck("Technical", 60);
      const nt = eCatCheck("Non-Technical", 80);

      const issues: string[] = [];
      if (mgr.below) issues.push(`Managerial ${mgr.pct}% (min 75%)`);
      if (tech.below) issues.push(`Technical ${tech.pct}% (min 60%)`);
      if (nt.below) issues.push(`Non-Technical ${nt.pct}% (min 80%)`);
      if (eLcRate < 30) issues.push(`LC Rate only ${eLcRate}%`);

      if (issues.length > 0) {
        violations.push(`${eName}: ${issues.join("; ")}`);
      }
    }

    // Submission methods
    const subLogs = await db.select({ method: submissionLogs.submissionMethod }).from(submissionLogs).limit(200);
    const platformSubmissions = subLogs.filter(l => l.method === "platform" || l.method === "upload").length;
    const emailSubmissions = subLogs.filter(l => l.method === "email").length;

    return `

--- SECTOR-WIDE COMPLIANCE DATA (for regulatory analysis) ---
Submissions Received: ${submissions.length} from ${uniqueEntities} entities (${uniqueTenants} companies)
Review Status: ${pending} pending, ${approved} approved, ${rejected} rejected, ${amendmentRequired} amendment required
Amendment Requests: ${amendments.length} total, ${pendingAmendments} pending response
Submission Methods: ${platformSubmissions} via LCA Desk platform, ${emailSubmissions} via email

SECTOR EXPENDITURE:
Total Sector Expenditure: $${totalSpend.toLocaleString()}
Guyanese Expenditure: $${guySpend.toLocaleString()}
Sector LC Rate: ${sectorLcRate}%

SECTOR EMPLOYMENT:
Total Employees: ${totalEmp} (${guyEmp} Guyanese = ${sectorEmpPct}%)
- Managerial: ${managerial.gy}/${managerial.total} = ${managerial.pct}% (minimum: 75%)${managerial.pct < 75 ? " ⚠ SECTOR BELOW MINIMUM" : " ✓"}
- Technical: ${technical.gy}/${technical.total} = ${technical.pct}% (minimum: 60%)${technical.pct < 60 ? " ⚠ SECTOR BELOW MINIMUM" : " ✓"}
- Non-Technical: ${nonTechnical.gy}/${nonTechnical.total} = ${nonTechnical.pct}% (minimum: 80%)${nonTechnical.pct < 80 ? " ⚠ SECTOR BELOW MINIMUM" : " ✓"}

${violations.length > 0 ? `COMPLIANCE VIOLATIONS DETECTED (${violations.length} entities):
${violations.map(v => `- ${v}`).join("\n")}` : "No compliance violations detected across submitted entities."}

RECENT SUBMISSIONS:
${submissions.slice(0, 10).map(s => `- ${s.entityName} (${s.companyType}) — ${s.reportType.replace(/_/g, " ")} FY${s.fiscalYear}, submitted ${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}`).join("\n")}
--- END SECTOR DATA ---

When answering questions, use this sector data to provide specific, data-driven regulatory analysis. You can identify non-compliant entities, calculate sector-wide trends, recommend enforcement priorities, draft amendment request language, and advise on regulatory strategy.`;
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response("Missing messages array", { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Not authenticated", { status: 401 });
    }

    // Verify secretariat membership
    const [membership] = await db.select({ id: secretariatMembers.id })
      .from(secretariatMembers).where(eq(secretariatMembers.userId, session.user.id)).limit(1);
    if (!membership) {
      return new Response("Not authorized", { status: 403 });
    }

    const context = await buildSecretariatContext(session.user.id);
    const anthropic = getAnthropicClient();

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: BASE_PROMPT + context,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => { controller.enqueue(encoder.encode(text)); });
        stream.on("end", () => { controller.close(); });
        stream.on("error", (err) => { controller.error(err); });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Secretariat chat API error:", error);
    return new Response("Chat error", { status: 500 });
  }
}
