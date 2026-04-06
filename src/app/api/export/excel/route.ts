import { generateHalfYearlyReport } from "@/lib/export/excel";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const data = await req.json();
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
