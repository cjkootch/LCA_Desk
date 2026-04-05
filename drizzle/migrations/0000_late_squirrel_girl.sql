CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "capacity_development_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"activity_name" text NOT NULL,
	"provider_name" text,
	"provider_type" text,
	"participant_count" integer DEFAULT 0,
	"guyanese_participant_count" integer DEFAULT 0,
	"start_date" date,
	"end_date" date,
	"total_hours" numeric,
	"cost_local" numeric,
	"cost_usd" numeric,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_title" text NOT NULL,
	"isco_08_code" text,
	"position_type" text NOT NULL,
	"is_guyanese" boolean NOT NULL,
	"nationality" text,
	"headcount" integer DEFAULT 1 NOT NULL,
	"remuneration_band" text,
	"total_remuneration_local" numeric,
	"total_remuneration_usd" numeric,
	"contract_type" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction_id" uuid,
	"legal_name" text NOT NULL,
	"trading_name" text,
	"registration_number" text,
	"lcs_certificate_id" text,
	"lcs_certificate_expiry" date,
	"petroleum_agreement_ref" text,
	"company_type" text,
	"guyanese_ownership_pct" numeric,
	"registered_address" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entity_coventurers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ownership_pct" numeric,
	"is_guyanese" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenditure_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sector_category_id" uuid,
	"supplier_name" text NOT NULL,
	"supplier_lcs_cert_id" text,
	"is_guyanese_supplier" boolean DEFAULT false,
	"is_sole_sourced" boolean DEFAULT false,
	"sole_source_code" text,
	"amount_local" numeric NOT NULL,
	"amount_usd" numeric,
	"currency_code" text DEFAULT 'GYD',
	"payment_method" text,
	"contract_date" date,
	"payment_date" date,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"regulatory_body" text,
	"regulatory_body_short" text,
	"submission_email" text,
	"submission_email_subject_format" text,
	"currency_code" text DEFAULT 'USD',
	"local_currency_code" text,
	"active" boolean DEFAULT false,
	"phase" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "jurisdictions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "narrative_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"section" text NOT NULL,
	"prompt_version" text,
	"model_used" text,
	"draft_content" text NOT NULL,
	"is_approved" boolean DEFAULT false,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reporting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction_id" uuid,
	"report_type" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"due_date" date NOT NULL,
	"fiscal_year" integer,
	"status" text DEFAULT 'not_started',
	"submitted_at" timestamp,
	"acknowledged_at" timestamp,
	"secretariat_ref" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sector_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_local_content_pct" numeric,
	"reserved" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"sort_order" integer,
	CONSTRAINT "sector_cat_jurisdiction_code" UNIQUE("jurisdiction_id","code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "submission_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporting_period_id" uuid,
	"entity_id" uuid,
	"tenant_id" uuid,
	"submitted_by" uuid,
	"submission_method" text DEFAULT 'email',
	"submitted_to_email" text,
	"email_subject" text,
	"status" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_members_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"jurisdiction_id" uuid,
	"plan" text DEFAULT 'starter',
	"plan_entity_limit" integer DEFAULT 1,
	"active" boolean DEFAULT true,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD CONSTRAINT "capacity_development_records_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD CONSTRAINT "capacity_development_records_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_development_records" ADD CONSTRAINT "capacity_development_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_coventurers" ADD CONSTRAINT "entity_coventurers_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD CONSTRAINT "expenditure_records_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD CONSTRAINT "expenditure_records_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD CONSTRAINT "expenditure_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenditure_records" ADD CONSTRAINT "expenditure_records_sector_category_id_sector_categories_id_fk" FOREIGN KEY ("sector_category_id") REFERENCES "public"."sector_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_drafts" ADD CONSTRAINT "narrative_drafts_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_drafts" ADD CONSTRAINT "narrative_drafts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_drafts" ADD CONSTRAINT "narrative_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_drafts" ADD CONSTRAINT "narrative_drafts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sector_categories" ADD CONSTRAINT "sector_categories_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_logs" ADD CONSTRAINT "submission_logs_reporting_period_id_reporting_periods_id_fk" FOREIGN KEY ("reporting_period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_logs" ADD CONSTRAINT "submission_logs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_logs" ADD CONSTRAINT "submission_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_logs" ADD CONSTRAINT "submission_logs_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_period_idx" ON "capacity_development_records" USING btree ("reporting_period_id");--> statement-breakpoint
CREATE INDEX "capacity_tenant_idx" ON "capacity_development_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "employment_period_idx" ON "employment_records" USING btree ("reporting_period_id");--> statement-breakpoint
CREATE INDEX "employment_tenant_idx" ON "employment_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "entities_tenant_idx" ON "entities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "expenditure_period_idx" ON "expenditure_records" USING btree ("reporting_period_id");--> statement-breakpoint
CREATE INDEX "expenditure_tenant_idx" ON "expenditure_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "periods_entity_idx" ON "reporting_periods" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "periods_tenant_idx" ON "reporting_periods" USING btree ("tenant_id");