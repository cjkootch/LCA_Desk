"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { calculateLocalContentRate, calculateEmploymentMetrics, calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatSubmissionSubject } from "@/lib/compliance/jurisdiction-config";
import { fetchEntity, fetchPeriod, fetchExpenditures, fetchEmployment, fetchCapacity, fetchNarratives, markPeriodSubmitted } from "@/server/actions";
import type { Entity, ReportingPeriod, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord } from "@/types/database.types";

export default function ExportPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entityName, setEntityName] = useState("");
  const [entity, setEntity] = useState<Entity | null>(null);
  const [period, setPeriod] = useState<{ reportType: string; fiscalYear: number | null; periodStart: string; periodEnd: string; status: string | null; submittedAt: Date | null } | null>(null);
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [rawEntity, rawPeriod, rawExp, rawEmp, rawCap, rawNar] = await Promise.all([
        fetchEntity(entityId), fetchPeriod(periodId), fetchExpenditures(periodId), fetchEmployment(periodId), fetchCapacity(periodId), fetchNarratives(periodId),
      ]);
      setEntityName(rawEntity?.legalName || "");
      setPeriod(rawPeriod ?? null);

      const mappedEntity = { id: rawEntity?.id, legal_name: rawEntity?.legalName, trading_name: rawEntity?.tradingName, registration_number: rawEntity?.registrationNumber, lcs_certificate_id: rawEntity?.lcsCertificateId, company_type: rawEntity?.companyType, guyanese_ownership_pct: rawEntity?.guyanaeseOwnershipPct, petroleum_agreement_ref: rawEntity?.petroleumAgreementRef, contact_name: rawEntity?.contactName, contact_email: rawEntity?.contactEmail, contact_phone: rawEntity?.contactPhone, registered_address: rawEntity?.registeredAddress } as Entity;
      setEntity(mappedEntity);

      const expenditures = rawExp.map((e) => ({ ...e, amount_local: Number(e.amountLocal), amount_usd: e.amountUsd ? Number(e.amountUsd) : null, is_guyanese_supplier: e.isGuyaneseSupplier, is_sole_sourced: e.isSoleSourced, supplier_name: e.supplierName, supplier_lcs_cert_id: e.supplierLcsCertId, sole_source_code: e.soleSourceCode, sector_category_id: e.sectorCategoryId, payment_method: e.paymentMethod, payment_date: e.paymentDate })) as unknown as ExpenditureRecord[];
      const employment = rawEmp.map((e) => ({ ...e, job_title: e.jobTitle, position_type: e.positionType, is_guyanese: e.isGuyanese, headcount: e.headcount, isco_08_code: e.isco08Code, remuneration_band: e.remunerationBand, total_remuneration_local: e.totalRemunerationLocal ? Number(e.totalRemunerationLocal) : null })) as unknown as EmploymentRecord[];
      const capacity = rawCap.map((c) => ({ ...c, activity_type: c.activityType, activity_name: c.activityName, provider_name: c.providerName, provider_type: c.providerType, participant_count: c.participantCount, guyanese_participant_count: c.guyanaeseParticipantCount, total_hours: c.totalHours ? Number(c.totalHours) : null, cost_local: c.costLocal ? Number(c.costLocal) : null })) as unknown as CapacityDevelopmentRecord[];

      setExportData({
        entity: mappedEntity,
        period: { ...rawPeriod, report_type: rawPeriod?.reportType, period_start: rawPeriod?.periodStart, period_end: rawPeriod?.periodEnd, due_date: rawPeriod?.dueDate, fiscal_year: rawPeriod?.fiscalYear },
        expenditures, employment, capacity, sectorCategories: [], jurisdictionCode: "GY",
        localContentMetrics: calculateLocalContentRate(expenditures),
        employmentMetrics: calculateEmploymentMetrics(employment),
        capacityMetrics: calculateCapacityMetrics(capacity),
        narratives: {
          expenditure: rawNar.find((n) => n.section === "expenditure_narrative")?.draftContent || "",
          employment: rawNar.find((n) => n.section === "employment_narrative")?.draftContent || "",
          capacity: rawNar.find((n) => n.section === "capacity_narrative")?.draftContent || "",
        },
      });
      setLoading(false);
    };
    load();
  }, [entityId, periodId]);

  const handleExport = async (type: "excel" | "pdf") => {
    if (!exportData) return;
    setExporting(type);
    try {
      const response = await fetch(`/api/export/${type}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exportData) });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LCA_${type === "excel" ? "Report" : "Narrative"}_${entityName}.${type === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type === "excel" ? "Excel report" : "PDF narrative"} downloaded`);
    } catch { toast.error(`Failed to export ${type}`); }
    setExporting(null);
  };

  const handleMarkSubmitted = async () => {
    await markPeriodSubmitted(periodId);
    setPeriod((prev) => prev ? { ...prev, status: "submitted", submittedAt: new Date() } : prev);
    toast.success("Report marked as submitted");
  };

  if (loading || !period) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const periodLabel = period.reportType === "half_yearly_h1" ? "H1" : "H2";
  const subjectLine = formatSubmissionSubject("GY", `${periodLabel} ${period.fiscalYear}`, entityName);

  return (
    <div>
      <TopBar title={`${entityName} — Export & Submit`} />
      <div className="p-8">
        <PageHeader title="Export & Submit" description="Generate official reports and submit to the Local Content Secretariat."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Export" }]} />
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="export" completedSteps={["company_info", "expenditure", "employment", "capacity", "narrative", "review"]} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-success/10"><FileSpreadsheet className="h-6 w-6 text-success" /></div><div><CardTitle className="text-base">Excel Report</CardTitle><p className="text-sm text-text-muted mt-1">Secretariat Version 4.1 format</p></div></div></CardHeader>
            <CardContent><Button onClick={() => handleExport("excel")} loading={exporting === "excel"} className="w-full"><FileSpreadsheet className="h-4 w-4 mr-2" />Download Excel Report</Button></CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-danger/10"><FileText className="h-6 w-6 text-danger" /></div><div><CardTitle className="text-base">Narrative PDF</CardTitle><p className="text-sm text-text-muted mt-1">Comparative Analysis Report</p></div></div></CardHeader>
            <CardContent><Button onClick={() => handleExport("pdf")} variant="secondary" loading={exporting === "pdf"} className="w-full"><FileText className="h-4 w-4 mr-2" />Download Narrative PDF</Button></CardContent>
          </Card>
        </div>
        <Card className="mb-8">
          <CardHeader><div className="flex items-center gap-2"><Send className="h-5 w-5 text-accent" /><CardTitle className="text-base">Submission Instructions</CardTitle></div></CardHeader>
          <CardContent>
            <div className="bg-bg-surface rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-start gap-2"><span className="text-text-muted w-16 shrink-0">To:</span><span className="font-mono text-accent">localcontent@nre.gov.gy</span></div>
              <div className="flex items-start gap-2"><span className="text-text-muted w-16 shrink-0">Subject:</span><span className="font-mono text-text-primary text-xs">{subjectLine}</span></div>
            </div>
          </CardContent>
        </Card>
        {period.status !== "submitted" && period.status !== "acknowledged" ? (
          <Button onClick={handleMarkSubmitted} size="lg" className="w-full"><CheckCircle className="h-5 w-5 mr-2" />Mark as Submitted</Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-success py-4"><CheckCircle className="h-5 w-5" /><span className="font-medium">Report submitted</span></div>
        )}
      </div>
    </div>
  );
}
