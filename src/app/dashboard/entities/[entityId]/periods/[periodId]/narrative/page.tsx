"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { NarrativeDrafter } from "@/components/reporting/NarrativeDrafter";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { calculateLocalContentRate, calculateEmploymentMetrics, calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { fetchEntity, fetchExpenditures, fetchEmployment, fetchCapacity, fetchNarratives, saveNarrative } from "@/server/actions";
import type { ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord } from "@/types/database.types";

function mapExp(e: Record<string, unknown>): ExpenditureRecord {
  return { id: e.id as string, reporting_period_id: "", entity_id: "", type_of_item_procured: e.typeOfItemProcured as string, related_sector: e.relatedSector as string | null, description_of_good_service: null, supplier_name: e.supplierName as string, sole_source_code: e.soleSourceCode as string | null, supplier_certificate_id: e.supplierCertificateId as string | null, actual_payment: Number(e.actualPayment), outstanding_payment: null, projection_next_period: null, payment_method: null, supplier_bank: null, bank_location_country: null, currency_of_payment: "GYD", notes: null, created_at: "", updated_at: "" };
}
function mapEmp(e: Record<string, unknown>): EmploymentRecord {
  return { id: e.id as string, reporting_period_id: "", entity_id: "", job_title: e.jobTitle as string, employment_category: e.employmentCategory as EmploymentRecord["employment_category"], employment_classification: null, related_company: null, total_employees: (e.totalEmployees as number) || 0, guyanese_employed: (e.guyanaeseEmployed as number) || 0, total_remuneration_paid: e.totalRemunerationPaid ? Number(e.totalRemunerationPaid) : null, remuneration_guyanese_only: null, notes: null, created_at: "" };
}
function mapCap(c: Record<string, unknown>): CapacityDevelopmentRecord {
  return { id: c.id as string, reporting_period_id: "", entity_id: "", activity: c.activity as string, category: c.category as string | null, participant_type: c.participantType as CapacityDevelopmentRecord["participant_type"], guyanese_participants_only: (c.guyanaeseParticipantsOnly as number) || 0, total_participants: (c.totalParticipants as number) || 0, start_date: null, duration_days: c.durationDays as number | null, cost_to_participants: null, expenditure_on_capacity: c.expenditureOnCapacity ? Number(c.expenditureOnCapacity) : null, notes: null, created_at: "" };
}

export default function NarrativePage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entityName, setEntityName] = useState("");
  const [expenditures, setExpenditures] = useState<ExpenditureRecord[]>([]);
  const [employment, setEmployment] = useState<EmploymentRecord[]>([]);
  const [capacity, setCapacity] = useState<CapacityDevelopmentRecord[]>([]);
  const [narrativeContents, setNarrativeContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [entity, rawExp, rawEmp, rawCap, rawNar] = await Promise.all([
        fetchEntity(entityId), fetchExpenditures(periodId), fetchEmployment(periodId), fetchCapacity(periodId), fetchNarratives(periodId),
      ]);
      setEntityName(entity?.legalName || "");
      setExpenditures(rawExp.map((r) => mapExp(r as unknown as Record<string, unknown>)));
      setEmployment(rawEmp.map((r) => mapEmp(r as unknown as Record<string, unknown>)));
      setCapacity(rawCap.map((r) => mapCap(r as unknown as Record<string, unknown>)));
      const contents: Record<string, string> = {};
      rawNar.forEach((n) => { contents[n.section] = n.draftContent; });
      setNarrativeContents(contents);
      setLoading(false);
    };
    load();
  }, [entityId, periodId]);

  const handleSaveNarrative = async (section: string, content: string) => {
    await saveNarrative(periodId, entityId, section, content);
    setNarrativeContents((prev) => ({ ...prev, [section]: content }));
    toast.success("Narrative saved");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const lcMetrics = calculateLocalContentRate(expenditures);
  const empMetrics = calculateEmploymentMetrics(employment);
  const capMetrics = calculateCapacityMetrics(capacity);

  const expenditureData = { companyName: entityName, periodLabel: "H1 2026", periodStart: "January 1, 2026", periodEnd: "June 30, 2026", reportType: "Half-Yearly Report", totalExpenditure: lcMetrics.total_expenditure, totalUsd: 0, guyaneseExpenditure: lcMetrics.guyanese_expenditure, nonGuyaneseExpenditure: lcMetrics.non_guyanese_expenditure, localContentRate: lcMetrics.local_content_rate, guyaneseSupplierCount: lcMetrics.supplier_count_guyanese, nonGuyaneseSupplierCount: lcMetrics.supplier_count_non_guyanese, soleSourcingCount: expenditures.filter((e) => !!e.sole_source_code).length, topCategories: [] as Array<{name: string; amount: number; isGuyanese: boolean}>, annualPlanCommitment: null };
  const employmentData = { companyName: entityName, periodLabel: "H1 2026", periodStart: "January 1, 2026", periodEnd: "June 30, 2026", reportType: "Half-Yearly Report", totalHeadcount: empMetrics.total_headcount, guyaneseHeadcount: empMetrics.guyanese_headcount, nonGuyaneseHeadcount: empMetrics.non_guyanese_headcount, guyanesePercentage: empMetrics.guyanese_percentage, managerialTotal: empMetrics.managerial_total, managerialGuyanese: empMetrics.managerial_guyanese, managerialGuyanesePercent: empMetrics.managerial_guyanese_pct, technicalTotal: empMetrics.technical_total, technicalGuyanese: empMetrics.technical_guyanese, technicalGuyanesePercent: empMetrics.technical_guyanese_pct, nonTechnicalTotal: empMetrics.non_technical_total, nonTechnicalGuyanese: empMetrics.non_technical_guyanese, nonTechnicalGuyanesePercent: empMetrics.non_technical_guyanese_pct, totalRemuneration: 0, topJobTitles: [] as Array<{title: string; headcount: number; isGuyanese: boolean}> };
  const capacityData = { companyName: entityName, periodLabel: "H1 2026", periodStart: "January 1, 2026", periodEnd: "June 30, 2026", reportType: "Half-Yearly Report", totalActivities: capMetrics.total_activities, totalParticipants: capMetrics.total_participants, guyaneseParticipants: capMetrics.total_guyanese_participants, totalHours: capMetrics.total_hours, totalCost: capMetrics.total_cost_local, activities: capacity.map((c) => ({ name: c.activity, type: c.category || "", participantCount: c.total_participants, hours: (c.duration_days || 0) * 8, providerType: c.participant_type || "unknown" })) };

  return (
    <div>
      <TopBar title={`${entityName} — AI Narrative`} />
      <div className="p-8">
        <PageHeader title="AI Narrative Drafter" description="Generate compliance narratives powered by AI, then review and edit."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Narrative" }]} />
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="narrative" completedSteps={["company_info", "expenditure", "employment", "capacity"]} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card className="p-4"><h4 className="text-sm font-semibold text-text-secondary mb-3">Expenditure</h4><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-text-muted">Total</span><span className="font-medium">{formatCurrency(lcMetrics.total_expenditure, "GYD")}</span></div><div className="flex justify-between"><span className="text-text-muted">LC Rate</span><span className="font-bold text-gold">{formatPercentage(lcMetrics.local_content_rate)}</span></div></div></Card>
            <Card className="p-4"><h4 className="text-sm font-semibold text-text-secondary mb-3">Employment</h4><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-text-muted">Guyanese %</span><span className="font-bold text-success">{formatPercentage(empMetrics.guyanese_percentage)}</span></div><div className="flex justify-between"><span className="text-text-muted">Total Employees</span><span>{empMetrics.total_headcount}</span></div></div></Card>
            <Card className="p-4"><h4 className="text-sm font-semibold text-text-secondary mb-3">Capacity</h4><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-text-muted">Activities</span><span>{capMetrics.total_activities}</span></div><div className="flex justify-between"><span className="text-text-muted">Investment</span><span>{formatCurrency(capMetrics.total_cost_local, "GYD")}</span></div></div></Card>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <NarrativeDrafter section="expenditure_narrative" sectionLabel="Section A: Expenditure Narrative" data={expenditureData} jurisdictionCode="GY" initialContent={narrativeContents["expenditure_narrative"]} onSave={(content) => handleSaveNarrative("expenditure_narrative", content)} />
            <NarrativeDrafter section="employment_narrative" sectionLabel="Section B: Employment Narrative" data={employmentData} jurisdictionCode="GY" initialContent={narrativeContents["employment_narrative"]} onSave={(content) => handleSaveNarrative("employment_narrative", content)} />
            <NarrativeDrafter section="capacity_narrative" sectionLabel="Section C: Capacity Development Narrative" data={capacityData} jurisdictionCode="GY" initialContent={narrativeContents["capacity_narrative"]} onSave={(content) => handleSaveNarrative("capacity_narrative", content)} />
          </div>
        </div>
      </div>
    </div>
  );
}
