import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { expenditureRecords, employmentRecords, capacityDevelopmentRecords, tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { parseExcelImport, type ParsedImportData } from "@/lib/import/excel-parser";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
  });
  if (!membership) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  try {
    const contentType = req.headers.get("content-type") || "";

    let parsedData: ParsedImportData | null = null;
    let type: "expenditure" | "employment" | "capacity" | "all" = "all";
    let periodId = "";
    let entityId = "";

    if (contentType.includes("multipart/form-data")) {
      // ── Excel file upload ──
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      periodId = formData.get("periodId") as string || "";
      entityId = formData.get("entityId") as string || "";
      type = (formData.get("type") as string || "all") as typeof type;

      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      if (!periodId || !entityId) return NextResponse.json({ error: "Missing periodId or entityId" }, { status: 400 });

      const buffer = await file.arrayBuffer();
      parsedData = parseExcelImport(buffer);
    } else {
      // ── JSON (legacy CSV import) ──
      const body = await req.json();
      periodId = body.periodId;
      entityId = body.entityId;
      type = body.type || "expenditure";

      if (!periodId || !entityId || !Array.isArray(body.rows)) {
        return NextResponse.json({ error: "Missing type, periodId, entityId, or rows" }, { status: 400 });
      }

      // Wrap legacy rows into ParsedImportData format
      parsedData = {
        format: "generic",
        generalInfo: null,
        expenditures: type === "expenditure" ? body.rows : [],
        employment: type === "employment" ? body.rows : [],
        capacity: type === "capacity" ? body.rows : [],
        warnings: [],
      };
    }

    if (!parsedData) return NextResponse.json({ error: "Failed to parse file" }, { status: 400 });

    let imported = 0;
    let skipped = 0;
    const details: { expenditures: number; employment: number; capacity: number } = { expenditures: 0, employment: 0, capacity: 0 };

    // ── Import expenditures ──
    if (type === "all" || type === "expenditure") {
      for (const row of parsedData.expenditures) {
        try {
          await db.insert(expenditureRecords).values({
            reportingPeriodId: periodId, entityId, tenantId: membership.tenantId,
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
          imported++; details.expenditures++;
        } catch { skipped++; }
      }
    }

    // ── Import employment ──
    if (type === "all" || type === "employment") {
      for (const row of parsedData.employment) {
        try {
          await db.insert(employmentRecords).values({
            reportingPeriodId: periodId, entityId, tenantId: membership.tenantId,
            jobTitle: row.job_title || row.Title || row["Job Title"] || "Unknown",
            employmentCategory: row.employment_category || row.Category || "Technical",
            employmentClassification: row.classification || row.Classification || null,
            relatedCompany: row.related_company || row.Company || null,
            totalEmployees: parseInt(row.total_employees || row.Total || row["Total Employees"] || "1") || 1,
            guyanaeseEmployed: parseInt(row.guyanese_employed || row.Guyanese || row["Guyanese Employed"] || "0") || 0,
            totalRemunerationPaid: row.remuneration || row.Remuneration ? String(parseFloat(row.remuneration || row.Remuneration || "0")) : null,
            remunerationGuyanaeseOnly: row.remuneration_guyanese || row["Guyanese Remuneration"] ? String(parseFloat(row.remuneration_guyanese || row["Guyanese Remuneration"] || "0")) : null,
          });
          imported++; details.employment++;
        } catch { skipped++; }
      }
    }

    // ── Import capacity development ──
    if (type === "all" || type === "capacity") {
      for (const row of parsedData.capacity) {
        try {
          await db.insert(capacityDevelopmentRecords).values({
            reportingPeriodId: periodId, entityId, tenantId: membership.tenantId,
            activity: row.activity || row.Activity || "Training",
            category: row.category || row.Category || null,
            participantType: row.participant_type || row["Participant Type"] || null,
            guyanaeseParticipantsOnly: parseInt(row.guyanese_participants || row["Guyanese Participants"] || "0") || 0,
            totalParticipants: parseInt(row.total_participants || row["Total Participants"] || "0") || 0,
            startDate: row.start_date || row["Start Date"] || null,
            durationDays: parseInt(row.duration_days || row.Duration || "0") || null,
            costToParticipants: row.cost_to_participants ? String(parseFloat(row.cost_to_participants)) : null,
            expenditureOnCapacity: row.expenditure_on_capacity ? String(parseFloat(row.expenditure_on_capacity)) : null,
          });
          imported++; details.capacity++;
        } catch { skipped++; }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      details,
      format: parsedData.format,
      generalInfo: parsedData.generalInfo,
      warnings: parsedData.warnings,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
