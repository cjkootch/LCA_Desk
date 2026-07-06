import { generateHalfYearlyReport } from "@/lib/export/excel";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { hasReportExportAccess } from "@/lib/billing/export-access";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const data = await req.json();

    // Server-side paywall: a report export requires an active plan/trial
    // or a per-report purchase. Prevents bypassing the UI paywall.
    const periodId = data?.periodId || data?.period?.id;
    if (!periodId || !(await hasReportExportAccess(session.user.id, periodId))) {
      return new Response(JSON.stringify({ error: "Export requires an active plan or a per-report purchase", requiresPurchase: true }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = await generateHalfYearlyReport(data);

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="LCA_Report_${data.entity.legal_name}_${data.period.report_type}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return new Response("Failed to generate Excel report", { status: 500 });
  }
}
