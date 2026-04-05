import type { Entity, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";
import type { ValidationResult } from "@/types/reporting.types";
import { calculateEmploymentMetrics } from "./calculators";
import { getEmploymentMinimums } from "./jurisdiction-config";

export function validateCompanyInfo(entity: Entity): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (!entity.legal_name) {
    results.push({ level: "error", section: "company_info", message: "Legal name is required" });
  }
  if (!entity.lcs_certificate_id) {
    results.push({ level: "error", section: "company_info", message: "LCS Certificate ID is required" });
  }
  if (entity.lcs_certificate_expiry) {
    const expiry = new Date(entity.lcs_certificate_expiry);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) {
      results.push({ level: "error", section: "company_info", message: "LCS Certificate has expired" });
    } else if (daysUntilExpiry < 30) {
      results.push({ level: "warning", section: "company_info", message: `LCS Certificate expires in ${daysUntilExpiry} days` });
    }
  }

  return results;
}

export function validateExpenditure(
  records: ExpenditureRecord[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (records.length === 0) {
    results.push({ level: "warning", section: "expenditure", message: "No expenditure records entered" });
    return results;
  }

  records.forEach((r, i) => {
    if (!r.sector_category_id) {
      results.push({
        level: "error",
        section: "expenditure",
        message: `Row ${i + 1}: Missing sector category`,
        field: "sector_category_id",
      });
    }
    if (r.is_guyanese_supplier && !r.supplier_lcs_cert_id) {
      results.push({
        level: "warning",
        section: "expenditure",
        message: `Row ${i + 1}: Guyanese supplier "${r.supplier_name}" missing LCS Certificate ID`,
        field: "supplier_lcs_cert_id",
      });
    }
    if (r.is_sole_sourced && !r.sole_source_code) {
      results.push({
        level: "error",
        section: "expenditure",
        message: `Row ${i + 1}: Sole-sourced item missing sole source code`,
        field: "sole_source_code",
      });
    }
  });

  return results;
}

export function validateEmployment(
  records: EmploymentRecord[],
  jurisdictionCode: string
): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (records.length === 0) {
    results.push({ level: "warning", section: "employment", message: "No employment records entered" });
    return results;
  }

  const metrics = calculateEmploymentMetrics(records);
  const minimums = getEmploymentMinimums(jurisdictionCode);

  if (minimums.managerial > 0 && metrics.managerial_total > 0 && metrics.managerial_guyanese_pct < minimums.managerial) {
    results.push({
      level: "warning",
      section: "employment",
      message: `Guyanese managerial rate ${metrics.managerial_guyanese_pct.toFixed(1)}% — below ${minimums.managerial}% minimum`,
    });
  }

  if (minimums.technical > 0 && metrics.technical_total > 0 && metrics.technical_guyanese_pct < minimums.technical) {
    results.push({
      level: "warning",
      section: "employment",
      message: `Guyanese technical rate ${metrics.technical_guyanese_pct.toFixed(1)}% — below ${minimums.technical}% minimum`,
    });
  }

  if (minimums.non_technical > 0 && metrics.non_technical_total > 0 && metrics.non_technical_guyanese_pct < minimums.non_technical) {
    results.push({
      level: "warning",
      section: "employment",
      message: `Guyanese non-technical rate ${metrics.non_technical_guyanese_pct.toFixed(1)}% — below ${minimums.non_technical}% minimum`,
    });
  }

  records.forEach((r, i) => {
    if (!r.position_type) {
      results.push({
        level: "error",
        section: "employment",
        message: `Row ${i + 1}: Missing position type`,
        field: "position_type",
      });
    }
  });

  return results;
}

export function validateCapacity(
  records: CapacityDevelopmentRecord[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (records.length === 0) {
    results.push({ level: "info", section: "capacity", message: "No capacity development activities recorded" });
    return results;
  }

  records.forEach((r, i) => {
    if (!r.start_date || !r.end_date) {
      results.push({
        level: "warning",
        section: "capacity",
        message: `Activity "${r.activity_name}": Missing dates`,
        field: "dates",
      });
    }
    if (r.participant_count === 0) {
      results.push({
        level: "warning",
        section: "capacity",
        message: `Activity "${r.activity_name}": No participants recorded`,
        field: "participant_count",
      });
    }
  });

  return results;
}

export function validateNarratives(
  drafts: NarrativeDraft[]
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const sections = ["expenditure_narrative", "employment_narrative", "capacity_narrative"];

  for (const section of sections) {
    const draft = drafts.find((d) => d.section === section);
    if (!draft) {
      results.push({
        level: "error",
        section: "narrative",
        message: `${section.replace("_narrative", "").replace("_", " ")} narrative not drafted`,
      });
    } else if (draft.draft_content.trim().length < 50) {
      results.push({
        level: "warning",
        section: "narrative",
        message: `${section.replace("_narrative", "").replace("_", " ")} narrative appears too short`,
      });
    }
  }

  return results;
}

export function runFullValidation(
  entity: Entity,
  expenditures: ExpenditureRecord[],
  employment: EmploymentRecord[],
  capacity: CapacityDevelopmentRecord[],
  narratives: NarrativeDraft[],
  jurisdictionCode: string
): ValidationResult[] {
  return [
    ...validateCompanyInfo(entity),
    ...validateExpenditure(expenditures),
    ...validateEmployment(employment, jurisdictionCode),
    ...validateCapacity(capacity),
    ...validateNarratives(narratives),
  ];
}
