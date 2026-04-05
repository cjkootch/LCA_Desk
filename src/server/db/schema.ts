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
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("periods_entity_idx").on(table.entityId),
    index("periods_tenant_idx").on(table.tenantId),
  ]
);

// ─── EXPENDITURE RECORDS ──────────────────────────────────────────
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
    sectorCategoryId: uuid("sector_category_id").references(
      () => sectorCategories.id
    ),
    supplierName: text("supplier_name").notNull(),
    supplierLcsCertId: text("supplier_lcs_cert_id"),
    isGuyaneseSupplier: boolean("is_guyanese_supplier").default(false),
    isSoleSourced: boolean("is_sole_sourced").default(false),
    soleSourceCode: text("sole_source_code"),
    amountLocal: numeric("amount_local").notNull(),
    amountUsd: numeric("amount_usd"),
    currencyCode: text("currency_code").default("GYD"),
    paymentMethod: text("payment_method"),
    contractDate: date("contract_date"),
    paymentDate: date("payment_date"),
    description: text("description"),
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
    jobTitle: text("job_title").notNull(),
    isco08Code: text("isco_08_code"),
    positionType: text("position_type").notNull(),
    isGuyanese: boolean("is_guyanese").notNull(),
    nationality: text("nationality"),
    headcount: integer("headcount").notNull().default(1),
    remunerationBand: text("remuneration_band"),
    totalRemunerationLocal: numeric("total_remuneration_local"),
    totalRemunerationUsd: numeric("total_remuneration_usd"),
    contractType: text("contract_type"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("employment_period_idx").on(table.reportingPeriodId),
    index("employment_tenant_idx").on(table.tenantId),
  ]
);

// ─── CAPACITY DEVELOPMENT ─────────────────────────────────────────
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
    activityType: text("activity_type").notNull(),
    activityName: text("activity_name").notNull(),
    providerName: text("provider_name"),
    providerType: text("provider_type"),
    participantCount: integer("participant_count").default(0),
    guyanaeseParticipantCount: integer("guyanese_participant_count").default(0),
    startDate: date("start_date"),
    endDate: date("end_date"),
    totalHours: numeric("total_hours"),
    costLocal: numeric("cost_local"),
    costUsd: numeric("cost_usd"),
    description: text("description"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("capacity_period_idx").on(table.reportingPeriodId),
    index("capacity_tenant_idx").on(table.tenantId),
  ]
);

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
    sectorCategory: one(sectorCategories, {
      fields: [expenditureRecords.sectorCategoryId],
      references: [sectorCategories.id],
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
