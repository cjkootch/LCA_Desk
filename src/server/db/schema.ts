import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── JURISDICTIONS ───────────────────────────────────────────────
export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  fullName: text("full_name"),
  regulatoryBody: text("regulatory_body"),
  regulatoryBodyShort: text("regulatory_body_short"),
  submissionEmail: text("submission_email"),
  submissionEmailSubjectFormat: text("submission_email_subject_format"),
  currencyCode: text("currency_code").default("USD"),
  localCurrencyCode: text("local_currency_code"),
  active: boolean("active").default(false),
  phase: integer("phase").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SECTOR CATEGORIES ───────────────────────────────────────────
export const sectorCategories = pgTable(
  "sector_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    minLocalContentPct: numeric("min_local_content_pct"),
    reserved: boolean("reserved").default(false),
    active: boolean("active").default(true),
    sortOrder: integer("sort_order"),
  },
  (table) => [unique("sector_cat_jurisdiction_code").on(table.jurisdictionId, table.code)]
);

// ─── USERS (NextAuth) ─────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  passwordHash: text("password_hash"),
  isSuperAdmin: boolean("is_super_admin").default(false),
  userRole: text("user_role").default("filer"), // filer | job_seeker | supplier | comma-separated for multi-role
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NextAuth required tables — property names must match adapter expectations
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [unique("accounts_provider_unique").on(table.provider, table.providerAccountId)]
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").unique().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").unique().notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ─── TENANTS ──────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  plan: text("plan").default("starter"),
  planEntityLimit: integer("plan_entity_limit").default(1),
  active: boolean("active").default(true),
  trialEndsAt: timestamp("trial_ends_at"),
  // QuickBooks Online integration
  qboRealmId: text("qbo_realm_id"),
  qboCompanyName: text("qbo_company_name"),
  qboAccessToken: text("qbo_access_token"),
  qboRefreshToken: text("qbo_refresh_token"),
  qboTokenExpiresAt: timestamp("qbo_token_expires_at"),
  qboConnectedAt: timestamp("qbo_connected_at"),
  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── TENANT MEMBERS ───────────────────────────────────────────────
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [unique("tenant_members_unique").on(table.tenantId, table.userId)]
);

// ─── ENTITIES ─────────────────────────────────────────────────────
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
    legalName: text("legal_name").notNull(),
    tradingName: text("trading_name"),
    registrationNumber: text("registration_number"),
    lcsCertificateId: text("lcs_certificate_id"),
    lcsCertificateExpiry: date("lcs_certificate_expiry"),
    petroleumAgreementRef: text("petroleum_agreement_ref"),
    companyType: text("company_type"),
    guyanaeseOwnershipPct: numeric("guyanese_ownership_pct"),
    registeredAddress: text("registered_address"),
    tinNumber: text("tin_number"),
    dateOfIncorporation: date("date_of_incorporation"),
    industrySector: text("industry_sector"),
    numberOfEmployees: integer("number_of_employees"),
    annualRevenueRange: text("annual_revenue_range"),
    operationalAddress: text("operational_address"),
    parentCompanyName: text("parent_company_name"),
    countryOfIncorporation: text("country_of_incorporation"),
    website: text("website"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    authorizedRepName: text("authorized_rep_name"),
    authorizedRepDesignation: text("authorized_rep_designation"),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("entities_tenant_idx").on(table.tenantId)]
);

// ─── CO-VENTURERS ─────────────────────────────────────────────────
export const entityCoventurers = pgTable("entity_coventurers", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ownershipPct: numeric("ownership_pct"),
  isGuyanese: boolean("is_guyanese").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SUPPLIER DIRECTORY ──────────────────────────────────────────
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    certificateId: text("certificate_id"),
    soleSourceCode: text("sole_source_code"),
    bankName: text("bank_name"),
    bankCountry: text("bank_country"),
    defaultSector: text("default_sector"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("suppliers_tenant_idx").on(table.tenantId)]
);

// ─── EMPLOYEE ROSTER ─────────────────────────────────────────────
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title").notNull(),
    employmentCategory: text("employment_category").notNull(), // Managerial | Technical | Non-Technical
    employmentClassification: text("employment_classification"), // ISCO-08
    isGuyanese: boolean("is_guyanese").default(true),
    nationality: text("nationality"),
    contractType: text("contract_type"), // permanent | contract | temporary
    startDate: date("start_date"),
    active: boolean("active").default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("employees_tenant_idx").on(table.tenantId),
    index("employees_entity_idx").on(table.entityId),
  ]
);

// ─── REPORTING PERIODS ────────────────────────────────────────────
export const reportingPeriods = pgTable(
  "reporting_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
    reportType: text("report_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    dueDate: date("due_date").notNull(),
    fiscalYear: integer("fiscal_year"),
    status: text("status").default("not_started"),
    submittedAt: timestamp("submitted_at"),
    acknowledgedAt: timestamp("acknowledged_at"),
    secretariatRef: text("secretariat_ref"),
    notes: text("notes"),
    // Submission workflow
    preparedBy: uuid("prepared_by").references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    preparedAt: timestamp("prepared_at"),
    reviewedAt: timestamp("reviewed_at"),
    approvedAt: timestamp("approved_at"),
    attestation: text("attestation"), // "I certify..." text
    attestedBy: uuid("attested_by").references(() => users.id),
    attestedAt: timestamp("attested_at"),
    lockedAt: timestamp("locked_at"), // read-only after submission
    snapshotData: text("snapshot_data"), // JSON snapshot at submission time
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("periods_entity_idx").on(table.entityId),
    index("periods_tenant_idx").on(table.tenantId),
  ]
);

// ─── EXPENDITURE RECORDS ──────────────────────────────────────────
// Matches LCS Template v4.0 Expenditure tab: 13 columns
export const expenditureRecords = pgTable(
  "expenditure_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportingPeriodId: uuid("reporting_period_id")
      .notNull()
      .references(() => reportingPeriods.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Template columns (in order)
    typeOfItemProcured: text("type_of_item_procured").notNull(),
    relatedSector: text("related_sector"),            // from Related Sector dropdown
    descriptionOfGoodService: text("description_of_good_service"),
    supplierName: text("supplier_name").notNull(),
    soleSourceCode: text("sole_source_code"),
    supplierCertificateId: text("supplier_certificate_id"),
    actualPayment: numeric("actual_payment").notNull(), // "Actual Payments made during reporting period"
    outstandingPayment: numeric("outstanding_payment"),
    projectionNextPeriod: numeric("projection_next_period"),
    paymentMethod: text("payment_method"),
    supplierBank: text("supplier_bank"),               // "Supplier's (Recipient's) Bank"
    bankLocationCountry: text("bank_location_country"), // "Location of Bank (Country)"
    currencyOfPayment: text("currency_of_payment").default("GYD"),
    // Internal fields (not in template but useful)
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("expenditure_period_idx").on(table.reportingPeriodId),
    index("expenditure_tenant_idx").on(table.tenantId),
  ]
);

// ─── EMPLOYMENT RECORDS ───────────────────────────────────────────
// Matches LCS Template v4.0 Employment tab: 8 columns
export const employmentRecords = pgTable(
  "employment_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportingPeriodId: uuid("reporting_period_id")
      .notNull()
      .references(() => reportingPeriods.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Template columns (in order)
    jobTitle: text("job_title").notNull(),
    employmentCategory: text("employment_category").notNull(), // Managerial | Technical | Non-Technical
    employmentClassification: text("employment_classification"), // ISCO-08 code
    relatedCompany: text("related_company"),
    totalEmployees: integer("total_employees").notNull().default(1),
    guyanaeseEmployed: integer("guyanese_employed").notNull().default(0),
    totalRemunerationPaid: numeric("total_remuneration_paid"),
    remunerationGuyanaeseOnly: numeric("remuneration_guyanese_only"),
    // Internal fields
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("employment_period_idx").on(table.reportingPeriodId),
    index("employment_tenant_idx").on(table.tenantId),
  ]
);

// ─── CAPACITY DEVELOPMENT ─────────────────────────────────────────
// Matches LCS Template v4.0 Capacity Development tab: 9 columns
export const capacityDevelopmentRecords = pgTable(
  "capacity_development_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportingPeriodId: uuid("reporting_period_id")
      .notNull()
      .references(() => reportingPeriods.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Template columns (in order)
    activity: text("activity").notNull(),
    category: text("category"),
    participantType: text("participant_type"),  // 10 specific enum values from template
    guyanaeseParticipantsOnly: integer("guyanese_participants_only").default(0),
    totalParticipants: integer("total_participants").default(0),
    startDate: date("start_date"),
    durationDays: integer("duration_days"),     // "Duration of Activity (# of Days)"
    costToParticipants: numeric("cost_to_participants"),
    expenditureOnCapacity: numeric("expenditure_on_capacity"), // "Expenditure on Capacity Building"
    // Internal fields
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("capacity_period_idx").on(table.reportingPeriodId),
    index("capacity_tenant_idx").on(table.tenantId),
  ]
);

// ─── NOTIFICATIONS ───────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // deadline_warning | deadline_overdue | cert_expiring | report_submitted | team_invite | plan_limit
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"), // URL to navigate to on click
    read: boolean("read").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_read_idx").on(table.userId, table.read),
  ]
);

// ─── LCS SUPPLIER REGISTER ───────────────────────────────────────
// Local copy of Guyana's public Local Content Register
// Populated by the scraper script, used for supplier cert ID verification
export const lcsRegister = pgTable(
  "lcs_register",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    certId: text("cert_id").unique(),
    profileSlug: text("profile_slug").unique().notNull(),
    profileUrl: text("profile_url"),
    legalName: text("legal_name").notNull(),
    tradingName: text("trading_name"),
    status: text("status"),
    expirationDate: date("expiration_date"),
    address: text("address"),
    email: text("email"),
    website: text("website"),
    phone: text("phone"),
    serviceCategories: text("service_categories").array(),
    scrapedAt: timestamp("scraped_at").defaultNow(),
    scrapeError: text("scrape_error"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lcs_cert_id_idx").on(table.certId),
    index("lcs_legal_name_idx").on(table.legalName),
    index("lcs_status_idx").on(table.status),
  ]
);

// ─── LCS CONTRACTORS (Filing Client Prospects) ───────────────────
// Companies that post procurement notices on the LCS opportunities board.
// These are confirmed LCA filing clients — not suppliers.
export const lcsContractors = pgTable(
  "lcs_contractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    profileSlug: text("profile_slug").unique(),
    confirmedFiler: boolean("confirmed_filer").default(true),
    noticeCount: integer("notice_count").default(0),
    lastNoticedAt: date("last_noticed_at"),
    procurementCategories: text("procurement_categories").array(),
    sampleNotices: text("sample_notices").array(),
    outreachStatus: text("outreach_status").default("not_contacted"),
    scrapedAt: timestamp("scraped_at").defaultNow(),
    scrapeError: text("scrape_error"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lcs_contractors_name_idx").on(table.companyName),
    index("lcs_contractors_status_idx").on(table.outreachStatus),
  ]
);

// ─── LCS OPPORTUNITIES (Individual Notices) ──────────────────────
export const lcsOpportunities = pgTable(
  "lcs_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractorName: text("contractor_name").notNull(),
    contractorSlug: text("contractor_slug"),
    type: text("type").notNull(),
    noticeType: text("notice_type"),
    title: text("title").notNull(),
    description: text("description"),
    lcaCategory: text("lca_category"),
    employmentCategory: text("employment_category"),
    postedDate: date("posted_date"),
    deadline: date("deadline"),
    sourceUrl: text("source_url"),
    sourceSlug: text("source_slug").unique(),
    attachmentUrl: text("attachment_url"),
    attachmentContent: text("attachment_content"), // extracted PDF text
    aiSummary: text("ai_summary"), // JSON structured summary from Claude
    status: text("status").default("active"),
    scrapedAt: timestamp("scraped_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lcs_opp_type_idx").on(table.type),
    index("lcs_opp_status_idx").on(table.status),
    index("lcs_opp_contractor_idx").on(table.contractorName),
    index("lcs_opp_category_idx").on(table.lcaCategory),
    index("lcs_opp_deadline_idx").on(table.deadline),
  ]
);

// ─── SAVED OPPORTUNITIES ─────────────────────────────────────────
export const savedOpportunities = pgTable(
  "saved_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").notNull().references(() => lcsOpportunities.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("saved_opp_unique").on(table.userId, table.opportunityId),
    index("saved_opp_tenant_idx").on(table.tenantId),
  ]
);

// ─── JOB POSTINGS ────────────────────────────────────────────────
export const jobPostings = pgTable(
  "job_postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id),
    jobTitle: text("job_title").notNull(),
    employmentCategory: text("employment_category").notNull(),
    employmentClassification: text("employment_classification"),
    contractType: text("contract_type").notNull(),
    location: text("location"),
    description: text("description"),
    qualifications: text("qualifications"),
    vacancyCount: integer("vacancy_count").default(1),
    applicationDeadline: date("application_deadline"),
    startDate: date("start_date"),
    status: text("status").default("open"),
    isPublic: boolean("is_public").default(true),
    guyaneseFirstStatement: text("guyanese_first_statement"),
    guyaneseHired: boolean("guyanese_hired"),
    filledAt: timestamp("filled_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("job_postings_tenant_idx").on(table.tenantId),
    index("job_postings_status_idx").on(table.status),
  ]
);

// ─── JOB APPLICATIONS ────────────────────────────────────────────
export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
    applicantUserId: uuid("applicant_user_id").references(() => users.id, { onDelete: "set null" }),
    applicantName: text("applicant_name").notNull(),
    applicantEmail: text("applicant_email").notNull(),
    applicantPhone: text("applicant_phone"),
    isGuyanese: boolean("is_guyanese").default(true),
    nationality: text("nationality"),
    employmentCategory: text("employment_category"),
    employmentClassification: text("employment_classification"),
    coverNote: text("cover_note"),
    cvUrl: text("cv_url"),
    status: text("status").default("received"),
    reviewNotes: text("review_notes"),
    employeeRecordId: uuid("employee_record_id").references(() => employees.id, { onDelete: "set null" }),
    hiredAt: timestamp("hired_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("job_applications_posting_idx").on(table.jobPostingId),
    index("job_applications_email_idx").on(table.applicantEmail),
    index("job_applications_user_idx").on(table.applicantUserId),
  ]
);

// ─── JOB SEEKER PROFILES (linked to unified users table) ─────────
export const jobSeekerProfiles = pgTable(
  "job_seeker_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    currentJobTitle: text("current_job_title"),
    employmentCategory: text("employment_category"),
    employmentClassification: text("employment_classification"),
    yearsExperience: integer("years_experience"),
    isGuyanese: boolean("is_guyanese").default(true),
    nationality: text("nationality").default("Guyanese"),
    cvUrl: text("cv_url"),
    skills: text("skills").array(),
    locationPreference: text("location_preference").default("Any"),
    contractTypePreference: text("contract_type_preference"),
    alertsEnabled: boolean("alerts_enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("job_seeker_user_idx").on(table.userId),
    index("job_seeker_category_idx").on(table.employmentCategory),
  ]
);

// ─── SUPPLIER PROFILES (linked to unified users table) ───────────
export const supplierProfiles = pgTable(
  "supplier_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    lcsCertId: text("lcs_cert_id"),
    lcsVerified: boolean("lcs_verified").default(false),
    lcsStatus: text("lcs_status"),
    lcsExpirationDate: date("lcs_expiration_date"),
    lcsVerifiedAt: timestamp("lcs_verified_at"),
    legalName: text("legal_name"),
    tradingName: text("trading_name"),
    address: text("address"),
    website: text("website"),
    serviceCategories: text("service_categories").array(),
    tier: text("tier").default("free"),
    featuredUntil: timestamp("featured_until"),
    profileVisible: boolean("profile_visible").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("supplier_profile_user_idx").on(table.userId),
    index("supplier_profile_cert_idx").on(table.lcsCertId),
  ]
);

// ─── USAGE TRACKING ──────────────────────────────────────────────
export const usageTracking = pgTable(
  "usage_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(), // "2026-04" format
    aiDraftsUsed: integer("ai_drafts_used").default(0),
    aiChatMessagesUsed: integer("ai_chat_messages_used").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("usage_tenant_month").on(table.tenantId, table.periodMonth),
    index("usage_tenant_idx").on(table.tenantId),
  ]
);

// ─── AI CHAT CONVERSATIONS ───────────────────────────────────────
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("chat_user_idx").on(table.userId)]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("chat_msg_conv_idx").on(table.conversationId)]
);

export const chatConversationsRelations = relations(
  chatConversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [chatConversations.userId],
      references: [users.id],
    }),
    messages: many(chatMessages),
  })
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

// ─── AI NARRATIVE DRAFTS ──────────────────────────────────────────
export const narrativeDrafts = pgTable("narrative_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportingPeriodId: uuid("reporting_period_id")
    .notNull()
    .references(() => reportingPeriods.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  section: text("section").notNull(),
  promptVersion: text("prompt_version"),
  modelUsed: text("model_used"),
  draftContent: text("draft_content").notNull(),
  isApproved: boolean("is_approved").default(false),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SUBMISSION LOG ───────────────────────────────────────────────
export const submissionLogs = pgTable("submission_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportingPeriodId: uuid("reporting_period_id").references(
    () => reportingPeriods.id
  ),
  entityId: uuid("entity_id").references(() => entities.id),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  submittedBy: uuid("submitted_by").references(() => users.id),
  submissionMethod: text("submission_method").default("email"),
  submittedToEmail: text("submitted_to_email"),
  emailSubject: text("email_subject"),
  status: text("status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── AUDIT LOG ──────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    action: text("action").notNull(), // create, update, delete, submit, approve, attest, lock
    entityType: text("entity_type").notNull(), // expenditure_record, employment_record, reporting_period, etc.
    entityId: text("entity_id").notNull(), // ID of the affected record
    reportingPeriodId: uuid("reporting_period_id").references(() => reportingPeriods.id, { onDelete: "set null" }),
    fieldName: text("field_name"), // which field changed (null for create/delete)
    oldValue: text("old_value"),
    newValue: text("new_value"),
    metadata: text("metadata"), // JSON for extra context
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("audit_tenant_idx").on(table.tenantId),
    index("audit_period_idx").on(table.reportingPeriodId),
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_user_idx").on(table.userId),
    index("audit_created_idx").on(table.createdAt),
  ]
);

// ─── RELATIONS ────────────────────────────────────────────────────
export const jurisdictionsRelations = relations(jurisdictions, ({ many }) => ({
  sectorCategories: many(sectorCategories),
  tenants: many(tenants),
  entities: many(entities),
}));

export const sectorCategoriesRelations = relations(
  sectorCategories,
  ({ one }) => ({
    jurisdiction: one(jurisdictions, {
      fields: [sectorCategories.jurisdictionId],
      references: [jurisdictions.id],
    }),
  })
);

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  members: many(tenantMembers),
  entities: many(entities),
  jurisdiction: one(jurisdictions, {
    fields: [tenants.jurisdictionId],
    references: [jurisdictions.id],
  }),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [entities.tenantId],
    references: [tenants.id],
  }),
  jurisdiction: one(jurisdictions, {
    fields: [entities.jurisdictionId],
    references: [jurisdictions.id],
  }),
  coventurers: many(entityCoventurers),
  reportingPeriods: many(reportingPeriods),
}));

export const entityCoventurersRelations = relations(
  entityCoventurers,
  ({ one }) => ({
    entity: one(entities, {
      fields: [entityCoventurers.entityId],
      references: [entities.id],
    }),
  })
);

export const reportingPeriodsRelations = relations(
  reportingPeriods,
  ({ one, many }) => ({
    entity: one(entities, {
      fields: [reportingPeriods.entityId],
      references: [entities.id],
    }),
    tenant: one(tenants, {
      fields: [reportingPeriods.tenantId],
      references: [tenants.id],
    }),
    expenditures: many(expenditureRecords),
    employment: many(employmentRecords),
    capacity: many(capacityDevelopmentRecords),
    narratives: many(narrativeDrafts),
  })
);

export const expenditureRecordsRelations = relations(
  expenditureRecords,
  ({ one }) => ({
    reportingPeriod: one(reportingPeriods, {
      fields: [expenditureRecords.reportingPeriodId],
      references: [reportingPeriods.id],
    }),
    entity: one(entities, {
      fields: [expenditureRecords.entityId],
      references: [entities.id],
    }),
  })
);

export const employmentRecordsRelations = relations(
  employmentRecords,
  ({ one }) => ({
    reportingPeriod: one(reportingPeriods, {
      fields: [employmentRecords.reportingPeriodId],
      references: [reportingPeriods.id],
    }),
    entity: one(entities, {
      fields: [employmentRecords.entityId],
      references: [entities.id],
    }),
  })
);

export const capacityDevelopmentRecordsRelations = relations(
  capacityDevelopmentRecords,
  ({ one }) => ({
    reportingPeriod: one(reportingPeriods, {
      fields: [capacityDevelopmentRecords.reportingPeriodId],
      references: [reportingPeriods.id],
    }),
    entity: one(entities, {
      fields: [capacityDevelopmentRecords.entityId],
      references: [entities.id],
    }),
  })
);

export const narrativeDraftsRelations = relations(
  narrativeDrafts,
  ({ one }) => ({
    reportingPeriod: one(reportingPeriods, {
      fields: [narrativeDrafts.reportingPeriodId],
      references: [reportingPeriods.id],
    }),
    entity: one(entities, {
      fields: [narrativeDrafts.entityId],
      references: [entities.id],
    }),
  })
);
