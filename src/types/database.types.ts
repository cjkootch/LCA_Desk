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

export interface ExpenditureRecord {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  sector_category_id: string;
  supplier_name: string;
  supplier_lcs_cert_id: string | null;
  is_guyanese_supplier: boolean;
  is_sole_sourced: boolean;
  sole_source_code: string | null;
  amount_local: number;
  amount_usd: number | null;
  currency_code: string;
  payment_method: string | null;
  contract_date: string | null;
  payment_date: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmploymentRecord {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  job_title: string;
  isco_08_code: string | null;
  position_type: "managerial" | "technical" | "non_technical";
  is_guyanese: boolean;
  nationality: string | null;
  headcount: number;
  remuneration_band: string | null;
  total_remuneration_local: number | null;
  total_remuneration_usd: number | null;
  contract_type: "permanent" | "contract" | "temporary" | null;
  notes: string | null;
  created_at: string;
}

export interface CapacityDevelopmentRecord {
  id: string;
  reporting_period_id: string;
  entity_id: string;
  activity_type:
    | "training"
    | "scholarship"
    | "apprenticeship"
    | "on_the_job"
    | "certification";
  activity_name: string;
  provider_name: string | null;
  provider_type: "local" | "international" | null;
  participant_count: number;
  guyanese_participant_count: number;
  start_date: string | null;
  end_date: string | null;
  total_hours: number | null;
  cost_local: number | null;
  cost_usd: number | null;
  description: string | null;
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
