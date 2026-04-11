CREATE TABLE "amendment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"requested_by" uuid,
	"items" text NOT NULL,
	"summary" text NOT NULL,
	"response_deadline" date,
	"status" text DEFAULT 'pending',
	"filer_response" text,
	"responded_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"target_roles" text DEFAULT 'all' NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp,
	"expires_at" timestamp,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"reporting_period_id" uuid,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cancellation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_role" text,
	"plan" text,
	"reason" text NOT NULL,
	"reason_detail" text,
	"feedback" text,
	"action_taken" text,
	"saved_by_offer" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"company_name" text NOT NULL,
	"legal_name" text,
	"logo_url" text,
	"website" text,
	"description" text,
	"industry" text DEFAULT 'Oil & Gas',
	"company_size" text,
	"headquarters" text,
	"guyana_office" text,
	"total_opportunities" integer DEFAULT 0,
	"active_opportunities" integer DEFAULT 0,
	"total_job_postings" integer DEFAULT 0,
	"open_job_postings" integer DEFAULT 0,
	"contact_emails" text,
	"contact_phones" text,
	"contact_names" text,
	"procurement_categories" text[],
	"employment_categories" text[],
	"claimed" boolean DEFAULT false,
	"claimed_by" uuid,
	"claimed_at" timestamp,
	"tenant_id" uuid,
	"verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"verification_method" text,
	"verification_notes" text,
	"lcs_cert_id" text,
	"lcs_registered" boolean DEFAULT false,
	"lcs_status" text,
	"lcs_expiration_date" date,
	"lcs_email" text,
	"lcs_phone" text,
	"lcs_address" text,
	"lcs_service_categories" text[],
	"data_source" text DEFAULT 'scraped',
	"last_aggregated_at" timestamp,
	"country" text DEFAULT 'GY',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"quiz_questions" text,
	"passing_score" integer DEFAULT 80
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"audience" text NOT NULL,
	"jurisdiction_code" text,
	"module_count" integer DEFAULT 0,
	"badge_label" text,
	"badge_color" text DEFAULT 'accent',
	"estimated_minutes" integer,
	"mandatory" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"status" text DEFAULT 'running' NOT NULL,
	"records_processed" integer DEFAULT 0,
	"error_message" text,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"full_name" text NOT NULL,
	"job_title" text NOT NULL,
	"employment_category" text NOT NULL,
	"employment_classification" text,
	"is_guyanese" boolean DEFAULT true,
	"nationality" text,
	"contract_type" text,
	"start_date" date,
	"active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "industry_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"ai_summary" text,
	"source_url" text NOT NULL,
	"source_name" text NOT NULL,
	"image_url" text,
	"published_at" date,
	"category" text,
	"relevance_score" integer,
	"companies" text[],
	"country" text DEFAULT 'GY',
	"scraped_at" timestamp DEFAULT now(),
	CONSTRAINT "industry_news_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_posting_id" uuid NOT NULL,
	"applicant_user_id" uuid,
	"applicant_name" text NOT NULL,
	"applicant_email" text NOT NULL,
	"applicant_phone" text,
	"is_guyanese" boolean DEFAULT true,
	"nationality" text,
	"employment_category" text,
	"employment_classification" text,
	"cover_note" text,
	"cv_url" text,
	"status" text DEFAULT 'received',
	"review_notes" text,
	"employee_record_id" uuid,
	"hired_at" timestamp,
	"country" text DEFAULT 'GY',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"job_title" text NOT NULL,
	"employment_category" text NOT NULL,
	"employment_classification" text,
	"contract_type" text NOT NULL,
	"location" text,
	"description" text,
	"qualifications" text,
	"vacancy_count" integer DEFAULT 1,
	"application_deadline" date,
	"start_date" date,
	"status" text DEFAULT 'open',
	"is_public" boolean DEFAULT true,
	"guyanese_first_statement" text,
	"guyanese_hired" boolean,
	"filled_at" timestamp,
	"country" text DEFAULT 'GY',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_seeker_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_job_title" text,
	"employment_category" text,
	"employment_classification" text,
	"years_experience" integer,
	"is_guyanese" boolean DEFAULT true,
	"guyanese_status" text,
	"nationality" text DEFAULT 'Guyanese',
	"national_id_number" text,
	"isco_code" text,
	"education_level" text,
	"education_field" text,
	"certifications" text[],
	"work_permit_status" text,
	"lcs_cert_id" text,
	"lca_attestation_date" timestamp,
	"lca_attestation_text" text,
	"cv_url" text,
	"resume_content" text,
	"skills" text[],
	"location_preference" text DEFAULT 'Any',
	"contract_type_preference" text,
	"alerts_enabled" boolean DEFAULT true,
	"profile_visible" boolean DEFAULT false,
	"headline" text,
	"country" text DEFAULT 'GY',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_seeker_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "lcs_cert_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_type" text DEFAULT 'individual' NOT NULL,
	"tier" text DEFAULT 'self_service' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"applicant_name" text,
	"applicant_email" text,
	"applicant_phone" text,
	"national_id_number" text,
	"tin_number" text,
	"legal_name" text,
	"trading_name" text,
	"business_registration_number" text,
	"business_address" text,
	"business_email" text,
	"business_phone" text,
	"business_website" text,
	"year_established" integer,
	"employee_count" integer,
	"is_guyanese_owned" boolean DEFAULT true,
	"ownership_percentage" integer,
	"service_categories" text[],
	"service_description" text,
	"documents" text,
	"documents_complete" boolean DEFAULT false,
	"stripe_payment_id" text,
	"amount_paid" integer,
	"paid_at" timestamp,
	"review_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"submitted_to_lcs_at" timestamp,
	"lcs_cert_id" text,
	"completed_step" integer DEFAULT 0,
	"country" text DEFAULT 'GY',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lcs_contractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"profile_slug" text,
	"confirmed_filer" boolean DEFAULT true,
	"notice_count" integer DEFAULT 0,
	"last_noticed_at" date,
	"procurement_categories" text[],
	"sample_notices" text[],
	"outreach_status" text DEFAULT 'not_contacted',
	"country" text DEFAULT 'GY',
	"scraped_at" timestamp DEFAULT now(),
	"scrape_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lcs_contractors_profile_slug_unique" UNIQUE("profile_slug")
);
--> statement-breakpoint
CREATE TABLE "lcs_employment_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"company_slug" text,
	"job_title" text NOT NULL,
	"employment_category" text,
	"notice_type" text,
	"description" text,
	"qualifications" text,
	"location" text,
	"closing_date" date,
	"posted_date" date,
	"source_url" text,
	"source_slug" text,
	"attachment_url" text,
	"attachment_urls" text,
	"page_content" text,
	"ai_summary" text,
	"status" text DEFAULT 'open',
	"pinned" boolean DEFAULT false,
	"secretariat_note" text,
	"moderated_by" uuid,
	"moderated_at" timestamp,
	"country" text DEFAULT 'GY',
	"scraped_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lcs_employment_notices_source_slug_unique" UNIQUE("source_slug")
);
--> statement-breakpoint
CREATE TABLE "lcs_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_name" text NOT NULL,
	"contractor_slug" text,
	"type" text NOT NULL,
	"notice_type" text,
	"title" text NOT NULL,
	"description" text,
	"lca_category" text,
	"employment_category" text,
	"posted_date" date,
	"deadline" date,
	"source_url" text,
	"source_slug" text,
	"attachment_url" text,
	"attachment_urls" text,
	"attachment_content" text,
	"ai_summary" text,
	"status" text DEFAULT 'active',
	"pinned" boolean DEFAULT false,
	"secretariat_note" text,
	"moderated_by" uuid,
	"moderated_at" timestamp,
	"country" text DEFAULT 'GY',
	"scraped_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lcs_opportunities_source_slug_unique" UNIQUE("source_slug")
);
--> statement-breakpoint
CREATE TABLE "lcs_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cert_id" text,
	"profile_slug" text NOT NULL,
	"profile_url" text,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"status" text,
	"expiration_date" date,
	"address" text,
	"email" text,
	"website" text,
	"phone" text,
	"service_categories" text[],
	"page_content" text,
	"ai_summary" text,
	"country" text DEFAULT 'GY',
	"scraped_at" timestamp DEFAULT now(),
	"scrape_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lcs_register_cert_id_unique" UNIQUE("cert_id"),
	CONSTRAINT "lcs_register_profile_slug_unique" UNIQUE("profile_slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false,
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"supplier_name" text NOT NULL,
	"supplier_type" text,
	"supplier_certificate_id" text,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'GYD',
	"description" text,
	"category" text,
	"payment_date" date,
	"invoice_ref" text,
	"imported" boolean DEFAULT false,
	"imported_to_period_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"referred_user_id" uuid,
	"referred_email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"qualified_at" timestamp,
	"rewarded_at" timestamp,
	"reward_type" text,
	"reward_amount" text,
	"commission_amount" numeric,
	"commission_paid_at" timestamp,
	"converted_plan" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_posting_id" uuid,
	"lcs_job_id" uuid,
	"job_type" text DEFAULT 'posted' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "saved_opp_unique" UNIQUE("user_id","opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "secretariat_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'reviewer',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "secretariat_offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"jurisdiction_id" uuid,
	"country" text DEFAULT 'GY',
	"active" boolean DEFAULT true,
	"logo_url" text,
	"phone" text,
	"address" text,
	"website" text,
	"signatory_name" text,
	"signatory_title" text,
	"submission_email" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "submission_acknowledgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"acknowledged_by" uuid,
	"status" text DEFAULT 'received',
	"notes" text,
	"reference_number" text,
	"acknowledged_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lcs_cert_id" text,
	"lcs_verified" boolean DEFAULT false,
	"lcs_status" text,
	"lcs_expiration_date" date,
	"lcs_verified_at" timestamp,
	"legal_name" text,
	"trading_name" text,
	"address" text,
	"website" text,
	"service_categories" text[],
	"capability_statement" text,
	"portfolio" text,
	"contact_email" text,
	"contact_phone" text,
	"employee_count" integer,
	"year_established" integer,
	"is_guyanese_owned" boolean DEFAULT true,
	"tier" text DEFAULT 'starter',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"trial_ends_at" timestamp,
	"profile_views" integer DEFAULT 0,
	"responses_this_month" integer DEFAULT 0,
	"responses_reset_at" timestamp,
	"featured_until" timestamp,
	"logo_url" text,
	"profile_visible" boolean DEFAULT true,
	"country" text DEFAULT 'GY',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "supplier_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"status" text DEFAULT 'interested',
	"cover_note" text,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_response_unique" UNIQUE("supplier_id","opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"certificate_id" text,
	"sole_source_code" text,
	"bank_name" text,
	"bank_country" text,
	"default_sector" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'general',
	"priority" text DEFAULT 'normal',
	"status" text DEFAULT 'open',
	"screenshot_urls" text,
	"page_url" text,
	"user_agent" text,
	"admin_notes" text,
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"tenant_id" uuid,
	"secretariat_office_id" uuid,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"inviter_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tenant_training_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"mandatory" boolean DEFAULT false,
	"required_for_roles" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"is_admin" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_month" text NOT NULL,
	"ai_drafts_used" integer DEFAULT 0,
	"ai_chat_messages_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "usage_tenant_month" UNIQUE("tenant_id","period_month")
);
--> statement-breakpoint
CREATE TABLE "user_course_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid,
	"status" text DEFAULT 'not_started',
	"quiz_score" integer,
	"completed_at" timestamp,
	"badge_earned_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp DEFAULT now(),
	"session_id" text
);
--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP CONSTRAINT "expenditure_records_sector_category_id_sector_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "plan" SET DEFAULT 'lite';--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "activity" text NOT NULL;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "participant_type" text;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "guyanese_participants_only" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "total_participants" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "duration_days" integer;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "cost_to_participants" numeric;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD COLUMN "expenditure_on_capacity" numeric;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "employment_category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "employment_classification" text;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "related_company" text;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "total_employees" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "guyanese_employed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "total_remuneration_paid" numeric;--> statement-breakpoint
ALTER TABLE "employment_records" ADD COLUMN "remuneration_guyanese_only" numeric;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "tin_number" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "date_of_incorporation" date;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "industry_sector" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "number_of_employees" integer;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "annual_revenue_range" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "operational_address" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "parent_company_name" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "country_of_incorporation" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "authorized_rep_name" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "authorized_rep_designation" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "type_of_item_procured" text NOT NULL;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "related_sector" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "description_of_good_service" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "supplier_type" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "supplier_certificate_id" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "actual_payment" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "outstanding_payment" numeric;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "projection_next_period" numeric;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "supplier_bank" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "bank_location_country" text;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD COLUMN "currency_of_payment" text DEFAULT 'GYD';--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "prepared_by" uuid;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "prepared_at" timestamp;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "attestation" text;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "attested_by" uuid;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "attested_at" timestamp;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD COLUMN "snapshot_data" text;--> statement-breakpoint
ALTER TABLE "submission_logs" ADD COLUMN "uploaded_file_name" text;--> statement-breakpoint
ALTER TABLE "submission_logs" ADD COLUMN "uploaded_file_key" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "qbo_realm_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "qbo_company_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "qbo_access_token" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "qbo_refresh_token" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "qbo_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "qbo_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_status" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "feature_preferences" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stakeholder_emails" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_demo" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitter_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_role" text DEFAULT 'filer';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "affiliate_payout_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "affiliate_commission_rate" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_preferences" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_office_id_secretariat_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."secretariat_offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_feedback" ADD CONSTRAINT "cancellation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_employee_record_id_employees_id_fk" FOREIGN KEY ("employee_record_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_seeker_profiles" ADD CONSTRAINT "job_seeker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lcs_cert_applications" ADD CONSTRAINT "lcs_cert_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lcs_cert_applications" ADD CONSTRAINT "lcs_cert_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lcs_employment_notices" ADD CONSTRAINT "lcs_employment_notices_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lcs_opportunities" ADD CONSTRAINT "lcs_opportunities_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_log" ADD CONSTRAINT "payment_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_log" ADD CONSTRAINT "payment_log_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_log" ADD CONSTRAINT "payment_log_imported_to_period_id_reporting_periods_id_fk" FOREIGN KEY ("imported_to_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_posting_id_job_postings_id_fk" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_lcs_job_id_lcs_employment_notices_id_fk" FOREIGN KEY ("lcs_job_id") REFERENCES "public"."lcs_employment_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_opportunity_id_lcs_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."lcs_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secretariat_members" ADD CONSTRAINT "secretariat_members_office_id_secretariat_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."secretariat_offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secretariat_members" ADD CONSTRAINT "secretariat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secretariat_offices" ADD CONSTRAINT "secretariat_offices_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_acknowledgments" ADD CONSTRAINT "submission_acknowledgments_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_acknowledgments" ADD CONSTRAINT "submission_acknowledgments_office_id_secretariat_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."secretariat_offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_acknowledgments" ADD CONSTRAINT "submission_acknowledgments_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_supplier_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_opportunity_id_lcs_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."lcs_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_secretariat_office_id_secretariat_offices_id_fk" FOREIGN KEY ("secretariat_office_id") REFERENCES "public"."secretariat_offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_training_config" ADD CONSTRAINT "tenant_training_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_training_config" ADD CONSTRAINT "tenant_training_config_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amendment_period_idx" ON "amendment_requests" USING btree ("reporting_period_id");--> statement-breakpoint
CREATE INDEX "amendment_status_idx" ON "amendment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_period_idx" ON "audit_logs" USING btree ("reporting_period_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_user_idx" ON "chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_msg_conv_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "company_profiles_slug_idx" ON "company_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "company_profiles_name_idx" ON "company_profiles" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "company_profiles_claimed_idx" ON "company_profiles" USING btree ("claimed");--> statement-breakpoint
CREATE INDEX "employees_tenant_idx" ON "employees" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "employees_entity_idx" ON "employees" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "news_published_idx" ON "industry_news" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_source_idx" ON "industry_news" USING btree ("source_name");--> statement-breakpoint
CREATE INDEX "news_category_idx" ON "industry_news" USING btree ("category");--> statement-breakpoint
CREATE INDEX "job_applications_posting_idx" ON "job_applications" USING btree ("job_posting_id");--> statement-breakpoint
CREATE INDEX "job_applications_email_idx" ON "job_applications" USING btree ("applicant_email");--> statement-breakpoint
CREATE INDEX "job_applications_user_idx" ON "job_applications" USING btree ("applicant_user_id");--> statement-breakpoint
CREATE INDEX "job_postings_tenant_idx" ON "job_postings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "job_postings_status_idx" ON "job_postings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_seeker_user_idx" ON "job_seeker_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_seeker_category_idx" ON "job_seeker_profiles" USING btree ("employment_category");--> statement-breakpoint
CREATE INDEX "lcs_app_user_idx" ON "lcs_cert_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lcs_app_status_idx" ON "lcs_cert_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lcs_app_tier_idx" ON "lcs_cert_applications" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "lcs_contractors_name_idx" ON "lcs_contractors" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "lcs_contractors_status_idx" ON "lcs_contractors" USING btree ("outreach_status");--> statement-breakpoint
CREATE INDEX "lcs_emp_company_idx" ON "lcs_employment_notices" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "lcs_emp_status_idx" ON "lcs_employment_notices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lcs_emp_category_idx" ON "lcs_employment_notices" USING btree ("employment_category");--> statement-breakpoint
CREATE INDEX "lcs_emp_closing_idx" ON "lcs_employment_notices" USING btree ("closing_date");--> statement-breakpoint
CREATE INDEX "lcs_opp_type_idx" ON "lcs_opportunities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "lcs_opp_status_idx" ON "lcs_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lcs_opp_contractor_idx" ON "lcs_opportunities" USING btree ("contractor_name");--> statement-breakpoint
CREATE INDEX "lcs_opp_category_idx" ON "lcs_opportunities" USING btree ("lca_category");--> statement-breakpoint
CREATE INDEX "lcs_opp_deadline_idx" ON "lcs_opportunities" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "lcs_cert_id_idx" ON "lcs_register" USING btree ("cert_id");--> statement-breakpoint
CREATE INDEX "lcs_legal_name_idx" ON "lcs_register" USING btree ("legal_name");--> statement-breakpoint
CREATE INDEX "lcs_status_idx" ON "lcs_register" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "payment_log_tenant_idx" ON "payment_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_log_imported_idx" ON "payment_log" USING btree ("imported");--> statement-breakpoint
CREATE INDEX "saved_jobs_user_idx" ON "saved_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_opp_tenant_idx" ON "saved_opportunities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sec_members_office_idx" ON "secretariat_members" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "sec_members_user_idx" ON "secretariat_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ack_period_idx" ON "submission_acknowledgments" USING btree ("reporting_period_id");--> statement-breakpoint
CREATE INDEX "ack_office_idx" ON "submission_acknowledgments" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "supplier_profile_user_idx" ON "supplier_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "supplier_profile_cert_idx" ON "supplier_profiles" USING btree ("lcs_cert_id");--> statement-breakpoint
CREATE INDEX "supplier_profile_tier_idx" ON "supplier_profiles" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "supplier_response_supplier_idx" ON "supplier_responses" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_response_opp_idx" ON "supplier_responses" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "suppliers_tenant_idx" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_replies_ticket_idx" ON "ticket_replies" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "usage_tenant_idx" ON "usage_tracking" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_idx" ON "user_course_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_progress_course_idx" ON "user_course_progress" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "user_events_tenant_event_idx" ON "user_events" USING btree ("tenant_id","event_name");--> statement-breakpoint
CREATE INDEX "user_events_user_time_idx" ON "user_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_prepared_by_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_attested_by_users_id_fk" FOREIGN KEY ("attested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "periods_status_idx" ON "reporting_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "periods_due_date_idx" ON "reporting_periods" USING btree ("due_date");--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "activity_type";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "activity_name";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "provider_name";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "provider_type";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "participant_count";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "guyanese_participant_count";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "end_date";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "total_hours";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "cost_local";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "cost_usd";--> statement-breakpoint
ALTER TABLE "capacity_development_records" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "isco_08_code";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "position_type";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "is_guyanese";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "nationality";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "headcount";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "remuneration_band";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "total_remuneration_local";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "total_remuneration_usd";--> statement-breakpoint
ALTER TABLE "employment_records" DROP COLUMN "contract_type";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "sector_category_id";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "supplier_lcs_cert_id";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "is_guyanese_supplier";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "is_sole_sourced";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "amount_local";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "amount_usd";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "currency_code";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "contract_date";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "payment_date";--> statement-breakpoint
ALTER TABLE "expenditure_records" DROP COLUMN "description";