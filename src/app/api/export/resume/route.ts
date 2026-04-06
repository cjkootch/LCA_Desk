import jsPDF from "jspdf";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { name, headline, content, skills, education, certifications } = await req.json();

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(6, 78, 59); // emerald
    doc.text(name || "Your Name", margin, y);
    y += 8;

    if (headline) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // text-secondary
      doc.text(headline, margin, y);
      y += 8;
    }

    doc.setDrawColor(6, 78, 59);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Parse markdown content into sections
    doc.setTextColor(15, 23, 42); // text-primary
    const lines = (content || "").split("\n");

    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith("## ")) {
        // Section header
        y += 4;
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(6, 78, 59);
        doc.text(trimmed.replace("## ", ""), margin, y);
        y += 2;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        doc.setTextColor(15, 23, 42);
      } else if (trimmed.startsWith("### ")) {
        // Subsection
        y += 2;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(trimmed.replace("### ", ""), margin, y);
        y += 5;
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        // Bullet point
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const bulletText = trimmed.replace(/^[-*]\s/, "");
        const wrapped = doc.splitTextToSize(`• ${bulletText}`, pageWidth - margin * 2 - 5);
        doc.text(wrapped, margin + 5, y);
        y += wrapped.length * 4.5;
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        // Bold line
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(trimmed.replace(/\*\*/g, ""), margin, y);
        y += 5;
      } else if (trimmed.length > 0) {
        // Regular text
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(trimmed.replace(/\*\*/g, "").replace(/\*/g, ""), pageWidth - margin * 2);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4.5;
      } else {
        y += 3; // blank line spacing
      }
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Generated with LCA Desk — lcadesk.com", pageWidth / 2, 287, { align: "center" });

    const buffer = doc.output("arraybuffer");

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(name || "Resume").replace(/\s+/g, "_")}_Resume.pdf"`,
      },
    });
  } catch (error) {
    console.error("Resume PDF error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
