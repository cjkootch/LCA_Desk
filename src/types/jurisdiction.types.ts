export interface JurisdictionConfig {
  code: string;
  name: string;
  regulatoryBody: string;
  submissionEmail: string;
  subjectFormat: string;
  currencyCode: string;
  localCurrencyCode: string;
  employmentMinimums: EmploymentMinimums;
}

export interface EmploymentMinimums {
  managerial: number;
  technical: number;
  non_technical: number;
}

export interface ComplianceDeadline {
  type: string;
  label: string;
  period_start: Date;
  period_end: Date;
  due_date: Date;
  days_warning: number;
}

export type DeadlineStatus = "overdue" | "due_soon" | "on_track" | "completed";

export interface DeadlineWithStatus extends ComplianceDeadline {
  status: DeadlineStatus;
  days_remaining: number;
  entity_id?: string;
  entity_name?: string;
}
