import { z } from "zod";

// ─── ENTITY ──────────────────────────────────────────────────────
export const entitySchema = z.object({
  legal_name: z.string().min(1, "Legal name is required"),
  trading_name: z.string().optional().nullable(),
  registration_number: z.string().optional().nullable(),
  lcs_certificate_id: z.string().optional().nullable(),
  lcs_certificate_expiry: z.string().optional().nullable(),
  petroleum_agreement_ref: z.string().optional().nullable(),
  company_type: z.string().optional().nullable(),
  guyanese_ownership_pct: z.coerce.number().optional().nullable(),
  registered_address: z.string().optional().nullable(),
  tin_number: z.string().optional().nullable(),
  date_of_incorporation: z.string().optional().nullable(),
  industry_sector: z.string().optional().nullable(),
  number_of_employees: z.coerce.number().int().optional().nullable(),
  annual_revenue_range: z.string().optional().nullable(),
  operational_address: z.string().optional().nullable(),
  parent_company_name: z.string().optional().nullable(),
  country_of_incorporation: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable().or(z.literal("")),
  contact_phone: z.string().optional().nullable(),
  authorized_rep_name: z.string().optional().nullable(),
  authorized_rep_designation: z.string().optional().nullable(),
});
export type EntityInput = z.infer<typeof entitySchema>;

// ─── EXPENDITURE ─────────────────────────────────────────────────
export const expenditureSchema = z.object({
  supplier_name: z.string().min(1, "Supplier name is required"),
  supplier_type: z.string().optional().nullable(),
  supplier_certificate_id: z.string().optional().nullable(),
  goods_services_description: z.string().optional().nullable(),
  sector_category_id: z.string().uuid().optional().nullable(),
  contract_value: z.coerce.number().optional().nullable(),
  actual_payment: z.coerce.number().optional().nullable(),
  currency: z.string().default("USD"),
  procurement_method: z.string().optional().nullable(),
  contract_start_date: z.string().optional().nullable(),
  contract_end_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type ExpenditureInput = z.infer<typeof expenditureSchema>;

// ─── EMPLOYMENT ──────────────────────────────────────────────────
export const employmentSchema = z.object({
  employment_category: z.string().min(1, "Employment category is required"),
  job_title: z.string().optional().nullable(),
  total_employees: z.coerce.number().int().min(0).default(0),
  guyanese_employed: z.coerce.number().int().min(0).default(0),
  non_guyanese_employed: z.coerce.number().int().min(0).default(0),
  new_hires_guyanese: z.coerce.number().int().min(0).optional().nullable(),
  new_hires_non_guyanese: z.coerce.number().int().min(0).optional().nullable(),
  succession_plan_exists: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type EmploymentInput = z.infer<typeof employmentSchema>;

// ─── CAPACITY DEVELOPMENT ────────────────────────────────────────
export const capacitySchema = z.object({
  program_name: z.string().min(1, "Program name is required"),
  program_type: z.string().optional().nullable(),
  provider_name: z.string().optional().nullable(),
  total_participants: z.coerce.number().int().min(0).optional().nullable(),
  guyanese_participants: z.coerce.number().int().min(0).optional().nullable(),
  duration_days: z.coerce.number().min(0).optional().nullable(),
  expenditure_on_capacity: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().default("USD"),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  certification_awarded: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CapacityInput = z.infer<typeof capacitySchema>;

// ─── EMPLOYEE ROSTER ─────────────────────────────────────────────
export const employeeSchema = z.object({
  entity_id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(1, "Name is required"),
  job_title: z.string().optional().nullable(),
  employment_category: z.string().optional().nullable(),
  is_guyanese: z.boolean().default(false),
  nationality: z.string().optional().nullable(),
  hire_date: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  employment_type: z.string().optional().nullable(),
  salary_range: z.string().optional().nullable(),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

// ─── JOB POSTING ─────────────────────────────────────────────────
export const jobPostingSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  description: z.string().optional().nullable(),
  employment_category: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  salary_range: z.string().optional().nullable(),
  contract_type: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  entity_id: z.string().uuid().optional().nullable(),
});
export type JobPostingInput = z.infer<typeof jobPostingSchema>;

// ─── SUPPLIER (filer-side directory) ─────────────────────────────
export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  certificate_id: z.string().optional().nullable(),
  certificate_expiry: z.string().optional().nullable(),
  service_category: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable().or(z.literal("")),
  contact_phone: z.string().optional().nullable(),
  is_guyanese: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;
