import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import jsPDF from "jspdf";

function fmt(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { analytics, widgets } = await req.json();
  if (!analytics) {
    return NextResponse.json({ error: "No analytics data" }, { status: 400 });
  }

  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Local Content Sector Report", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`, margin, y);
  y += 4;
  doc.text("LCA Desk — Local Content Secretariat", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  const enabled = widgets || [];
  const isEnabled = (id: string) => enabled.length === 0 || enabled.includes(id);

  // KPIs section
  if (isEnabled("local_spend") || isEnabled("jobs_created") || isEnabled("staff_hours") || isEnabled("economic_impact")) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Key Performance Indicators", margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const kpis: [string, string, string][] = [];
    if (isEnabled("local_spend")) kpis.push(["Local Content Spend", fmt(analytics.localSpend || 0), `${analytics.guyaneseSupplierCount || 0} Guyanese suppliers · ${analytics.overallLcRate || 0}% LC rate`]);
    if (isEnabled("jobs_created")) kpis.push(["Guyanese Jobs Created", (analytics.jobsCreated || 0).toLocaleString(), `${(analytics.totalEmployees || 0).toLocaleString()} total workforce · ${analytics.employmentPct || 0}% Guyanese`]);
    if (isEnabled("staff_hours")) kpis.push(["Staff Hours Saved", (analytics.staffHoursSaved || 0).toLocaleString(), `${analytics.totalSubmissions || 0} submissions processed digitally`]);
    if (isEnabled("economic_impact")) kpis.push(["Total Economic Impact", fmt(analytics.economicImpact || 0), `${analytics.uniqueFilers || 0} companies · ${analytics.uniqueEntities || 0} entities filing`]);

    for (const [label, value, detail] of kpis) {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin + 2, y);
      doc.text(value, margin + 70, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(detail, margin + 2, y + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      y += 12;
    }
    y += 4;
  }

  // LC Rate
  if (isEnabled("lc_rate")) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Sector Local Content Rate", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Overall LC Rate: ${analytics.overallLcRate || 0}%`, margin + 2, y);
    y += 5;
    doc.text(`Guyanese Expenditure: ${fmt(analytics.guyaneseExpenditure || 0)} of ${fmt(analytics.totalExpenditure || 0)} total`, margin + 2, y);
    y += 10;
  }

  // Employment
  if (isEnabled("employment_breakdown")) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Workforce & Employment", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Workforce: ${(analytics.totalEmployees || 0).toLocaleString()}`, margin + 2, y); y += 5;
    doc.text(`Guyanese Nationals: ${(analytics.guyaneseEmployees || 0).toLocaleString()} (${analytics.employmentPct || 0}%)`, margin + 2, y); y += 10;
  }

  // Training
  if (isEnabled("training_capacity")) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Training & Capacity Development", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Participants Trained: ${(analytics.totalTrainingParticipants || 0).toLocaleString()}`, margin + 2, y); y += 5;
    doc.text(`Training Days: ${(analytics.totalTrainingDays || 0).toLocaleString()}`, margin + 2, y); y += 5;
    doc.text(`Capacity Investment: ${fmt(analytics.totalCapacitySpend || 0)}`, margin + 2, y); y += 10;
  }

  // Filing status
  if (isEnabled("filing_status")) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Filing & Compliance", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Submissions: ${analytics.totalSubmissions || 0}`, margin + 2, y); y += 5;
    doc.text(`Filing Companies: ${analytics.uniqueFilers || 0}`, margin + 2, y); y += 5;
    doc.text(`Filing Entities: ${analytics.uniqueEntities || 0}`, margin + 2, y); y += 10;
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Confidential — Local Content Secretariat · Generated by LCA Desk", margin, y);
  doc.text(`Page 1`, pageWidth - margin - 15, y);

  const pdfBytes = doc.output("arraybuffer");

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="LCA_Desk_Sector_Report_${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
