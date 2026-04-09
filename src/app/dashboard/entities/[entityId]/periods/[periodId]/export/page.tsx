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
  Lock, AlertTriangle, Clock, User, Globe, Download, ArrowRight,
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
  const [submitMethod, setSubmitMethod] = useState<"platform" | "email" | null>(null);
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

  const handleExport = async (type: "excel" | "pdf" | "notice") => {
    if (type === "notice") {
      setExporting("notice");
      try {
        const response = await fetch("/api/export/notice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: entityName,
            companyAddress: entity?.registered_address || entity?.operational_address || "",
            contactName: entity?.contact_name || "",
            contactDesignation: "",
            reportingPeriod: periodLabel,
            reportingYear: period?.fiscalYear,
            entityType: entity?.company_type || "contractor",
          }),
        });
        if (!response.ok) throw new Error("Export failed");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Notice_of_Submission_${entityName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Notice of Submission downloaded");
      } catch { toast.error("Failed to export notice"); }
      setExporting(null);
      return;
    }

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

  const handleSubmit = async (method: "platform" | "email") => {
    if (!attestChecked) {
      toast.error("You must attest to the accuracy of this report before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await attestAndSubmit(periodId, getJurisdictionTemplate(jurisdictionCode).attestationText, method);
      setPeriod((prev: typeof period) => prev ? { ...prev, status: "submitted", submittedAt: new Date(), lockedAt: new Date() } : prev);
      toast.success(
        method === "platform"
          ? "Report submitted directly to the Secretariat via LCA Desk."
          : "Report submitted and locked. A snapshot has been saved."
      );
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
      <div className="p-4 sm:p-6 max-w-4xl">
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
                    <span className={`text-xs mt-1 ${isComplete ? "text-accent font-medium" : "text-text-muted"}`}>
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Export files */}
        {(
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-accent" />
                <CardTitle className="text-base">Download Report Files</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary mb-4">
                Generate your official compliance reports. These files can be submitted via LCA Desk or emailed to the Secretariat.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button onClick={() => handleExport("excel")} loading={exporting === "excel"} variant="outline" className="w-full gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-success" /> Excel Report <span className="text-xs text-text-muted ml-auto">v4.1</span>
                </Button>
                <Button onClick={() => handleExport("pdf")} loading={exporting === "pdf"} variant="outline" className="w-full gap-2">
                  <FileText className="h-4 w-4 text-danger" /> Narrative PDF
                </Button>
                <Button onClick={() => handleExport("notice")} loading={exporting === "notice"} variant="outline" className="w-full gap-2">
                  <FileText className="h-4 w-4 text-accent" /> Notice of Submission
                </Button>
              </div>
              <p className="text-xs text-text-muted mt-2">The Notice of Submission is required by the Secretariat. Submit it alongside your Comparative Analysis Report and Excel template.</p>

              {/* Submission email format */}
              <div className="bg-bg-primary rounded-lg p-3 mt-3 text-xs font-mono text-text-secondary space-y-1">
                <p className="text-xs font-sans font-semibold text-text-primary mb-1.5">Email Submission Format</p>
                <p><span className="text-text-muted">To:</span> localcontent@nre.gov.gy</p>
                <p><span className="text-text-muted">Subject:</span> Local Content Half-Yearly Report – {periodLabel} {period?.fiscalYear} – {entityName}</p>
                <p className="text-text-muted mt-1">Attachments:</p>
                <p>1. Notice of Submission (PDF, signed, company letterhead)</p>
                <p>2. Comparative Analysis Report (PDF, searchable)</p>
                <p>3. Expenditure, Employment &amp; Capacity Report (XLSX)</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submission method choice (paid plans) */}
        {!isSubmitted && (
          <>
            {/* Workflow status buttons */}
            {(period.status === "not_started" || period.status === "in_progress" || period.status === "in_review") && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  {(period.status === "not_started" || period.status === "in_progress") && (
                    <div>
                      <Button onClick={handleSendForReview} variant="outline" className="w-full gap-2">
                        <Clock className="h-4 w-4" /> Send for Review
                      </Button>
                      <p className="text-sm text-text-muted mt-1.5">Mark this report as ready for internal review before submission.</p>
                    </div>
                  )}
                  {period.status === "in_review" && (
                    <div>
                      <Button onClick={handleApprove} variant="outline" className="w-full gap-2">
                        <CheckCircle className="h-4 w-4" /> Approve for Submission
                      </Button>
                      <p className="text-sm text-text-muted mt-1.5">Confirm this report has been reviewed and is ready to submit.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Choose submission method */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-accent" />
                  <CardTitle className="text-base">Submit to Secretariat</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Choose how to deliver your report to the {getJurisdictionTemplate(jurisdictionCode).regulatoryBodyShort || "Local Content Secretariat"}.
                </p>

                {/* Option cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Option 1: Direct Platform Submission */}
                  <button
                    onClick={() => setSubmitMethod("platform")}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      submitMethod === "platform"
                        ? "border-accent bg-accent-light ring-1 ring-accent/20"
                        : "border-border hover:border-accent/40 bg-bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Globe className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Submit via LCA Desk</p>
                        <Badge variant="success" className="text-xs mt-0.5">Recommended</Badge>
                      </div>
                    </div>
                    <ul className="text-xs text-text-secondary space-y-1 mt-3">
                      <li className="flex items-start gap-1.5"><CheckCircle className="h-3 w-3 text-success mt-0.5 shrink-0" /> Instant delivery to the Secretariat</li>
                      <li className="flex items-start gap-1.5"><CheckCircle className="h-3 w-3 text-success mt-0.5 shrink-0" /> Track review status in real-time</li>
                      <li className="flex items-start gap-1.5"><CheckCircle className="h-3 w-3 text-success mt-0.5 shrink-0" /> Receive amendment requests digitally</li>
                      <li className="flex items-start gap-1.5"><CheckCircle className="h-3 w-3 text-success mt-0.5 shrink-0" /> Full audit trail & receipt</li>
                    </ul>
                  </button>

                  {/* Option 2: Export & Email */}
                  <button
                    onClick={() => setSubmitMethod("email")}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${
                      submitMethod === "email"
                        ? "border-accent bg-accent-light ring-1 ring-accent/20"
                        : "border-border hover:border-accent/40 bg-bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-bg-primary">
                        <Mail className="h-5 w-5 text-text-muted" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Export & Email</p>
                        <Badge variant="default" className="text-xs mt-0.5">Traditional</Badge>
                      </div>
                    </div>
                    <ul className="text-xs text-text-secondary space-y-1 mt-3">
                      <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 text-text-muted mt-0.5 shrink-0" /> Download Excel + PDF files</li>
                      <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 text-text-muted mt-0.5 shrink-0" /> Email to {getJurisdictionTemplate(jurisdictionCode).submissionEmail || "Secretariat"}</li>
                      <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 text-text-muted mt-0.5 shrink-0" /> Attach files manually</li>
                      <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 text-text-muted mt-0.5 shrink-0" /> Wait for email confirmation</li>
                    </ul>
                  </button>
                </div>

                {/* Email compose section (shown when email method selected) */}
                {submitMethod === "email" && (
                  <div className="bg-bg-primary rounded-lg p-4 space-y-3 border border-border">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email Submission Details</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2"><span className="text-text-muted w-16 shrink-0">To:</span><span className="font-mono text-accent">{getJurisdictionTemplate(jurisdictionCode).submissionEmail || "localcontent@nre.gov.gy"}</span></div>
                      <div className="flex items-start gap-2"><span className="text-text-muted w-16 shrink-0">Subject:</span><span className="font-mono text-text-primary text-xs">{subjectLine}</span></div>
                    </div>
                    <a
                      href={`mailto:${getJurisdictionTemplate(jurisdictionCode).submissionEmail || "localcontent@nre.gov.gy"}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(
                        `Dear ${getJurisdictionTemplate(jurisdictionCode).regulatoryBodyShort},\n\nPlease find attached the ${reportTypeName} Report for ${entityName}.\n\nThis submission includes:\n1. Expenditure, Employment, and Capacity Development Report (Excel)\n2. Comparative Analysis Report (PDF)\n\nReporting Period: ${periodLabel} ${period.fiscalYear}\n\nPlease acknowledge receipt of this submission.\n\nYours faithfully,\n${entityName}`
                      )}`}
                    >
                      <Button variant="secondary" className="w-full gap-2">
                        <Mail className="h-4 w-4" /> Compose Submission Email
                      </Button>
                    </a>
                    <p className="text-xs text-text-muted">
                      Remember to attach both downloaded files before sending.
                    </p>
                  </div>
                )}

                {/* Platform submit info (shown when platform method selected) */}
                {submitMethod === "platform" && (
                  <div className="bg-accent-light rounded-lg p-4 border border-accent/20">
                    <div className="flex items-start gap-2 mb-2">
                      <Globe className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-accent">Direct Platform Submission</p>
                        <p className="text-xs text-text-secondary mt-1">
                          Your report data, attestation, and all supporting records will be delivered directly to the {getJurisdictionTemplate(jurisdictionCode).regulatoryBodyShort || "Local Content Secretariat"} through LCA Desk. They will see your full submission including compliance metrics, employment breakdown, and expenditure details — no email attachments needed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attestation */}
                {submitMethod && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Shield className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">Attestation & Final Submission</h3>
                        <p className="text-xs text-text-muted mt-0.5">
                          This action is irreversible. The report will be locked and a snapshot saved.
                        </p>
                      </div>
                    </div>

                    <div className="bg-warning-light border border-warning/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                        <p className="text-xs text-text-secondary leading-relaxed">{getJurisdictionTemplate(jurisdictionCode).attestationText}</p>
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
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
                      onClick={() => handleSubmit(submitMethod)}
                      loading={submitting}
                      disabled={!attestChecked}
                      size="lg"
                      className="w-full gap-2"
                    >
                      {submitMethod === "platform" ? (
                        <><Globe className="h-5 w-5" /> Attest & Submit via LCA Desk</>
                      ) : (
                        <><Lock className="h-5 w-5" /> Attest & Submit Report</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
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
                        } className="text-xs px-1.5">
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
