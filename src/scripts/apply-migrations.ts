import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Applying schema changes...\n");

  // Use sql.query() for dynamic SQL strings
  const migrations = [
    `ALTER TABLE lcs_register ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`,
    `ALTER TABLE lcs_register ADD COLUMN IF NOT EXISTS secretariat_note text`,
    `ALTER TABLE lcs_register ADD COLUMN IF NOT EXISTS moderated_by uuid`,
    `ALTER TABLE lcs_register ADD COLUMN IF NOT EXISTS moderated_at timestamp`,
    `ALTER TABLE lcs_opportunities ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`,
    `ALTER TABLE lcs_opportunities ADD COLUMN IF NOT EXISTS secretariat_note text`,
    `ALTER TABLE lcs_opportunities ADD COLUMN IF NOT EXISTS moderated_by uuid`,
    `ALTER TABLE lcs_opportunities ADD COLUMN IF NOT EXISTS moderated_at timestamp`,
    `ALTER TABLE lcs_employment_notices ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false`,
    `ALTER TABLE lcs_employment_notices ADD COLUMN IF NOT EXISTS secretariat_note text`,
    `ALTER TABLE lcs_employment_notices ADD COLUMN IF NOT EXISTS moderated_by uuid`,
    `ALTER TABLE lcs_employment_notices ADD COLUMN IF NOT EXISTS moderated_at timestamp`,
    `ALTER TABLE expenditure_records ADD COLUMN IF NOT EXISTS supplier_type text`,
    `ALTER TABLE payment_log ADD COLUMN IF NOT EXISTS supplier_type text`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status text`,
    `ALTER TABLE submission_logs ADD COLUMN IF NOT EXISTS uploaded_file_name text`,
    `ALTER TABLE submission_logs ADD COLUMN IF NOT EXISTS uploaded_file_key text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS capability_statement text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS portfolio text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS contact_email text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS contact_phone text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS employee_count integer`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS year_established integer`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS is_guyanese_owned boolean DEFAULT true`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamp`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS profile_views integer DEFAULT 0`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS responses_this_month integer DEFAULT 0`,
    `ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS responses_reset_at timestamp`,
  ];

  for (const q of migrations) {
    try {
      await sql.query(q);
      console.log("✓", q.slice(0, 75));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        console.log("·", q.slice(0, 75), "(exists)");
      } else {
        console.log("✗", q.slice(0, 75));
        console.log("  →", msg.slice(0, 120));
      }
    }
  }

  // Create new tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS saved_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, job_posting_id uuid REFERENCES job_postings(id) ON DELETE CASCADE, lcs_job_id uuid REFERENCES lcs_employment_notices(id) ON DELETE CASCADE, job_type text NOT NULL DEFAULT 'posted', created_at timestamp DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS supplier_responses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE, opportunity_id uuid NOT NULL REFERENCES lcs_opportunities(id) ON DELETE CASCADE, status text DEFAULT 'interested', cover_note text, contact_email text, contact_phone text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), UNIQUE(supplier_id, opportunity_id))`,
    `CREATE TABLE IF NOT EXISTS lcs_cert_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, application_type text NOT NULL DEFAULT 'individual', tier text NOT NULL DEFAULT 'self_service', status text NOT NULL DEFAULT 'draft', applicant_name text, applicant_email text, applicant_phone text, national_id_number text, tin_number text, legal_name text, trading_name text, business_registration_number text, business_address text, business_email text, business_phone text, business_website text, year_established integer, employee_count integer, is_guyanese_owned boolean DEFAULT true, ownership_percentage integer, service_categories text[], service_description text, documents text, documents_complete boolean DEFAULT false, stripe_payment_id text, amount_paid integer, paid_at timestamp, review_notes text, reviewed_by uuid REFERENCES users(id), reviewed_at timestamp, submitted_to_lcs_at timestamp, lcs_cert_id text, completed_step integer DEFAULT 0, country text DEFAULT 'GY', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS cancellation_feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), user_role text, plan text, reason text NOT NULL, reason_detail text, feedback text, action_taken text, saved_by_offer boolean DEFAULT false, created_at timestamp DEFAULT now())`,
  ];

  for (const q of tables) {
    try {
      await sql.query(q);
      console.log("✓ Table created/exists:", q.slice(27, 60));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("✗ Table:", msg.slice(0, 120));
    }
  }

  console.log("\n✅ All migrations applied!");
}

run();
