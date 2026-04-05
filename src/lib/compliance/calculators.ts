import type { ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord } from "@/types/database.types";
import type { LocalContentMetrics, EmploymentMetrics, CapacityMetrics } from "@/types/reporting.types";

export function calculateLocalContentRate(
  expenditures: ExpenditureRecord[]
): LocalContentMetrics {
  const total = expenditures.reduce((sum, e) => sum + e.amount_local, 0);
  const guyanese = expenditures
    .filter((e) => e.is_guyanese_supplier)
    .reduce((sum, e) => sum + e.amount_local, 0);

  return {
    total_expenditure: total,
    guyanese_expenditure: guyanese,
    non_guyanese_expenditure: total - guyanese,
    local_content_rate: total > 0 ? (guyanese / total) * 100 : 0,
    supplier_count_guyanese: new Set(
      expenditures.filter((e) => e.is_guyanese_supplier).map((e) => e.supplier_name)
    ).size,
    supplier_count_non_guyanese: new Set(
      expenditures.filter((e) => !e.is_guyanese_supplier).map((e) => e.supplier_name)
    ).size,
  };
}

export function calculateEmploymentMetrics(
  records: EmploymentRecord[]
): EmploymentMetrics {
  const totalHeadcount = records.reduce((sum, r) => sum + r.headcount, 0);
  const guyaneseHeadcount = records
    .filter((r) => r.is_guyanese)
    .reduce((sum, r) => sum + r.headcount, 0);

  const byType = (type: string) => {
    const filtered = records.filter((r) => r.position_type === type);
    const total = filtered.reduce((sum, r) => sum + r.headcount, 0);
    const guyanese = filtered
      .filter((r) => r.is_guyanese)
      .reduce((sum, r) => sum + r.headcount, 0);
    return { total, guyanese, pct: total > 0 ? (guyanese / total) * 100 : 0 };
  };

  const managerial = byType("managerial");
  const technical = byType("technical");
  const nonTechnical = byType("non_technical");

  return {
    total_headcount: totalHeadcount,
    guyanese_headcount: guyaneseHeadcount,
    non_guyanese_headcount: totalHeadcount - guyaneseHeadcount,
    guyanese_percentage: totalHeadcount > 0 ? (guyaneseHeadcount / totalHeadcount) * 100 : 0,
    managerial_total: managerial.total,
    managerial_guyanese: managerial.guyanese,
    managerial_guyanese_pct: managerial.pct,
    technical_total: technical.total,
    technical_guyanese: technical.guyanese,
    technical_guyanese_pct: technical.pct,
    non_technical_total: nonTechnical.total,
    non_technical_guyanese: nonTechnical.guyanese,
    non_technical_guyanese_pct: nonTechnical.pct,
  };
}

export function calculateCapacityMetrics(
  records: CapacityDevelopmentRecord[]
): CapacityMetrics {
  return {
    total_activities: records.length,
    total_participants: records.reduce((sum, r) => sum + r.participant_count, 0),
    total_guyanese_participants: records.reduce(
      (sum, r) => sum + r.guyanese_participant_count,
      0
    ),
    total_hours: records.reduce((sum, r) => sum + (r.total_hours || 0), 0),
    total_cost_local: records.reduce((sum, r) => sum + (r.cost_local || 0), 0),
    total_cost_usd: records.reduce((sum, r) => sum + (r.cost_usd || 0), 0),
  };
}
