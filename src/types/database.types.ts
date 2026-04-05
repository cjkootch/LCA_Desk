export interface Jurisdiction {
  id: string;
  code: string;
  name: string;
  full_name: string | null;
  regulatory_body: string | null;
  regulatory_body_short: string | null;
  submission_email: string | null;
  submission_email_subject_format: string | null;
  currency_code: string;
  local_currency_code: string | null;
  active: boolean;
  phase: number;
  created_at: string;
}

export interface SectorCategory {
  id: string;
  jurisdiction_id: string;
  code: string;
  name: string;
  description: string | null;
  min_local_content_pct: number | null;
  reserved: boolean;
  active: boolean;
  sort_order: number | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string | null;
  jurisdiction_id: string;
  plan: string;
  plan_entity_limit: number;
  active: boolean;
  trial_ends_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

export interface Entity {
  id: string;
  tenant_id: string;
  jurisdiction_id: string;
  legal_name: string;
  trading_name: string | null;
  registration_number: string | null;
  lcs_certificate_id: string | null;
  lcs_certificate_expiry: string | null;
  petroleum_agreement_ref: string | null;
  company_type: "contractor" | "subcontractor" | "licensee" | null;
  guyanese_ownership_pct: number | null;
  registered_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  authorized_rep_name: string | null;
  authorized_rep_designation: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityCoventurer {
  id: string;
  entity_id: string;
  name: string;
  ownership_pct: number | null;
  is_guyanese: boolean;
  created_at: string;
}

export type ReportType =
  | "half_yearly_h1"
  | "half_yearly_h2"
  | "annual_plan"
  | "master_plan"
  | "performance_report";

export type PeriodStatus =
  | "not_started"
  | "in_progress"
  | "review"
  | "submitted"
  | "acknowledged";

export interface ReportingPeriod {
  id: string;
  entity_id: string;
  jurisdiction_id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  due_date: string;
  fiscal_year: number | null;
  status: PeriodStatus;
  submitted_at: string | null;
  acknowledged_at: string | null;
  secretariat_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// LCS Template v4.0 — Expenditure Sub-Report (13 columns)
export interface ExpenditureRecord {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  type_of_item_procured: string;
  related_sector: string | null;
  description_of_good_service: string | null;
  supplier_name: string;
  sole_source_code: string | null;
  supplier_certificate_id: string | null;
  actual_payment: number;
  outstanding_payment: number | null;
  projection_next_period: number | null;
  payment_method: string | null;
  supplier_bank: string | null;
  bank_location_country: string | null;
  currency_of_payment: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// LCS Template v4.0 — Employment Sub-Report (8 columns)
export interface EmploymentRecord {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  job_title: string;
  employment_category: "Managerial" | "Technical" | "Non-Technical";
  employment_classification: string | null;
  related_company: string | null;
  total_employees: number;
  guyanese_employed: number;
  total_remuneration_paid: number | null;
  remuneration_guyanese_only: number | null;
  notes: string | null;
  created_at: string;
}

// LCS Template v4.0 — Capacity Development Sub-Report (9 columns)
export type ParticipantType =
  | "Guyanese (Internal)"
  | "Guyanese (External)"
  | "Non-Guyanese (Internal)"
  | "Non-Guyanese (External)"
  | "Mixed (Internal)"
  | "Mixed (External)"
  | "Mixed"
  | "Guyanese Supplier"
  | "Non-Guyanese Supplier"
  | "Mixed Supplier";

export interface CapacityDevelopmentRecord {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  activity: string;
  category: string | null;
  participant_type: ParticipantType | null;
  guyanese_participants_only: number;
  total_participants: number;
  start_date: string | null;
  duration_days: number | null;
  cost_to_participants: number | null;
  expenditure_on_capacity: number | null;
  notes: string | null;
  created_at: string;
}

export interface NarrativeDraft {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  section:
    | "expenditure_narrative"
    | "employment_narrative"
    | "capacity_narrative"
    | "full_comparative_analysis";
  prompt_version: string | null;
  model_used: string | null;
  draft_content: string;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface SubmissionLog {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  submitted_by: string;
  submission_method: "email" | "portal" | "managed_service";
  submitted_to_email: string | null;
  email_subject: string | null;
  status: "sent" | "acknowledged" | "rejected" | "queried" | null;
  notes: string | null;
  created_at: string;
}
