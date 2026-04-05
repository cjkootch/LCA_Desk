"use client";

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
import { fetchEntity, fetchExpenditures, fetchEmployment, fetchCapacity, fetchNarratives } from "@/server/actions";
import type { Entity, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";
import type { ValidationResult } from "@/types/reporting.types";

export default function ReviewPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entityName, setEntityName] = useState("");
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [entityData, rawExp, rawEmp, rawCap, rawNar] = await Promise.all([
        fetchEntity(entityId), fetchExpenditures(periodId), fetchEmployment(periodId), fetchCapacity(periodId), fetchNarratives(periodId),
      ]);
      setEntityName(entityData?.legalName || "");

      // Map to types expected by validators
      const entity = { id: entityData?.id || "", legal_name: entityData?.legalName || "", lcs_certificate_id: entityData?.lcsCertificateId || null, lcs_certificate_expiry: entityData?.lcsCertificateExpiry || null } as Entity;
      const expenditures = rawExp.map((e) => ({ id: e.id, sector_category_id: e.sectorCategoryId, supplier_name: e.supplierName, supplier_lcs_cert_id: e.supplierLcsCertId, is_guyanese_supplier: e.isGuyaneseSupplier, is_sole_sourced: e.isSoleSourced, sole_source_code: e.soleSourceCode, amount_local: Number(e.amountLocal) })) as ExpenditureRecord[];
      const employment = rawEmp.map((e) => ({ id: e.id, position_type: e.positionType, is_guyanese: e.isGuyanese, headcount: e.headcount })) as EmploymentRecord[];
      const capacity = rawCap.map((c) => ({ id: c.id, activity_name: c.activityName, start_date: c.startDate, end_date: c.endDate, participant_count: c.participantCount })) as CapacityDevelopmentRecord[];
      const narratives = rawNar.map((n) => ({ id: n.id, section: n.section, draft_content: n.draftContent })) as NarrativeDraft[];

      setResults(runFullValidation(entity, expenditures, employment, capacity, narratives, "GY"));
      setLoading(false);
    };
    load();
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
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="review" completedSteps={["company_info", "expenditure", "employment", "capacity", "narrative"]} />
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
      </div>
    </div>
  );
}
