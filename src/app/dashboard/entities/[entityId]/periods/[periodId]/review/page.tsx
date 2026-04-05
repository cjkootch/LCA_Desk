"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { runFullValidation } from "@/lib/compliance/validators";
import type { Entity, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";
import type { ValidationResult } from "@/types/reporting.types";

export default function ReviewPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const [entityRes, expRes, empRes, capRes, narRes] = await Promise.all([
        supabase.from("entities").select("*").eq("id", entityId).single(),
        supabase.from("expenditure_records").select("*").eq("reporting_period_id", periodId),
        supabase.from("employment_records").select("*").eq("reporting_period_id", periodId),
        supabase.from("capacity_development_records").select("*").eq("reporting_period_id", periodId),
        supabase.from("narrative_drafts").select("*").eq("reporting_period_id", periodId),
      ]);

      const ent = entityRes.data as Entity;
      setEntity(ent);

      const validationResults = runFullValidation(
        ent,
        (expRes.data || []) as ExpenditureRecord[],
        (empRes.data || []) as EmploymentRecord[],
        (capRes.data || []) as CapacityDevelopmentRecord[],
        (narRes.data || []) as NarrativeDraft[],
        "GY"
      );
      setResults(validationResults);
      setLoading(false);
    };
    fetchData();
  }, [entityId, periodId, supabase]);

  if (loading || !entity) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const errors = results.filter((r) => r.level === "error");
  const warnings = results.filter((r) => r.level === "warning");
  const infos = results.filter((r) => r.level === "info");

  const ICON_MAP = {
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const COLOR_MAP = {
    error: "text-danger",
    warning: "text-warning",
    info: "text-accent",
  };

  const sections = ["company_info", "expenditure", "employment", "capacity", "narrative"];

  return (
    <div>
      <TopBar title={`${entity.legal_name} — Review & Validate`} />
      <div className="p-8">
        <PageHeader
          title="Review & Validate"
          description="Pre-submission compliance checklist. All errors must be resolved before export."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: entity.legal_name, href: `/dashboard/entities/${entityId}` },
            { label: "Review" },
          ]}
        />

        <PeriodChecklist
          entityId={entityId}
          periodId={periodId}
          currentStep="review"
          completedSteps={["company_info", "expenditure", "employment", "capacity", "narrative"]}
        />

        {/* Summary badges */}
        <div className="flex gap-4 mb-6">
          <Badge variant={errors.length > 0 ? "danger" : "success"}>
            {errors.length} Error{errors.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant={warnings.length > 0 ? "warning" : "success"}>
            {warnings.length} Warning{warnings.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="default">
            {infos.length} Info
          </Badge>
        </div>

        {/* Validation results by section */}
        <div className="space-y-6">
          {sections.map((section) => {
            const sectionResults = results.filter((r) => r.section === section);
            const sectionLabel = section.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
            const hasErrors = sectionResults.some((r) => r.level === "error");
            const hasWarnings = sectionResults.some((r) => r.level === "warning");

            return (
              <Card key={section}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {hasErrors ? (
                      <XCircle className="h-5 w-5 text-danger" />
                    ) : hasWarnings ? (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-success" />
                    )}
                    <CardTitle className="text-base">{sectionLabel}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {sectionResults.length === 0 ? (
                    <div className="flex items-center gap-2 text-success text-sm">
                      <CheckCircle className="h-4 w-4" />
                      All checks passed
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sectionResults.map((result, i) => {
                        const Icon = ICON_MAP[result.level];
                        return (
                          <div
                            key={i}
                            className={cn("flex items-start gap-3 text-sm", COLOR_MAP[result.level])}
                          >
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                            <span className="text-text-primary">{result.message}</span>
                          </div>
                        );
                      })}
                    </div>
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
