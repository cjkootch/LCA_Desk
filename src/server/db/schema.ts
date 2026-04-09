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
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  websiteUrl: text("website_url"),
  passwordHash: text("password_hash"),
  isSuperAdmin: boolean("is_super_admin").default(false),
  userRole: text("user_role").default("filer"),
  notificationPreferences: text("notification_preferences"),
  lastLoginAt: timestamp("last_login_at"),
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
  plan: text("plan").default("lite"),
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
  stripeSubscriptionStatus: text("stripe_subscription_status"), // active | past_due | unpaid | canceled | trialing
  // Feature preferences (JSON)
  featurePreferences: text("feature_preferences"),
  stakeholderEmails: text("stakeholder_emails"), // JSON: [{ email, name, role }] for deadline escalation
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
    index("periods_status_idx").on(table.status),
    index("periods_due_date_idx").on(table.dueDate),
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
    supplierType: text("supplier_type"), // "Guyanese" | "Non-Guyanese" — required by V4 template
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
    type: text("type").notNull(), // deadline_warning | deadline_overdue | cert_expiring | report_submitted | team_invite | plan_limit | application_received | application_status | welcome
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    read: boolean("read").default(false),
    emailSent: boolean("email_sent").default(false),
    emailSentAt: timestamp("email_sent_at"),
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
    pageContent: text("page_content"),
    aiSummary: text("ai_summary"),
    country: text("country").default("GY"),
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

// ─── COMPANY PROFILES (Unified, auto-generated + claimable) ─────
export const companyProfiles = pgTable(
  "company_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").unique().notNull(),
    companyName: text("company_name").notNull(),
    legalName: text("legal_name"),
    logoUrl: text("logo_url"),
    website: text("website"),
    description: text("description"),
    industry: text("industry").default("Oil & Gas"),
    companySize: text("company_size"), // e.g. "500-1000", "10,000+"
    headquarters: text("headquarters"),
    guyanaOffice: text("guyana_office"),
    // Aggregated stats (auto-calculated)
    totalOpportunities: integer("total_opportunities").default(0),
    activeOpportunities: integer("active_opportunities").default(0),
    totalJobPostings: integer("total_job_postings").default(0),
    openJobPostings: integer("open_job_postings").default(0),
    // Contact info (aggregated from scrapes)
    contactEmails: text("contact_emails"), // JSON array
    contactPhones: text("contact_phones"), // JSON array
    contactNames: text("contact_names"), // JSON array
    // Categories
    procurementCategories: text("procurement_categories").array(),
    employmentCategories: text("employment_categories").array(),
    // Claim status
    claimed: boolean("claimed").default(false),
    claimedBy: uuid("claimed_by").references(() => users.id),
    claimedAt: timestamp("claimed_at"),
    tenantId: uuid("tenant_id").references(() => tenants.id), // linked to filing tenant once claimed
    verified: boolean("verified").default(false),
    verifiedAt: timestamp("verified_at"),
    verificationMethod: text("verification_method"), // email_domain | lcs_cert | manual
    verificationNotes: text("verification_notes"),
    // LCS register link
    lcsCertId: text("lcs_cert_id"),
    lcsRegistered: boolean("lcs_registered").default(false),
    lcsStatus: text("lcs_status"), // Active | Expired
    lcsExpirationDate: date("lcs_expiration_date"),
    // Contact from LCS register
    lcsEmail: text("lcs_email"),
    lcsPhone: text("lcs_phone"),
    lcsAddress: text("lcs_address"),
    lcsServiceCategories: text("lcs_service_categories").array(),
    // Data sources
    dataSource: text("data_source").default("scraped"), // scraped | claimed | manual
    lastAggregatedAt: timestamp("last_aggregated_at"),
    country: text("country").default("GY"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("company_profiles_slug_idx").on(table.slug),
    index("company_profiles_name_idx").on(table.companyName),
    index("company_profiles_claimed_idx").on(table.claimed),
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
    country: text("country").default("GY"),
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
    attachmentUrl: text("attachment_url"), // primary PDF
    attachmentUrls: text("attachment_urls"), // JSON array of all attachment URLs
    attachmentContent: text("attachment_content"), // extracted PDF text (legacy)
    aiSummary: text("ai_summary"), // JSON structured summary from Claude
    status: text("status").default("active"),
    pinned: boolean("pinned").default(false),
    secretariatNote: text("secretariat_note"),
    moderatedBy: uuid("moderated_by").references(() => users.id),
    moderatedAt: timestamp("moderated_at"),
    country: text("country").default("GY"),
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

// ─── LCS EMPLOYMENT NOTICES (Scraped Job Postings) ──────────────
export const lcsEmploymentNotices = pgTable(
  "lcs_employment_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    companySlug: text("company_slug"),
    jobTitle: text("job_title").notNull(),
    employmentCategory: text("employment_category"), // Technical | Management | Administrative | Skilled Labour | etc.
    noticeType: text("notice_type"), // Vacancy | Internship | Training Program
    description: text("description"),
    qualifications: text("qualifications"),
    location: text("location"),
    closingDate: date("closing_date"),
    postedDate: date("posted_date"),
    sourceUrl: text("source_url"),
    sourceSlug: text("source_slug").unique(),
    attachmentUrl: text("attachment_url"),
    attachmentUrls: text("attachment_urls"), // JSON array
    pageContent: text("page_content"), // full page text for AI
    aiSummary: text("ai_summary"), // JSON structured summary
    status: text("status").default("open"), // open | closed
    pinned: boolean("pinned").default(false),
    secretariatNote: text("secretariat_note"),
    moderatedBy: uuid("moderated_by").references(() => users.id),
    moderatedAt: timestamp("moderated_at"),
    country: text("country").default("GY"),
    scrapedAt: timestamp("scraped_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lcs_emp_company_idx").on(table.companyName),
    index("lcs_emp_status_idx").on(table.status),
    index("lcs_emp_category_idx").on(table.employmentCategory),
    index("lcs_emp_closing_idx").on(table.closingDate),
  ]
);

// ─── INDUSTRY NEWS ──────────────────────────────────────────────
export const industryNews = pgTable(
  "industry_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    summary: text("summary"),
    aiSummary: text("ai_summary"),
    sourceUrl: text("source_url").notNull().unique(),
    sourceName: text("source_name").notNull(), // "Kaieteur News" | "OilNOW"
    imageUrl: text("image_url"),
    publishedAt: date("published_at"),
    category: text("category"), // "contracts" | "policy" | "production" | "local_content" | "general"
    relevanceScore: integer("relevance_score"), // 1-10, AI-assigned
    companies: text("companies").array(), // companies mentioned
    country: text("country").default("GY"),
    scrapedAt: timestamp("scraped_at").defaultNow(),
  },
  (table) => [
    index("news_published_idx").on(table.publishedAt),
    index("news_source_idx").on(table.sourceName),
    index("news_category_idx").on(table.category),
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

// ─── SAVED JOBS ─────────────────────────────────────────────────
export const savedJobs = pgTable(
  "saved_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    jobPostingId: uuid("job_posting_id").references(() => jobPostings.id, { onDelete: "cascade" }),
    lcsJobId: uuid("lcs_job_id").references(() => lcsEmploymentNotices.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull().default("posted"), // "posted" | "lcs"
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("saved_jobs_user_idx").on(table.userId),
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
    country: text("country").default("GY"),
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
    country: text("country").default("GY"),
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
    guyaneseStatus: text("guyanese_status"), // citizen | permanent_resident | work_permit | non_resident
    nationality: text("nationality").default("Guyanese"),
    nationalIdNumber: text("national_id_number"), // for employer verification (not scanned)
    // LCA compliance fields
    iscoCode: text("isco_code"), // ISCO-08 classification code
    educationLevel: text("education_level"), // secondary | diploma | bachelors | masters | doctorate | trade_cert
    educationField: text("education_field"), // e.g. "Mechanical Engineering"
    certifications: text("certifications").array(), // NEBOSH, BOSIET, HUET, H2S, etc.
    workPermitStatus: text("work_permit_status"), // valid | expired | not_required | pending
    lcsCertId: text("lcs_cert_id"), // if seeker is also a registered supplier
    // Attestation
    lcaAttestationDate: timestamp("lca_attestation_date"), // when they attested their status
    lcaAttestationText: text("lca_attestation_text"), // stored attestation
    cvUrl: text("cv_url"),
    resumeContent: text("resume_content"), // full resume text from builder
    skills: text("skills").array(),
    locationPreference: text("location_preference").default("Any"),
    contractTypePreference: text("contract_type_preference"),
    alertsEnabled: boolean("alerts_enabled").default(true),
    profileVisible: boolean("profile_visible").default(false), // opt-in to talent pool
    headline: text("headline"), // short pitch: "Mechanical Engineer with 5yrs offshore experience"
    country: text("country").default("GY"),
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
    capabilityStatement: text("capability_statement"),
    portfolio: text("portfolio"), // JSON array of { title, description, value }
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    employeeCount: integer("employee_count"),
    yearEstablished: integer("year_established"),
    isGuyaneseOwned: boolean("is_guyanese_owned").default(true),
    // Billing
    tier: text("tier").default("starter"), // starter | pro
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    trialEndsAt: timestamp("trial_ends_at"),
    // Engagement
    profileViews: integer("profile_views").default(0),
    responsesThisMonth: integer("responses_this_month").default(0),
    responsesResetAt: timestamp("responses_reset_at"),
    featuredUntil: timestamp("featured_until"),
    profileVisible: boolean("profile_visible").default(true),
    country: text("country").default("GY"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("supplier_profile_user_idx").on(table.userId),
    index("supplier_profile_cert_idx").on(table.lcsCertId),
    index("supplier_profile_tier_idx").on(table.tier),
  ]
);

// ─── SUPPLIER OPPORTUNITY RESPONSES ─────────────────────────────
export const supplierResponses = pgTable(
  "supplier_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id").notNull().references(() => supplierProfiles.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").notNull().references(() => lcsOpportunities.id, { onDelete: "cascade" }),
    status: text("status").default("interested"), // interested | contacted | shortlisted | awarded | not_selected
    coverNote: text("cover_note"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("supplier_response_unique").on(table.supplierId, table.opportunityId),
    index("supplier_response_supplier_idx").on(table.supplierId),
    index("supplier_response_opp_idx").on(table.opportunityId),
  ]
);

// ─── USAGE TRACKING ──────────────────────────────────────────────

// ─── LCS CERTIFICATE APPLICATIONS ───────────────────────────────
export const lcsCertApplications = pgTable(
  "lcs_cert_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    applicationType: text("application_type").notNull().default("individual"), // individual | business
    tier: text("tier").notNull().default("self_service"), // self_service ($49) | managed ($99) | concierge ($199)
    status: text("status").notNull().default("draft"), // draft | documents_pending | under_review | submitted_to_lcs | approved | rejected
    // Step 1: Personal / Business Info
    applicantName: text("applicant_name"),
    applicantEmail: text("applicant_email"),
    applicantPhone: text("applicant_phone"),
    nationalIdNumber: text("national_id_number"),
    tinNumber: text("tin_number"), // Tax Identification Number
    // Business-specific
    legalName: text("legal_name"),
    tradingName: text("trading_name"),
    businessRegistrationNumber: text("business_registration_number"),
    businessAddress: text("business_address"),
    businessEmail: text("business_email"),
    businessPhone: text("business_phone"),
    businessWebsite: text("business_website"),
    yearEstablished: integer("year_established"),
    employeeCount: integer("employee_count"),
    isGuyaneseOwned: boolean("is_guyanese_owned").default(true),
    ownershipPercentage: integer("ownership_percentage"), // % Guyanese ownership
    // Step 2: Service Categories
    serviceCategories: text("service_categories").array(),
    serviceDescription: text("service_description"),
    // Step 3: Documents (JSON array of { name, key, uploadedAt })
    documents: text("documents"), // JSON
    documentsComplete: boolean("documents_complete").default(false),
    // Step 4: Review & Payment
    stripePaymentId: text("stripe_payment_id"),
    amountPaid: integer("amount_paid"), // cents
    paidAt: timestamp("paid_at"),
    // Processing
    reviewNotes: text("review_notes"), // internal notes from reviewer
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    submittedToLcsAt: timestamp("submitted_to_lcs_at"),
    lcsCertId: text("lcs_cert_id"), // assigned after LCS approval
    // Metadata
    completedStep: integer("completed_step").default(0), // 0-4 wizard progress
    country: text("country").default("GY"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("lcs_app_user_idx").on(table.userId),
    index("lcs_app_status_idx").on(table.status),
    index("lcs_app_tier_idx").on(table.tier),
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
  submissionMethod: text("submission_method").default("email"), // email | platform | upload
  submittedToEmail: text("submitted_to_email"),
  emailSubject: text("email_subject"),
  uploadedFileName: text("uploaded_file_name"),
  uploadedFileKey: text("uploaded_file_key"), // storage key for retrieval
  status: text("status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SECRETARIAT OFFICES ─────────────────────────────────────────
export const secretariatOffices = pgTable(
  "secretariat_offices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
    country: text("country").default("GY"),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  }
);

export const secretariatMembers = pgTable(
  "secretariat_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id").notNull().references(() => secretariatOffices.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("reviewer"), // admin | reviewer | viewer
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("sec_members_office_idx").on(table.officeId),
    index("sec_members_user_idx").on(table.userId),
  ]
);

export const submissionAcknowledgments = pgTable(
  "submission_acknowledgments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportingPeriodId: uuid("reporting_period_id").notNull().references(() => reportingPeriods.id),
    officeId: uuid("office_id").notNull().references(() => secretariatOffices.id),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
    status: text("status").default("received"), // received | under_review | approved | rejected | amendment_required
    notes: text("notes"),
    referenceNumber: text("reference_number"),
    acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("ack_period_idx").on(table.reportingPeriodId),
    index("ack_office_idx").on(table.officeId),
  ]
);

// ─── AMENDMENT REQUESTS ──────────────────────────────────────────
export const amendmentRequests = pgTable(
  "amendment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportingPeriodId: uuid("reporting_period_id").notNull().references(() => reportingPeriods.id),
    officeId: uuid("office_id").notNull().references(() => secretariatOffices.id),
    requestedBy: uuid("requested_by").references(() => users.id),
    // What needs to change
    items: text("items").notNull(), // JSON: [{ section, recordId?, description, severity }]
    summary: text("summary").notNull(),
    responseDeadline: date("response_deadline"),
    // Status tracking
    status: text("status").default("pending"), // pending | responded | accepted | escalated
    filerResponse: text("filer_response"),
    respondedAt: timestamp("responded_at"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("amendment_period_idx").on(table.reportingPeriodId),
    index("amendment_status_idx").on(table.status),
  ]
);

// ─── LEARNING / TRAINING ────────────────────────────────────────
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").unique().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    audience: text("audience").notNull(), // seeker | filer | all
    jurisdictionCode: text("jurisdiction_code"), // null = all jurisdictions, "GY" = Guyana only, "NG" = Nigeria only
    moduleCount: integer("module_count").default(0),
    badgeLabel: text("badge_label"), // e.g. "LCA Certified"
    badgeColor: text("badge_color").default("accent"), // accent | gold | success
    estimatedMinutes: integer("estimated_minutes"),
    mandatory: boolean("mandatory").default(false), // admin can toggle
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  }
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(), // markdown
    quizQuestions: text("quiz_questions"), // JSON array of { question, options[], correctIndex }
    passingScore: integer("passing_score").default(80), // percent
  }
);

export const userCourseProgress = pgTable(
  "user_course_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => courseModules.id),
    status: text("status").default("not_started"), // not_started | in_progress | completed
    quizScore: integer("quiz_score"),
    completedAt: timestamp("completed_at"),
    badgeEarnedAt: timestamp("badge_earned_at"), // set when all modules complete
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("user_progress_user_idx").on(table.userId),
    index("user_progress_course_idx").on(table.courseId),
  ]
);

// ─── TENANT TRAINING CONFIG ─────────────────────────────────────
export const tenantTrainingConfig = pgTable(
  "tenant_training_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    mandatory: boolean("mandatory").default(false),
    requiredForRoles: text("required_for_roles"), // JSON: ["member", "owner"] or null for all
    createdAt: timestamp("created_at").defaultNow(),
  }
);

// ─── PAYMENT LOG (Lightweight procurement tracker) ──────────────
export const paymentLog = pgTable(
  "payment_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id),
    supplierName: text("supplier_name").notNull(),
    supplierType: text("supplier_type"), // "Guyanese" | "Non-Guyanese"
    supplierCertificateId: text("supplier_certificate_id"),
    amount: text("amount").notNull(),
    currency: text("currency").default("GYD"),
    description: text("description"),
    category: text("category"), // LCA sector category
    paymentDate: date("payment_date"),
    invoiceRef: text("invoice_ref"),
    imported: boolean("imported").default(false), // true when pulled into a formal filing period
    importedToPeriodId: uuid("imported_to_period_id").references(() => reportingPeriods.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("payment_log_tenant_idx").on(table.tenantId),
    index("payment_log_imported_idx").on(table.imported),
  ]
);

// ─── SUPPORT TICKETS ────────────────────────────────────────────
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    category: text("category").default("general"), // general | bug | feature | billing | filing
    priority: text("priority").default("normal"), // low | normal | high | urgent
    status: text("status").default("open"), // open | in_progress | resolved | closed
    screenshotUrls: text("screenshot_urls"), // JSON array of URLs
    pageUrl: text("page_url"), // which page the user was on
    userAgent: text("user_agent"),
    adminNotes: text("admin_notes"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("support_tickets_user_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
  ]
);

export const ticketReplies = pgTable(
  "ticket_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isAdmin: boolean("is_admin").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("ticket_replies_ticket_idx").on(table.ticketId),
  ]
);

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

// ─── CANCELLATION FEEDBACK ─────────────────────────────────────
export const cancellationFeedback = pgTable("cancellation_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  userRole: text("user_role"),
  plan: text("plan"),
  reason: text("reason").notNull(),
  reasonDetail: text("reason_detail"),
  feedback: text("feedback"),
  actionTaken: text("action_taken"), // canceled_plan | deleted_account
  savedByOffer: boolean("saved_by_offer").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
