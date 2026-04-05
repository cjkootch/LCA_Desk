import type { ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, Entity, ReportingPeriod, SectorCategory } from "./database.types";

export interface LocalContentMetrics {
  total_expenditure: number;
  guyanese_expenditure: number;
  non_guyanese_expenditure: number;
  local_content_rate: number;
  supplier_count_guyanese: number;
  supplier_count_non_guyanese: number;
}

export interface EmploymentMetrics {
  total_headcount: number;
  guyanese_headcount: number;
  non_guyanese_headcount: number;
  guyanese_percentage: number;
  managerial_total: number;
  managerial_guyanese: number;
  managerial_guyanese_pct: number;
  technical_total: number;
  technical_guyanese: number;
  technical_guyanese_pct: number;
  non_technical_total: number;
  non_technical_guyanese: number;
  non_technical_guyanese_pct: number;
}

export interface CapacityMetrics {
  total_activities: number;
  total_participants: number;
  total_guyanese_participants: number;
  total_hours: number;
  total_cost_local: number;
  total_cost_usd: number;
}

export interface ValidationResult {
  level: "error" | "warning" | "info";
  section: string;
  message: string;
  field?: string;
}

export interface ReportExportData {
  entity: Entity;
  period: ReportingPeriod;
  expenditures: ExpenditureRecord[];
  employment: EmploymentRecord[];
  capacity: CapacityDevelopmentRecord[];
  sectorCategories: SectorCategory[];
  jurisdictionCode: string;
  localContentMetrics: LocalContentMetrics;
  employmentMetrics: EmploymentMetrics;
  capacityMetrics: CapacityMetrics;
  narratives: {
    expenditure: string;
    employment: string;
    capacity: string;
  };
}

export type FilingStep =
  | "company_info"
  | "expenditure"
  | "employment"
  | "capacity"
  | "narrative"
  | "review"
  | "export";

export interface FilingStepConfig {
  key: FilingStep;
  label: string;
  path: string;
  number: number;
}

export const FILING_STEPS: FilingStepConfig[] = [
  { key: "company_info", label: "Company Info", path: "", number: 1 },
  { key: "expenditure", label: "Expenditure", path: "/expenditure", number: 2 },
  { key: "employment", label: "Employment", path: "/employment", number: 3 },
  { key: "capacity", label: "Capacity Development", path: "/capacity", number: 4 },
  { key: "narrative", label: "AI Narrative", path: "/narrative", number: 5 },
  { key: "review", label: "Review & Validate", path: "/review", number: 6 },
  { key: "export", label: "Export & Submit", path: "/export", number: 7 },
];
