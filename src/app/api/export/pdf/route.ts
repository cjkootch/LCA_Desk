import { generateNarrativePdf } from "@/lib/export/pdf";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { hasReportExportAccess } from "@/lib/billing/export-access";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const data = await req.json();

    const periodId = data?.periodId || data?.period?.id;
    if (!periodId || !(await hasReportExportAccess(session.user.id, periodId))) {
      return new Response(JSON.stringify({ error: "Export requires an active plan or a per-report purchase", requiresPurchase: true }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await generateNarrativePdf(data);

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="LCA_Narrative_${data.entity.legal_name}_${data.period.report_type}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
