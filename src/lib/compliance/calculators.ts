import type { ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord } from "@/types/database.types";
import type { LocalContentMetrics, EmploymentMetrics, CapacityMetrics } from "@/types/reporting.types";

export function calculateLocalContentRate(
  expenditures: ExpenditureRecord[]
): LocalContentMetrics {
  const total = expenditures.reduce((sum, e) => sum + e.actual_payment, 0);
  // A supplier is Guyanese if they have an LCS certificate OR are explicitly marked as Guyanese
  const isGuyanese = (e: ExpenditureRecord) =>
    !!e.supplier_certificate_id || (e as unknown as Record<string, string>).supplier_type === "Guyanese";
  const guyanese = expenditures
    .filter(isGuyanese)
    .reduce((sum, e) => sum + e.actual_payment, 0);

  return {
    total_expenditure: total,
    guyanese_expenditure: guyanese,
    non_guyanese_expenditure: total - guyanese,
    local_content_rate: total > 0 ? (guyanese / total) * 100 : 0,
    supplier_count_guyanese: new Set(
      expenditures.filter(isGuyanese).map((e) => e.supplier_name)
    ).size,
    supplier_count_non_guyanese: new Set(
      expenditures.filter((e) => !isGuyanese(e)).map((e) => e.supplier_name)
    ).size,
  };
}

export function calculateEmploymentMetrics(
  records: EmploymentRecord[]
): EmploymentMetrics {
  const totalHeadcount = records.reduce((sum, r) => sum + r.total_employees, 0);
  const guyaneseHeadcount = records.reduce((sum, r) => sum + r.guyanese_employed, 0);

  const byCategory = (cat: string) => {
    const filtered = records.filter((r) => r.employment_category === cat);
    const total = filtered.reduce((sum, r) => sum + r.total_employees, 0);
    const guyanese = filtered.reduce((sum, r) => sum + r.guyanese_employed, 0);
    return { total, guyanese, pct: total > 0 ? (guyanese / total) * 100 : 0 };
  };

  const managerial = byCategory("Managerial");
  const technical = byCategory("Technical");
  const nonTechnical = byCategory("Non-Technical");

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
    total_participants: records.reduce((sum, r) => sum + r.total_participants, 0),
    total_guyanese_participants: records.reduce(
      (sum, r) => sum + r.guyanese_participants_only,
      0
    ),
    total_hours: records.reduce((sum, r) => sum + (r.duration_days || 0) * 8, 0),
    total_cost_local: records.reduce((sum, r) => sum + (r.expenditure_on_capacity || 0), 0),
    total_cost_usd: 0,
  };
}
