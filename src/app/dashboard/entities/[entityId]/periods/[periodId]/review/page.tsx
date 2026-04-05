"use client";
import { useStepCompletion } from "@/hooks/useStepCompletion";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { runFullValidation } from "@/lib/compliance/validators";
import { ComplianceScan } from "@/components/ai/ComplianceScan";
import { fetchEntity, fetchExpenditures, fetchEmployment, fetchCapacity, fetchNarratives } from "@/server/actions";
import type { Entity, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";
import type { ValidationResult } from "@/types/reporting.types";

export default function ReviewPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const completedSteps = useStepCompletion(periodId);
  const [entityName, setEntityName] = useState("");
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [scanData, setScanData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [entityData, rawExp, rawEmp, rawCap, rawNar] = await Promise.all([
        fetchEntity(entityId), fetchExpenditures(periodId), fetchEmployment(periodId), fetchCapacity(periodId), fetchNarratives(periodId),
      ]);
      setEntityName(entityData?.legalName || "");

      // Map to types expected by validators
      const entity = { id: entityData?.id || "", legal_name: entityData?.legalName || "", lcs_certificate_id: entityData?.lcsCertificateId || null, lcs_certificate_expiry: entityData?.lcsCertificateExpiry || null } as Entity;
      const expenditures = rawExp.map((e) => ({ id: e.id, type_of_item_procured: e.typeOfItemProcured, related_sector: e.relatedSector, supplier_name: e.supplierName, supplier_certificate_id: e.supplierCertificateId, sole_source_code: e.soleSourceCode, actual_payment: Number(e.actualPayment) })) as ExpenditureRecord[];
      const employment = rawEmp.map((e) => ({ id: e.id, employment_category: e.employmentCategory, total_employees: e.totalEmployees, guyanese_employed: e.guyanaeseEmployed })) as EmploymentRecord[];
      const capacity = rawCap.map((c) => ({ id: c.id, activity: c.activity, start_date: c.startDate, total_participants: c.totalParticipants })) as CapacityDevelopmentRecord[];
      const narratives = rawNar.map((n) => ({ id: n.id, section: n.section, draft_content: n.draftContent })) as NarrativeDraft[];

      setResults(runFullValidation(entity, expenditures, employment, capacity, narratives, "GY"));

      // Build scan data for AI compliance scan
      setScanData({
        company: entityData?.legalName,
        expenditure_count: rawExp.length,
        expenditures: rawExp.map((e) => ({
          item: e.typeOfItemProcured,
          sector: e.relatedSector,
          supplier: e.supplierName,
          certificate_id: e.supplierCertificateId,
          sole_source_code: e.soleSourceCode,
          payment: Number(e.actualPayment),
          currency: e.currencyOfPayment,
        })),
        employment_count: rawEmp.length,
        employment: rawEmp.map((e) => ({
          job_title: e.jobTitle,
          category: e.employmentCategory,
          total: e.totalEmployees,
          guyanese: e.guyanaeseEmployed,
          remuneration: Number(e.totalRemunerationPaid || 0),
        })),
        capacity_count: rawCap.length,
        capacity: rawCap.map((c) => ({
          activity: c.activity,
          participants: c.totalParticipants,
          guyanese_participants: c.guyanaeseParticipantsOnly,
          expenditure: Number(c.expenditureOnCapacity || 0),
        })),
        narratives: rawNar.map((n) => ({
          section: n.section,
          word_count: n.draftContent.split(/\s+/).length,
        })),
      });

      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [entityId, periodId]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const errors = results.filter((r) => r.level === "error");
  const warnings = results.filter((r) => r.level === "warning");
  const ICON_MAP = { error: XCircle, warning: AlertTriangle, info: Info };
  const COLOR_MAP = { error: "text-danger", warning: "text-warning", info: "text-accent" };
  const sections = ["company_info", "expenditure", "employment", "capacity", "narrative"];

  return (
    <div>
      <TopBar title={`${entityName} — Review & Validate`} />
      <div className="p-8">
        <PageHeader title="Review & Validate" description="Pre-submission compliance checklist."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Review" }]} />
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="review" completedSteps={completedSteps} />
        <div className="flex gap-4 mb-6">
          <Badge variant={errors.length > 0 ? "danger" : "success"}>{errors.length} Error{errors.length !== 1 ? "s" : ""}</Badge>
          <Badge variant={warnings.length > 0 ? "warning" : "success"}>{warnings.length} Warning{warnings.length !== 1 ? "s" : ""}</Badge>
        </div>
        <div className="space-y-6">
          {sections.map((section) => {
            const sectionResults = results.filter((r) => r.section === section);
            const sectionLabel = section.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
            const hasErrors = sectionResults.some((r) => r.level === "error");
            const hasWarnings = sectionResults.some((r) => r.level === "warning");
            return (
              <Card key={section}>
                <CardHeader><div className="flex items-center gap-2">{hasErrors ? <XCircle className="h-5 w-5 text-danger" /> : hasWarnings ? <AlertTriangle className="h-5 w-5 text-warning" /> : <CheckCircle className="h-5 w-5 text-success" />}<CardTitle className="text-base">{sectionLabel}</CardTitle></div></CardHeader>
                <CardContent>
                  {sectionResults.length === 0 ? (
                    <div className="flex items-center gap-2 text-success text-sm"><CheckCircle className="h-4 w-4" />All checks passed</div>
                  ) : (
                    <div className="space-y-2">{sectionResults.map((result, i) => { const Icon = ICON_MAP[result.level]; return (<div key={i} className={cn("flex items-start gap-3 text-sm", COLOR_MAP[result.level])}><Icon className="h-4 w-4 mt-0.5 shrink-0" /><span className="text-text-primary">{result.message}</span></div>); })}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* AI Compliance Scan */}
        <ComplianceScan scanData={scanData} />
      </div>
    </div>
  );
}
