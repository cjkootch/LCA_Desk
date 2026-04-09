import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { tenantMembers, entities, reportingPeriods, expenditureRecords, employmentRecords } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest } from "next/server";
import { incrementUsage } from "@/server/actions";

const BASE_PROMPT = `You are the LCA Expert — an AI assistant built into LCA Desk, trained on the complete Local Content Act No. 18 of 2021 (Guyana), all Local Content Secretariat guidelines including Version 4.1 (June 2025), and the official Half-Yearly Report Template Version 4.0.

Your role is to answer compliance questions from Contractors, Sub-Contractors, and Licensees operating in Guyana's petroleum sector. You provide accurate, specific answers grounded in the Act and guidelines.

Key rules:
1. Always cite the specific section, subsection, or schedule of the Act or Guideline when answering.
2. Use the exact terminology from the Act: "first consideration", "Guyanese company", "Local Content Secretariat", "Guyanese national", etc.
3. When referencing minimum local content percentages, cite the First Schedule of the Act.
4. Be precise about deadlines: H1 report due July 30, H2 report due January 30, Annual Plan due 60 days before January 1, Performance Report due 45 days after year end.
5. If you're unsure about something, say so — never fabricate legal requirements.
6. Keep answers concise but complete. Use bullet points for lists.
7. Always end with "Reference: [source]" citing the specific section.
8. When the user asks about THEIR data (LC rate, employment, deadlines), use the context provided below to give specific answers with real numbers.

Key facts you know:
- The Act has 23 sections and two Schedules (First Schedule: 40+ reserved sectors; Second Schedule: plan requirements)
- Penalties: GY$1M–GY$50M fines under Section 23
- False submissions are a criminal offense under Section 23(1)
- The Secretariat is led by the Director and falls under the Ministry of Natural Resources
- Reports must be submitted to localcontent@nre.gov.gy
- Employment categories: Managerial (min 75%), Technical (min 60%), Non-Technical (min 80%)
- Suppliers must have a valid LCS Certificate ID to count as Guyanese suppliers`;

async function buildUserContext(userId: string): Promise<string> {
  try {
    const membership = await db.query.tenantMembers.findFirst({
      where: eq(tenantMembers.userId, userId),
    });
    if (!membership) return "";

    const tenantId = membership.tenantId;
    const ents = await db.select().from(entities).where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)));
    const periods = await db.select().from(reportingPeriods).where(eq(reportingPeriods.tenantId, tenantId));
    const allExp = await db.select().from(expenditureRecords).where(eq(expenditureRecords.tenantId, tenantId));
    const allEmp = await db.select().from(employmentRecords).where(eq(employmentRecords.tenantId, tenantId));

    if (ents.length === 0) return "";

    // Calculate key metrics
    const totalSpend = allExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guySpend = allExp.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const lcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 10) / 10 : 0;

    const totalEmp = allEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyEmp = allEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
    const empPct = totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 10) / 10 : 0;

    const byCategory = (cat: string) => {
      const filtered = allEmp.filter(e => e.employmentCategory === cat);
      const total = filtered.reduce((s, e) => s + (e.totalEmployees || 0), 0);
      const guyanese = filtered.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
      return { total, guyanese, pct: total > 0 ? Math.round((guyanese / total) * 10) / 10 : 0 };
    };

    const managerial = byCategory("Managerial");
    const technical = byCategory("Technical");
    const nonTechnical = byCategory("Non-Technical");

    const now = new Date();
    const upcoming = periods
      .filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) > now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const overdue = periods.filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) < now);

    const guyaneseSuppliers = new Set(allExp.filter(e => !!e.supplierCertificateId).map(e => e.supplierName)).size;
    const intlSuppliers = new Set(allExp.filter(e => !e.supplierCertificateId).map(e => e.supplierName)).size;

    return `

--- USER'S ACTUAL COMPLIANCE DATA ---
Company: ${ents.map(e => e.legalName).join(", ")}
Entities: ${ents.length}
Total Expenditure: $${totalSpend.toLocaleString()}
Local Content Rate: ${lcRate}% (Guyanese: $${guySpend.toLocaleString()} / Total: $${totalSpend.toLocaleString()})
Suppliers: ${guyaneseSuppliers} Guyanese (LCS-certified), ${intlSuppliers} International

Total Employees: ${totalEmp} (${guyEmp} Guyanese = ${empPct}%)
- Managerial: ${managerial.guyanese}/${managerial.total} = ${managerial.pct}% (minimum: 75%)${managerial.pct < 75 ? " ⚠ BELOW MINIMUM" : " ✓"}
- Technical: ${technical.guyanese}/${technical.total} = ${technical.pct}% (minimum: 60%)${technical.pct < 60 ? " ⚠ BELOW MINIMUM" : " ✓"}
- Non-Technical: ${nonTechnical.guyanese}/${nonTechnical.total} = ${nonTechnical.pct}% (minimum: 80%)${nonTechnical.pct < 80 ? " ⚠ BELOW MINIMUM" : " ✓"}

Filing Periods: ${periods.length} total, ${periods.filter(p => p.status === "submitted").length} submitted
${overdue.length > 0 ? `OVERDUE: ${overdue.length} report(s) past deadline!` : ""}
${upcoming.length > 0 ? `Next deadline: ${upcoming[0].reportType.replace(/_/g, " ")} due ${new Date(upcoming[0].dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} (${Math.ceil((new Date(upcoming[0].dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days)` : ""}
--- END USER DATA ---

When the user asks about their compliance status, deadlines, LC rate, employment percentages, or filing obligations, use the data above to give specific, personalized answers.`;
  } catch {
    return ""; // fail silently — chat still works without context
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response("Missing messages array", { status: 400 });
    }

    // Get user context if authenticated
    let userContext = "";
    const session = await auth();
    if (session?.user?.id) {
      userContext = await buildUserContext(session.user.id);
    }

    // Track usage
    if (session?.user?.id) {
      try { await incrementUsage("aiChatMessagesUsed"); } catch {}
    }

    const anthropic = getAnthropicClient();

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: BASE_PROMPT + userContext,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => {
          controller.enqueue(encoder.encode(text));
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
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
    console.error("Chat API error:", error);
    return new Response("Chat error", { status: 500 });
  }
}
