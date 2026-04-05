export type NarrativeSection =
  | "expenditure_narrative"
  | "employment_narrative"
  | "capacity_narrative"
  | "full_comparative_analysis";

export interface NarrativeRequest {
  section: NarrativeSection;
  data: ExpenditureNarrativeInput | EmploymentNarrativeInput | CapacityNarrativeInput | FullAnalysisInput;
  jurisdiction_code: string;
}

export interface ExpenditureNarrativeInput {
  companyName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  reportType: string;
  totalExpenditure: number;
  totalUsd: number;
  guyaneseExpenditure: number;
  nonGuyaneseExpenditure: number;
  localContentRate: number;
  guyaneseSupplierCount: number;
  nonGuyaneseSupplierCount: number;
  soleSourcingCount: number;
  topCategories: Array<{
    name: string;
    amount: number;
    isGuyanese: boolean;
  }>;
  annualPlanCommitment: string | null;
}

export interface EmploymentNarrativeInput {
  companyName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  reportType: string;
  totalHeadcount: number;
  guyaneseHeadcount: number;
  nonGuyaneseHeadcount: number;
  guyanesePercentage: number;
  managerialTotal: number;
  managerialGuyanese: number;
  managerialGuyanesePercent: number;
  technicalTotal: number;
  technicalGuyanese: number;
  technicalGuyanesePercent: number;
  nonTechnicalTotal: number;
  nonTechnicalGuyanese: number;
  nonTechnicalGuyanesePercent: number;
  totalRemuneration: number;
  topJobTitles: Array<{
    title: string;
    headcount: number;
    isGuyanese: boolean;
  }>;
}

export interface CapacityNarrativeInput {
  companyName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  reportType: string;
  totalActivities: number;
  totalParticipants: number;
  guyaneseParticipants: number;
  totalHours: number;
  totalCost: number;
  activities: Array<{
    name: string;
    type: string;
    participantCount: number;
    hours: number;
    providerType: string;
  }>;
}

export interface FullAnalysisInput {
  expenditure: ExpenditureNarrativeInput;
  employment: EmploymentNarrativeInput;
  capacity: CapacityNarrativeInput;
}
