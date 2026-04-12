import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import jsPDF from "jspdf";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const {
    companyName, companyAddress, contactName, contactDesignation,
    reportingPeriod, reportingYear, entityType,
  } = body;

  const doc = new jsPDF();
  const margin = 25;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Company header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName || "Company Name", margin, y);
  y += 7;

  if (companyAddress) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(companyAddress, contentWidth);
    doc.text(addressLines, margin, y);
    y += addressLines.length * 4.5;
  }
  y += 5;

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.text(today, margin, y);
  y += 12;

  // Addressee
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const addressee = [
    "The Director",
    "Local Content Secretariat",
    "Ministry of Natural Resources",
    "116-117 Cowan Street, Kingston",
    "Georgetown, Guyana",
  ];
  for (const line of addressee) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.text("Attn: Local Content Secretariat", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Email: localcontent@nre.gov.gy", margin, y);
  y += 10;

  // Subject line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const subject = `Subject: Notice of Submission of Local Content Half-Yearly Report for the period – ${reportingPeriod || "H1"}, ${reportingYear || new Date().getFullYear()}`;
  const subjectLines = doc.splitTextToSize(subject, contentWidth);
  doc.text(subjectLines, margin, y);
  y += subjectLines.length * 5 + 5;

  // Underline
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const entityLabel = entityType === "contractor" ? "Contractor" :
    entityType === "sub_contractor" ? "Sub-Contractor" : "Licensee";

  const bodyText = `Dear Director,

In accordance with Section 12 of the Local Content Act No. 18 of 2021, ${companyName || "[Company Name]"}, as a ${entityLabel} operating in Guyana's petroleum sector, hereby submits the Local Content Half-Yearly Report for the period ${reportingPeriod || "H1"} ${reportingYear || new Date().getFullYear()}.

This submission comprises the following documents:

1. This Notice of Submission of Local Content Half-Yearly Report;
2. Local Content Half-Yearly Comparative Analysis Report (PDF); and
3. Local Content Half-Yearly Expenditure, Employment, and Capacity Development Report (Excel).

The information contained in the above-mentioned documents is true and accurate to the best of our knowledge. We acknowledge that pursuant to Section 23(1) of the Act, the submission of false or misleading information constitutes an offence under the Act.

We respectfully request that you acknowledge receipt of this submission.`;

  const bodyLines = doc.splitTextToSize(bodyText, contentWidth);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 4.5 + 10;

  // Closing
  doc.text("Yours faithfully,", margin, y);
  y += 20;

  // Signature line
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(contactName || "[Name of Authorized Representative]", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(contactDesignation || "[Designation]", margin, y);
  y += 5;
  doc.text(companyName || "[Company Name]", margin, y);
  y += 10;

  // Stamp note
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("(Company stamp/seal required)", margin, y);

  const pdfBytes = doc.output("arraybuffer");

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Notice_of_Submission_${companyName?.replace(/\s+/g, "_") || "Report"}.pdf"`,
    },
  });
}
