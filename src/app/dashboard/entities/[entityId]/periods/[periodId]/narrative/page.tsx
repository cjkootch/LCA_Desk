"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { NarrativeDrafter } from "@/components/reporting/NarrativeDrafter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { calculateLocalContentRate, calculateEmploymentMetrics, calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { Entity, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";

export default function NarrativePage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [expenditures, setExpenditures] = useState<ExpenditureRecord[]>([]);
  const [employment, setEmployment] = useState<EmploymentRecord[]>([]);
  const [capacity, setCapacity] = useState<CapacityDevelopmentRecord[]>([]);
  const [narratives, setNarratives] = useState<NarrativeDraft[]>([]);
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
      setEntity(entityRes.data);
      setExpenditures(expRes.data || []);
      setEmployment(empRes.data || []);
      setCapacity(capRes.data || []);
      setNarratives(narRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [entityId, periodId, supabase]);

  const saveNarrative = async (section: string, content: string) => {
    const existing = narratives.find((n) => n.section === section);

    if (existing) {
      await supabase
        .from("narrative_drafts")
        .update({ draft_content: content, model_used: "claude-sonnet-4-6" })
        .eq("id", existing.id);
    } else {
      await supabase.from("narrative_drafts").insert({
        reporting_period_id: periodId,
        entity_id: entityId,
        section,
        draft_content: content,
        model_used: "claude-sonnet-4-6",
        prompt_version: "1.0",
      });
    }

    const { data } = await supabase
      .from("narrative_drafts")
      .select("*")
      .eq("reporting_period_id", periodId);
    setNarratives(data || []);
    toast.success("Narrative saved");
  };

  if (loading || !entity) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const lcMetrics = calculateLocalContentRate(expenditures);
  const empMetrics = calculateEmploymentMetrics(employment);
  const capMetrics = calculateCapacityMetrics(capacity);

  const expenditureData = {
    companyName: entity.legal_name,
    periodLabel: "H1 2026",
    periodStart: "January 1, 2026",
    periodEnd: "June 30, 2026",
    reportType: "Half-Yearly Report",
    totalExpenditure: lcMetrics.total_expenditure,
    totalUsd: 0,
    guyaneseExpenditure: lcMetrics.guyanese_expenditure,
    nonGuyaneseExpenditure: lcMetrics.non_guyanese_expenditure,
    localContentRate: lcMetrics.local_content_rate,
    guyaneseSupplierCount: lcMetrics.supplier_count_guyanese,
    nonGuyaneseSupplierCount: lcMetrics.supplier_count_non_guyanese,
    soleSourcingCount: expenditures.filter((e) => e.is_sole_sourced).length,
    topCategories: [],
    annualPlanCommitment: null,
  };

  const employmentData = {
    companyName: entity.legal_name,
    periodLabel: "H1 2026",
    periodStart: "January 1, 2026",
    periodEnd: "June 30, 2026",
    reportType: "Half-Yearly Report",
    totalHeadcount: empMetrics.total_headcount,
    guyaneseHeadcount: empMetrics.guyanese_headcount,
    nonGuyaneseHeadcount: empMetrics.non_guyanese_headcount,
    guyanesePercentage: empMetrics.guyanese_percentage,
    managerialTotal: empMetrics.managerial_total,
    managerialGuyanese: empMetrics.managerial_guyanese,
    managerialGuyanesePercent: empMetrics.managerial_guyanese_pct,
    technicalTotal: empMetrics.technical_total,
    technicalGuyanese: empMetrics.technical_guyanese,
    technicalGuyanesePercent: empMetrics.technical_guyanese_pct,
    nonTechnicalTotal: empMetrics.non_technical_total,
    nonTechnicalGuyanese: empMetrics.non_technical_guyanese,
    nonTechnicalGuyanesePercent: empMetrics.non_technical_guyanese_pct,
    totalRemuneration: 0,
    topJobTitles: [],
  };

  const capacityData = {
    companyName: entity.legal_name,
    periodLabel: "H1 2026",
    periodStart: "January 1, 2026",
    periodEnd: "June 30, 2026",
    reportType: "Half-Yearly Report",
    totalActivities: capMetrics.total_activities,
    totalParticipants: capMetrics.total_participants,
    guyaneseParticipants: capMetrics.total_guyanese_participants,
    totalHours: capMetrics.total_hours,
    totalCost: capMetrics.total_cost_local,
    activities: capacity.map((c) => ({
      name: c.activity_name,
      type: c.activity_type,
      participantCount: c.participant_count,
      hours: c.total_hours || 0,
      providerType: c.provider_type || "unknown",
    })),
  };

  return (
    <div>
      <TopBar title={`${entity.legal_name} — AI Narrative`} />
      <div className="p-8">
        <PageHeader
          title="AI Narrative Drafter"
          description="Generate compliance narratives powered by AI, then review and edit."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: entity.legal_name, href: `/dashboard/entities/${entityId}` },
            { label: "Narrative" },
          ]}
        />

        <PeriodChecklist
          entityId={entityId}
          periodId={periodId}
          currentStep="narrative"
          completedSteps={["company_info", "expenditure", "employment", "capacity"]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Data Summary */}
          <div className="space-y-4">
            <Card className="p-4">
              <h4 className="text-sm font-semibold text-text-secondary mb-3">Expenditure Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Total</span>
                  <span className="font-medium">{formatCurrency(lcMetrics.total_expenditure, "GYD")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">LC Rate</span>
                  <span className="font-bold text-gold">{formatPercentage(lcMetrics.local_content_rate)}</span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <h4 className="text-sm font-semibold text-text-secondary mb-3">Employment Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Guyanese %</span>
                  <span className="font-bold text-success">{formatPercentage(empMetrics.guyanese_percentage)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Headcount</span>
                  <span className="font-medium">{empMetrics.total_headcount}</span>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <h4 className="text-sm font-semibold text-text-secondary mb-3">Capacity Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Activities</span>
                  <span className="font-medium">{capMetrics.total_activities}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Hours</span>
                  <span className="font-medium">{capMetrics.total_hours}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Narrative Drafters */}
          <div className="lg:col-span-2 space-y-6">
            <NarrativeDrafter
              section="expenditure_narrative"
              sectionLabel="Section A: Expenditure Narrative"
              data={expenditureData}
              jurisdictionCode="GY"
              initialContent={narratives.find((n) => n.section === "expenditure_narrative")?.draft_content}
              onSave={(content) => saveNarrative("expenditure_narrative", content)}
            />
            <NarrativeDrafter
              section="employment_narrative"
              sectionLabel="Section B: Employment Narrative"
              data={employmentData}
              jurisdictionCode="GY"
              initialContent={narratives.find((n) => n.section === "employment_narrative")?.draft_content}
              onSave={(content) => saveNarrative("employment_narrative", content)}
            />
            <NarrativeDrafter
              section="capacity_narrative"
              sectionLabel="Section C: Capacity Development Narrative"
              data={capacityData}
              jurisdictionCode="GY"
              initialContent={narratives.find((n) => n.section === "capacity_narrative")?.draft_content}
              onSave={(content) => saveNarrative("capacity_narrative", content)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
