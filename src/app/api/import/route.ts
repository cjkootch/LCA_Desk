import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { expenditureRecords, employmentRecords, tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Get tenant
  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
  });
  if (!membership) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  try {
    const body = await req.json();
    const { type, periodId, entityId, rows } = body as {
      type: "expenditure" | "employment";
      periodId: string;
      entityId: string;
      rows: Record<string, string>[];
    };

    if (!type || !periodId || !entityId || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing type, periodId, entityId, or rows" }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;

    if (type === "expenditure") {
      for (const row of rows) {
        try {
          await db.insert(expenditureRecords).values({
            reportingPeriodId: periodId,
            entityId,
            tenantId: membership.tenantId,
            typeOfItemProcured: row.type_of_item_procured || row.Type || row["Type of Item"] || "Goods",
            relatedSector: row.related_sector || row.Sector || null,
            descriptionOfGoodService: row.description || row.Description || row["Description of Good/Service"] || null,
            supplierName: row.supplier_name || row.Supplier || row["Supplier Name"] || "Unknown",
            soleSourceCode: row.sole_source_code || row["Sole Source"] || null,
            supplierCertificateId: row.supplier_certificate_id || row["Certificate ID"] || row["Cert ID"] || null,
            actualPayment: String(parseFloat(row.actual_payment || row.Amount || row["Actual Payment"] || "0") || 0),
            outstandingPayment: row.outstanding_payment || row.Outstanding ? String(parseFloat(row.outstanding_payment || row.Outstanding || "0")) : null,
            projectionNextPeriod: row.projection || row.Projection ? String(parseFloat(row.projection || row.Projection || "0")) : null,
            paymentMethod: row.payment_method || row["Payment Method"] || null,
            supplierBank: row.supplier_bank || row.Bank || null,
            bankLocationCountry: row.bank_location || row["Bank Country"] || null,
            currencyOfPayment: row.currency || row.Currency || "GYD",
          });
          imported++;
        } catch { skipped++; }
      }
    } else if (type === "employment") {
      for (const row of rows) {
        try {
          await db.insert(employmentRecords).values({
            reportingPeriodId: periodId,
            entityId,
            tenantId: membership.tenantId,
            jobTitle: row.job_title || row.Title || row["Job Title"] || "Unknown",
            employmentCategory: row.employment_category || row.Category || "Technical",
            employmentClassification: row.classification || row.Classification || null,
            relatedCompany: row.related_company || row.Company || null,
            totalEmployees: parseInt(row.total_employees || row.Total || row["Total Employees"] || "1") || 1,
            guyanaeseEmployed: parseInt(row.guyanese_employed || row.Guyanese || row["Guyanese Employed"] || "0") || 0,
            totalRemunerationPaid: row.remuneration || row.Remuneration ? String(parseFloat(row.remuneration || row.Remuneration || "0")) : null,
            remunerationGuyanaeseOnly: row.remuneration_guyanese || row["Guyanese Remuneration"] ? String(parseFloat(row.remuneration_guyanese || row["Guyanese Remuneration"] || "0")) : null,
          });
          imported++;
        } catch { skipped++; }
      }
    }

    return NextResponse.json({ success: true, imported, skipped });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
