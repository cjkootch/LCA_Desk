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
    results.push({ level: "warning", section: "company_info", message: "LCS Certificate ID not provided" });
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

export function validateExpenditure(records: ExpenditureRecord[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (records.length === 0) {
    results.push({ level: "warning", section: "expenditure", message: "No expenditure records entered" });
    return results;
  }

  records.forEach((r, i) => {
    if (!r.type_of_item_procured) {
      results.push({ level: "error", section: "expenditure", message: `Row ${i + 1}: Missing type of item procured` });
    }
    if (!r.related_sector) {
      results.push({ level: "warning", section: "expenditure", message: `Row ${i + 1}: Missing related sector` });
    }
    if (r.sole_source_code && !r.supplier_certificate_id) {
      results.push({ level: "warning", section: "expenditure", message: `Row ${i + 1}: Sole-sourced item "${r.supplier_name}" missing supplier certificate ID` });
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

  const metrics = calculateEmploymentMetrics(records, jurisdictionCode);
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

  return results;
}

export function validateCapacity(records: CapacityDevelopmentRecord[]): ValidationResult[] {
  const results: ValidationResult[] = [];

  if (records.length === 0) {
    results.push({ level: "info", section: "capacity", message: "No capacity development activities recorded" });
    return results;
  }

  records.forEach((r) => {
    if (!r.start_date) {
      results.push({ level: "warning", section: "capacity", message: `Activity "${r.activity}": Missing start date` });
    }
    if (r.total_participants === 0) {
      results.push({ level: "warning", section: "capacity", message: `Activity "${r.activity}": No participants recorded` });
    }
  });

  return results;
}

export function validateNarratives(drafts: NarrativeDraft[]): ValidationResult[] {
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
