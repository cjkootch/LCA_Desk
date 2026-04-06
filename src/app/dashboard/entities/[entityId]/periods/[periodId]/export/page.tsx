"use client";
import { useStepCompletion } from "@/hooks/useStepCompletion";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, FileText, Send, CheckCircle, Mail, Shield,
  Lock, AlertTriangle, Clock, User,
} from "lucide-react";

import { toast } from "sonner";
import { calculateLocalContentRate, calculateEmploymentMetrics, calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatSubmissionSubject, getJurisdictionTemplate } from "@/lib/compliance/jurisdiction-config";
import { useJurisdiction } from "@/hooks/useJurisdiction";
import {
  fetchEntity, fetchPeriod, fetchExpenditures, fetchEmployment,
  fetchCapacity, fetchNarratives, attestAndSubmit, updatePeriodStatus,
  fetchPlanAndUsage, fetchAuditLog,
} from "@/server/actions";
import { mapDrizzleEntity } from "@/lib/mappers";
import type { Entity, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord } from "@/types/database.types";

// Attestation text is loaded from jurisdiction template — not hardcoded

export default function ExportPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const completedSteps = useStepCompletion(periodId);
  const jurisdictionCode = useJurisdiction(entityId);
  const [currentPlan, setCurrentPlan] = useState("lite");
  const [entityName, setEntityName] = useState("");
  const [entity, setEntity] = useState<Entity | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [period, setPeriod] = useState<any>(null);
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [attestChecked, setAttestChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [auditEntries, setAuditEntries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      fetchPlanAndUsage().then(d => setCurrentPlan(d.plan)).catch(() => {});
      const [rawEntity, rawPeriod, rawExp, rawEmp, rawCap, rawNar] = await Promise.all([
        fetchEntity(entityId), fetchPeriod(periodId), fetchExpenditures(periodId), fetchEmployment(periodId), fetchCapacity(periodId), fetchNarratives(periodId),
      ]);
      setEntityName(rawEntity?.legalName || "");
      setPeriod(rawPeriod ?? null);

      const mappedEntity = rawEntity ? mapDrizzleEntity(rawEntity) : null;
      setEntity(mappedEntity);

      const expenditures = rawExp.map((e) => ({ id: e.id, reporting_period_id: e.reportingPeriodId, entity_id: e.entityId, type_of_item_procured: e.typeOfItemProcured, related_sector: e.relatedSector, description_of_good_service: e.descriptionOfGoodService, supplier_name: e.supplierName, sole_source_code: e.soleSourceCode, supplier_certificate_id: e.supplierCertificateId, actual_payment: Number(e.actualPayment), outstanding_payment: e.outstandingPayment ? Number(e.outstandingPayment) : null, projection_next_period: e.projectionNextPeriod ? Number(e.projectionNextPeriod) : null, payment_method: e.paymentMethod, supplier_bank: e.supplierBank, bank_location_country: e.bankLocationCountry, currency_of_payment: e.currencyOfPayment || "GYD", notes: e.notes, created_at: "", updated_at: "" })) as ExpenditureRecord[];
      const employment = rawEmp.map((e) => ({ id: e.id, reporting_period_id: e.reportingPeriodId, entity_id: e.entityId, job_title: e.jobTitle, employment_category: e.employmentCategory, employment_classification: e.employmentClassification, related_company: e.relatedCompany, total_employees: e.totalEmployees, guyanese_employed: e.guyanaeseEmployed, total_remuneration_paid: e.totalRemunerationPaid ? Number(e.totalRemunerationPaid) : null, remuneration_guyanese_only: e.remunerationGuyanaeseOnly ? Number(e.remunerationGuyanaeseOnly) : null, notes: e.notes, created_at: "" })) as EmploymentRecord[];
      const capacity = rawCap.map((c) => ({ id: c.id, reporting_period_id: c.reportingPeriodId, entity_id: c.entityId, activity: c.activity, category: c.category, participant_type: c.participantType, guyanese_participants_only: c.guyanaeseParticipantsOnly || 0, total_participants: c.totalParticipants || 0, start_date: c.startDate, duration_days: c.durationDays, cost_to_participants: c.costToParticipants ? Number(c.costToParticipants) : null, expenditure_on_capacity: c.expenditureOnCapacity ? Number(c.expenditureOnCapacity) : null, notes: c.notes, created_at: "" })) as CapacityDevelopmentRecord[];

      setExportData({
        entity: mappedEntity,
        period: { ...rawPeriod, report_type: rawPeriod?.reportType, period_start: rawPeriod?.periodStart, period_end: rawPeriod?.periodEnd, due_date: rawPeriod?.dueDate, fiscal_year: rawPeriod?.fiscalYear },
        expenditures, employment, capacity, sectorCategories: [], jurisdictionCode: jurisdictionCode,
        localContentMetrics: calculateLocalContentRate(expenditures),
        employmentMetrics: calculateEmploymentMetrics(employment),
        capacityMetrics: calculateCapacityMetrics(capacity),
        narratives: {
          expenditure: rawNar.find((n) => n.section === "expenditure_narrative")?.draftContent || "",
          employment: rawNar.find((n) => n.section === "employment_narrative")?.draftContent || "",
          capacity: rawNar.find((n) => n.section === "capacity_narrative")?.draftContent || "",
        },
      });

      // Load audit log for this period
      fetchAuditLog(periodId, 20).then(setAuditEntries).catch(() => {});

      setLoading(false);
    };
    load().catch(() => setLoading(false));
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

  const handleSubmit = async () => {
    if (!attestChecked) {
      toast.error("You must attest to the accuracy of this report before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await attestAndSubmit(periodId, getJurisdictionTemplate(jurisdictionCode).attestationText);
      setPeriod((prev: typeof period) => prev ? { ...prev, status: "submitted", submittedAt: new Date(), lockedAt: new Date() } : prev);
      toast.success("Report submitted and locked. A snapshot has been saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed");
    }
    setSubmitting(false);
  };

  const handleSendForReview = async () => {
    try {
      await updatePeriodStatus(periodId, "in_review");
      setPeriod((prev: typeof period) => prev ? { ...prev, status: "in_review" } : prev);
      toast.success("Report sent for review.");
    } catch { toast.error("Failed to update status"); }
  };

  const handleApprove = async () => {
    try {
      await updatePeriodStatus(periodId, "approved");
      setPeriod((prev: typeof period) => prev ? { ...prev, status: "approved" } : prev);
      toast.success("Report approved and ready for submission.");
    } catch { toast.error("Failed to approve"); }
  };

  if (loading || !period) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const isLocked = !!(period.lockedAt || period.status === "submitted" || period.status === "acknowledged");
  const isSubmitted = period.status === "submitted" || period.status === "acknowledged";

  const reportTypeNames: Record<string, string> = {
    half_yearly_h1: "Half-Yearly", half_yearly_h2: "Half-Yearly",
    annual_plan: "Annual Local Content Plan", performance_report: "Annual Performance",
  };
  const periodLabel = period.reportType === "half_yearly_h1" ? "H1" : period.reportType === "half_yearly_h2" ? "H2" : "";
  const reportTypeName = reportTypeNames[period.reportType] || "Local Content";
  const subjectLine = formatSubmissionSubject(jurisdictionCode, `${periodLabel} ${period.fiscalYear}`, entityName);

  return (
    <div>
      <TopBar title={`${entityName} — Export & Submit`} />
      <div className="p-4 sm:p-8 max-w-4xl">
        <PageHeader title="Export & Submit" description="Generate official reports and submit to the Local Content Secretariat."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Export" }]} />
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="export" completedSteps={completedSteps} />

        {/* Locked banner */}
        {isLocked && (
          <div className="rounded-lg border border-warning/30 bg-warning-light p-4 mb-6 flex items-center gap-3">
            <Lock className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Report Locked</p>
              <p className="text-xs text-text-secondary">
                This report was submitted on {period.submittedAt ? new Date(period.submittedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "N/A"} and is now read-only.
                Data cannot be modified after submission.
              </p>
            </div>
          </div>
        )}

        {/* Status workflow */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Submission Workflow</h3>
            <div className="flex items-center gap-1">
              {["not_started", "in_progress", "in_review", "approved", "submitted"].map((step, i) => {
                const steps = ["not_started", "in_progress", "in_review", "approved", "submitted"];
                const currentIdx = steps.indexOf(period.status || "not_started");
                const isComplete = i <= currentIdx;
                const labels = ["Draft", "In Progress", "In Review", "Approved", "Submitted"];
                return (
                  <div key={step} className="flex-1 flex flex-col items-center">
                    <div className={`h-2 w-full rounded-full ${isComplete ? "bg-accent" : "bg-border-light"}`} />
                    <span className={`text-[10px] mt-1 ${isComplete ? "text-accent font-medium" : "text-text-muted"}`}>
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Export files */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-success-light"><FileSpreadsheet className="h-6 w-6 text-success" /></div><div><CardTitle className="text-base">Excel Report</CardTitle><p className="text-sm text-text-muted mt-1">Secretariat Version 4.1 format</p></div></div></CardHeader>
            <CardContent><Button onClick={() => handleExport("excel")} loading={exporting === "excel"} className="w-full"><FileSpreadsheet className="h-4 w-4 mr-2" />Download Excel Report</Button></CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-danger-light"><FileText className="h-6 w-6 text-danger" /></div><div><CardTitle className="text-base">Narrative PDF</CardTitle><p className="text-sm text-text-muted mt-1">Comparative Analysis Report</p></div></div></CardHeader>
            <CardContent><Button onClick={() => handleExport("pdf")} variant="secondary" loading={exporting === "pdf"} className="w-full"><FileText className="h-4 w-4 mr-2" />Download Narrative PDF</Button></CardContent>
          </Card>
        </div>

        {/* Submission section */}
        <Card className="mb-6">
          <CardHeader><div className="flex items-center gap-2"><Send className="h-5 w-5 text-accent" /><CardTitle className="text-base">Submit to Secretariat</CardTitle></div></CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary mb-4">
              Download both files above, then submit via email to the Local Content Secretariat.
            </p>
            <div className="bg-bg-primary rounded-lg p-4 space-y-2 text-sm mb-4">
              <div className="flex items-start gap-2"><span className="text-text-muted w-16 shrink-0">To:</span><span className="font-mono text-accent">{getJurisdictionTemplate(jurisdictionCode).submissionEmail || "localcontent@nre.gov.gy"}</span></div>
              <div className="flex items-start gap-2"><span className="text-text-muted w-16 shrink-0">Subject:</span><span className="font-mono text-text-primary text-xs">{subjectLine}</span></div>
            </div>
            <a
              href={`mailto:${getJurisdictionTemplate(jurisdictionCode).submissionEmail || "localcontent@nre.gov.gy"}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(
                `Dear ${getJurisdictionTemplate(jurisdictionCode).regulatoryBodyShort},\n\nPlease find attached the ${reportTypeName} Report for ${entityName}.\n\nThis submission includes:\n1. Expenditure, Employment, and Capacity Development Report (Excel)\n2. Comparative Analysis Report (PDF)\n\nReporting Period: ${periodLabel} ${period.fiscalYear}\n\nPlease acknowledge receipt of this submission.\n\nYours faithfully,\n${entityName}`
              )}`}
            >
              <Button variant="primary" className="w-full mb-2">
                <Mail className="h-4 w-4 mr-2" /> Compose Submission Email
              </Button>
            </a>
            <p className="text-xs text-text-muted">
              Remember to attach both downloaded files before sending.
            </p>
          </CardContent>
        </Card>

        {/* Workflow actions */}
        {!isSubmitted && (
          <Card className="mb-6">
            <CardContent className="p-5 space-y-4">
              {/* Review/Approve buttons */}
              {(period.status === "not_started" || period.status === "in_progress") && (
                <div>
                  <Button onClick={handleSendForReview} variant="outline" className="w-full gap-2">
                    <Clock className="h-4 w-4" /> Send for Review
                  </Button>
                  <p className="text-[11px] text-text-muted mt-1.5">Mark this report as ready for internal review before submission.</p>
                </div>
              )}

              {period.status === "in_review" && (
                <div>
                  <Button onClick={handleApprove} variant="outline" className="w-full gap-2">
                    <CheckCircle className="h-4 w-4" /> Approve for Submission
                  </Button>
                  <p className="text-[11px] text-text-muted mt-1.5">Confirm this report has been reviewed and is ready to submit.</p>
                </div>
              )}

              {/* Attestation */}
              <div className="border-t border-border pt-4">
                <div className="flex items-start gap-2 mb-3">
                  <Shield className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Attestation & Submission</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      This action is irreversible. The report will be locked and a snapshot saved.
                    </p>
                  </div>
                </div>

                <div className="bg-warning-light border border-warning/20 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-text-secondary leading-relaxed">{getJurisdictionTemplate(jurisdictionCode).attestationText}</p>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={attestChecked}
                    onChange={(e) => setAttestChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-text-primary font-medium">
                    I have read and agree to the attestation above
                  </span>
                </label>

                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={!attestChecked}
                  size="lg"
                  className="w-full gap-2"
                >
                  <Lock className="h-5 w-5" />
                  Attest & Submit Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submitted state */}
        {isSubmitted && (
          <Card className="border-success/30 mb-6">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-success" />
                <div>
                  <p className="font-semibold text-text-primary">Report Submitted & Locked</p>
                  <p className="text-xs text-text-muted">
                    Submitted {period.submittedAt ? new Date(period.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
              {period.attestation && (
                <div className="bg-bg-primary rounded-lg p-3 text-xs text-text-secondary mb-3">
                  <p className="font-medium text-text-primary mb-1">Attestation:</p>
                  <p>{period.attestation}</p>
                </div>
              )}
              <Button
                variant="outline" size="sm" className="gap-1.5"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/export/receipt", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        entityName,
                        reportType: period.reportType?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                        periodLabel: `${period.periodStart} to ${period.periodEnd}`,
                        submittedAt: period.submittedAt ? new Date(period.submittedAt).toLocaleString() : "",
                        attestation: period.attestation,
                        userName: "", // filled server-side if needed
                        recordCounts: exportData ? {
                          expenditures: (exportData.expenditures as unknown[])?.length || 0,
                          employment: (exportData.employment as unknown[])?.length || 0,
                          capacity: 0,
                        } : {},
                      }),
                    });
                    if (!res.ok) throw new Error();
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `Submission_Receipt_${entityName}.pdf`; a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Receipt downloaded");
                  } catch { toast.error("Failed to generate receipt"); }
                }}
              >
                <FileText className="h-3.5 w-3.5" /> Download Submission Receipt
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Audit trail */}
        {auditEntries.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Audit Trail</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-xs border-b border-border-light pb-2 last:border-0">
                    <div className="h-6 w-6 rounded-full bg-bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3 w-3 text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary">
                        <span className="font-medium">{entry.userName || "System"}</span>
                        {" "}
                        <Badge variant={
                          entry.action === "submit" ? "success" :
                          entry.action === "approve" ? "accent" :
                          entry.action === "delete" ? "danger" :
                          "default"
                        } className="text-[9px] px-1.5">
                          {entry.action}
                        </Badge>
                        {" "}
                        <span className="text-text-muted">{entry.entityType.replace(/_/g, " ")}</span>
                        {entry.fieldName && (
                          <span className="text-text-muted"> &middot; {entry.fieldName}</span>
                        )}
                      </p>
                      {(entry.oldValue || entry.newValue) && (
                        <p className="text-text-muted mt-0.5">
                          {entry.oldValue && <span className="line-through">{entry.oldValue}</span>}
                          {entry.oldValue && entry.newValue && " → "}
                          {entry.newValue && <span>{entry.newValue}</span>}
                        </p>
                      )}
                    </div>
                    <span className="text-text-muted shrink-0">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
