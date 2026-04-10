"use server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import {
  chatConversations,
  chatMessages,
  usageTracking,
  entities,
  reportingPeriods,
  expenditureRecords,
  employmentRecords,
  capacityDevelopmentRecords,
  narrativeDrafts,
  submissionLogs,
  tenants,
  tenantMembers,
  sectorCategories,
  suppliers,
  employees,
  notifications,
  jobPostings,
  jobApplications,
  lcsOpportunities,
  savedOpportunities,
  jobSeekerProfiles,
  supplierProfiles,
  jurisdictions,
  users,
  auditLogs,
  supportTickets,
  ticketReplies,
  companyProfiles,
  lcsEmploymentNotices,
  lcsRegister,
  paymentLog,
  courses,
  courseModules,
  userCourseProgress,
  secretariatMembers,
  secretariatOffices,
  submissionAcknowledgments,
  amendmentRequests,
  supplierResponses,
  lcsCertApplications,
  savedJobs,
  industryNews,
  cancellationFeedback,
  announcements,
  teamInvites,
  referrals,
} from "@/server/db/schema";
import { eq, and, gte, lte, or, sql, desc, asc, isNull, type InferInsertModel } from "drizzle-orm";
import { getPlan, getEffectivePlan, isInTrial, isTrialExpired, getTrialDaysRemaining, getBillingAccess } from "@/lib/plans";
import { entitySchema, type EntityInput, type ExpenditureInput, type EmploymentInput, type CapacityInput } from "@/server/schemas";
import { trackEvent } from "@/lib/analytics";
import {
  notifyApplicationReceived as unifiedNotifyAppReceived,
  notifyApplicationStatus as unifiedNotifyAppStatus,
  notifyReportSubmitted as unifiedNotifyReportSubmit,
  notifyTeamInvite as unifiedNotifyTeamInvite,
  fetchNotificationPreferences as fetchNotifPrefs,
  updateNotificationPreferences as updateNotifPrefs,
} from "@/lib/email/unified-notify";

async function getSessionTenant(opts?: { skipTrialCheck?: boolean }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: { with: { jurisdiction: true } } },
  });

  if (!membership) throw new Error("No tenant found");

  // After trial expires without payment, users get read-only Essentials.
  // No hard lockout at the action level — the layout handles the interstitial.

  return {
    userId: session.user.id,
    tenantId: membership.tenantId,
    tenant: membership.tenant,
    role: membership.role,
    plan: (membership.tenant.plan as string) || "lite",
    trialEndsAt: membership.tenant.trialEndsAt ?? null,
    stripeSubscriptionId: membership.tenant.stripeSubscriptionId ?? null,
    stripeSubscriptionStatus: membership.tenant.stripeSubscriptionStatus ?? null,
  };
}

function requirePlan(plan: string, required: "lite" | "pro" | "enterprise", trialEndsAt?: Date | null) {
  const effective = getEffectivePlan(plan, trialEndsAt);
  const rank: Record<string, number> = { lite: 0, starter: 0, pro: 1, enterprise: 2 };
  if ((rank[effective.code] ?? 0) < rank[required]) {
    const planNames: Record<string, string> = { lite: "Essentials", pro: "Professional", enterprise: "Enterprise" };
    throw new Error(`This feature requires the ${planNames[required] || required} plan. Upgrade in Settings > Billing.`);
  }
}

// ─── AUDIT LOGGING ───────────────────────────────────────────────

async function logAudit(params: {
  tenantId: string;
  userId: string;
  userName?: string;
  action: "create" | "update" | "delete" | "submit" | "approve" | "review" | "attest" | "lock" | "reopen";
  entityType: string;
  entityId: string;
  reportingPeriodId?: string | null;
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      reportingPeriodId: params.reportingPeriodId || null,
      fieldName: params.fieldName || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch {
    // Audit logging should never break the main operation
    console.error("Audit log failed:", params.action, params.entityType, params.entityId);
  }
}

export async function fetchAuditLog(periodId?: string, limit = 50) {
  const { tenantId } = await getSessionTenant();
  const conditions = [eq(auditLogs.tenantId, tenantId)];
  if (periodId) conditions.push(eq(auditLogs.reportingPeriodId, periodId));

  return db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(auditLogs.createdAt)
    .limit(limit);
}

// ─── ENTITIES ─────────────────────────────────────────────────────
export async function fetchEntities() {
  const { tenantId } = await getSessionTenant();
  return db.query.entities.findMany({
    where: and(eq(entities.tenantId, tenantId), eq(entities.active, true)),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
  });
}

export async function fetchEntity(entityId: string) {
  const { tenantId } = await getSessionTenant();
  return db.query.entities.findFirst({
    where: and(eq(entities.id, entityId), eq(entities.tenantId, tenantId)),
    with: { coventurers: true },
  });
}

function mapEntityData(data: Record<string, unknown>) {
  return {
    legalName: data.legal_name as string,
    tradingName: (data.trading_name as string) || null,
    registrationNumber: (data.registration_number as string) || null,
    lcsCertificateId: (data.lcs_certificate_id as string) || null,
    lcsCertificateExpiry: (data.lcs_certificate_expiry as string) || null,
    petroleumAgreementRef: (data.petroleum_agreement_ref as string) || null,
    companyType: (data.company_type as string) || null,
    guyanaeseOwnershipPct: data.guyanese_ownership_pct ? String(data.guyanese_ownership_pct) : null,
    registeredAddress: (data.registered_address as string) || null,
    tinNumber: (data.tin_number as string) || null,
    dateOfIncorporation: (data.date_of_incorporation as string) || null,
    industrySector: (data.industry_sector as string) || null,
    numberOfEmployees: data.number_of_employees ? Number(data.number_of_employees) : null,
    annualRevenueRange: (data.annual_revenue_range as string) || null,
    operationalAddress: (data.operational_address as string) || null,
    parentCompanyName: (data.parent_company_name as string) || null,
    countryOfIncorporation: (data.country_of_incorporation as string) || null,
    website: (data.website as string) || null,
    contactName: (data.contact_name as string) || null,
    contactEmail: (data.contact_email as string) || null,
    contactPhone: (data.contact_phone as string) || null,
    authorizedRepName: (data.authorized_rep_name as string) || null,
    authorizedRepDesignation: (data.authorized_rep_designation as string) || null,
  };
}

// DB insert shape aliases derived from the Drizzle schema (used to type values() objects)
type EntityInsert = InferInsertModel<typeof entities>;
type ExpenditureInsert = InferInsertModel<typeof expenditureRecords>;
type EmploymentInsert = InferInsertModel<typeof employmentRecords>;
type CapacityInsert = InferInsertModel<typeof capacityDevelopmentRecords>;

export async function addEntity(data: EntityInput & Record<string, unknown>) {
  const validated = entitySchema.safeParse(data);
  if (!validated.success) throw new Error(`Invalid entity data: ${validated.error.issues.map(i => i.message).join(", ")}`);
  const { tenantId, userId, tenant, plan } = await getSessionTenant();
  // Check entity limit
  const existing = await db.select({ id: entities.id }).from(entities).where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)));
  const limit = getPlan(plan).entityLimit;
  if (limit !== -1 && existing.length >= limit) {
    throw new Error(`Entity limit reached (${limit}). Upgrade your plan to add more entities.`);
  }
  const [entity] = await db
    .insert(entities)
    .values({
      tenantId,
      jurisdictionId: tenant.jurisdictionId,
      ...mapEntityData(data),
    })
    .returning();

  // Analytics: entity_created — look up jurisdiction code for the property
  await (async () => {
    try {
      const [jur] = await db.select({ code: jurisdictions.code })
        .from(jurisdictions)
        .where(eq(jurisdictions.id, tenant.jurisdictionId!))
        .limit(1);
      await trackEvent(userId, tenantId, "entity_created", {
        entityType: String(data.company_type || "unknown"),
        jurisdictionCode: jur?.code || "GY",
      });
    } catch {}
  })();

  return entity;
}

export async function updateEntity(entityId: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(entities)
    .set({
      ...mapEntityData(data),
      updatedAt: new Date(),
    })
    .where(and(eq(entities.id, entityId), eq(entities.tenantId, tenantId)))
    .returning();
  return updated;
}

// ─── REPORTING PERIODS ────────────────────────────────────────────
export async function fetchPeriodsForEntity(entityId: string) {
  const { tenantId } = await getSessionTenant();
  return db.query.reportingPeriods.findMany({
    where: and(
      eq(reportingPeriods.entityId, entityId),
      eq(reportingPeriods.tenantId, tenantId)
    ),
    orderBy: (p, { desc }) => [desc(p.periodStart)],
  });
}

export async function fetchPeriod(periodId: string) {
  const { tenantId } = await getSessionTenant();
  return db.query.reportingPeriods.findFirst({
    where: and(
      eq(reportingPeriods.id, periodId),
      eq(reportingPeriods.tenantId, tenantId)
    ),
  });
}

export async function addPeriod(data: {
  entity_id: string;
  jurisdiction_id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  due_date: string;
  fiscal_year: number;
}) {
  const { tenantId } = await getSessionTenant();

  // Validate jurisdiction is configured before creating period
  const jCode = await getEntityJurisdictionCode(data.entity_id);
  try {
    const { assertJurisdictionReady } = await import("@/lib/compliance/validate-jurisdictions");
    assertJurisdictionReady(jCode);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Jurisdiction not configured");
  }

  const [period] = await db
    .insert(reportingPeriods)
    .values({
      entityId: data.entity_id,
      tenantId,
      jurisdictionId: data.jurisdiction_id,
      reportType: data.report_type,
      periodStart: data.period_start,
      periodEnd: data.period_end,
      dueDate: data.due_date,
      fiscalYear: data.fiscal_year,
      status: "not_started",
    })
    .returning();
  return period;
}

// ─── SUBMISSION WORKFLOW ──────────────────────────────────────────
// Status flow: not_started → in_progress → in_review → approved → submitted
// After submission: locked (read-only)

export async function updatePeriodStatus(periodId: string, newStatus: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);

  const [current] = await db
    .select()
    .from(reportingPeriods)
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .limit(1);
  if (!current) throw new Error("Period not found");

  const oldStatus = current.status || "not_started";

  // Validate state transitions
  const validTransitions: Record<string, string[]> = {
    not_started: ["in_progress"],
    in_progress: ["in_review", "approved"],
    in_review: ["approved", "in_progress"],
    approved: ["submitted"],
    submitted: [],
    acknowledged: [],
  };
  if (validTransitions[oldStatus] && !validTransitions[oldStatus].includes(newStatus)) {
    throw new Error(`Cannot transition from "${oldStatus}" to "${newStatus}".`);
  }

  // Build update fields based on new status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { status: newStatus, updatedAt: new Date() };

  if (newStatus === "in_review") {
    updates.preparedBy = userId;
    updates.preparedAt = new Date();
  } else if (newStatus === "approved") {
    updates.reviewedBy = userId;
    updates.reviewedAt = new Date();
  }

  const [updated] = await db
    .update(reportingPeriods)
    .set(updates)
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .returning();

  await logAudit({
    tenantId, userId, userName: user?.name || undefined,
    action: newStatus === "approved" ? "approve" : newStatus === "in_review" ? "review" : "update",
    entityType: "reporting_period", entityId: periodId,
    reportingPeriodId: periodId,
    fieldName: "status", oldValue: oldStatus, newValue: newStatus,
  });

  return updated;
}

export async function attestAndSubmit(periodId: string, attestationText: string, submissionMethod: "platform" | "email" = "email") {
  const { tenantId, userId } = await getSessionTenant();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [current] = await db
    .select()
    .from(reportingPeriods)
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .limit(1);
  if (!current) throw new Error("Period not found");

  // Bug #5 fix: prevent double-submission race condition
  if (current.status === "submitted" || current.lockedAt) {
    throw new Error("This period has already been submitted.");
  }

  // Create data snapshot at time of submission
  let expenditures, employment, capacity, narratives;
  try {
    [expenditures, employment, capacity, narratives] = await Promise.all([
      db.select().from(expenditureRecords).where(eq(expenditureRecords.reportingPeriodId, periodId)),
      db.select().from(employmentRecords).where(eq(employmentRecords.reportingPeriodId, periodId)),
      db.select().from(capacityDevelopmentRecords).where(eq(capacityDevelopmentRecords.reportingPeriodId, periodId)),
      db.select().from(narrativeDrafts).where(eq(narrativeDrafts.reportingPeriodId, periodId)),
    ]);
  } catch (err) {
    throw new Error("Failed to create data snapshot. Submission aborted — no data was changed.");
  }

  const snapshot = JSON.stringify({
    submittedAt: new Date().toISOString(),
    submittedBy: { id: userId, name: user.name },
    attestation: attestationText,
    recordCounts: {
      expenditures: expenditures.length,
      employment: employment.length,
      capacity: capacity.length,
      narratives: narratives.length,
    },
    expenditures,
    employment,
    capacity,
    narratives,
  });

  const now = new Date();
  const [updated] = await db
    .update(reportingPeriods)
    .set({
      status: "submitted",
      submittedAt: now,
      attestation: attestationText,
      attestedBy: userId,
      attestedAt: now,
      approvedBy: current.approvedBy || userId,
      approvedAt: current.approvedAt || now,
      lockedAt: now,
      snapshotData: snapshot,
      updatedAt: now,
    })
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .returning();

  // Create submission log
  const jCode = await getEntityJurisdictionCode(current.entityId);
  const { getJurisdictionTemplate } = await import("@/lib/compliance/jurisdiction-config");
  const jTemplate = getJurisdictionTemplate(jCode);
  await db.insert(submissionLogs).values({
    reportingPeriodId: periodId,
    entityId: current.entityId,
    tenantId,
    submittedBy: userId,
    submissionMethod,
    submittedToEmail: submissionMethod === "platform" ? "LCA Desk Platform" : (jTemplate.submissionEmail || "localcontent@nre.gov.gy"),
    status: submissionMethod === "platform" ? "delivered" : "sent",
  });

  await logAudit({
    tenantId, userId, userName: user?.name || undefined,
    action: "submit", entityType: "reporting_period", entityId: periodId,
    reportingPeriodId: periodId,
    fieldName: "status", oldValue: current.status || "not_started", newValue: "submitted",
    metadata: { attestation: attestationText, recordCounts: { expenditures: expenditures.length, employment: employment.length, capacity: capacity.length } },
  });

  await logAudit({
    tenantId, userId, userName: user?.name || undefined,
    action: "lock", entityType: "reporting_period", entityId: periodId,
    reportingPeriodId: periodId,
    newValue: "Report locked after submission",
  });

  // Send confirmation (in-app + email)
  const [entityForEmail] = await db.select({ legalName: entities.legalName }).from(entities).where(eq(entities.id, current.entityId)).limit(1);
  const reportTypeNames: Record<string, string> = { half_yearly_h1: "Half-Yearly (H1)", half_yearly_h2: "Half-Yearly (H2)", annual_plan: "Annual Plan", performance_report: "Performance Report" };
  unifiedNotifyReportSubmit({
    userId,
    tenantId,
    userName: user?.name || "User",
    entityName: entityForEmail?.legalName || "",
    reportType: reportTypeNames[current.reportType] || current.reportType,
    periodLabel: `${current.periodStart} to ${current.periodEnd}`,
    recordCounts: { expenditures: expenditures.length, employment: employment.length, capacity: capacity.length },
  });

  // Auto-create next reporting period
  try {
    const nextTypeMap: Record<string, string> = {
      half_yearly_h1: "half_yearly_h2",
      half_yearly_h2: "half_yearly_h1",
    };
    const nextType = nextTypeMap[current.reportType];
    if (nextType) {
      const nextYear = nextType === "half_yearly_h1" ? (current.fiscalYear || new Date().getFullYear()) + 1 : current.fiscalYear || new Date().getFullYear();
      const { calculateDeadlines } = await import("@/lib/compliance/deadlines");
      const jCode = await getEntityJurisdictionCode(current.entityId);
      const deadlines = calculateDeadlines(jCode, nextYear);
      const nextDeadline = deadlines.find(d => d.type === nextType);
      if (nextDeadline) {
        // Check if it already exists
        const existing = await db.select({ id: reportingPeriods.id }).from(reportingPeriods)
          .where(and(
            eq(reportingPeriods.entityId, current.entityId),
            eq(reportingPeriods.reportType, nextType),
            eq(reportingPeriods.fiscalYear, nextYear),
          )).limit(1);
        if (existing.length === 0) {
          await db.insert(reportingPeriods).values({
            entityId: current.entityId,
            tenantId,
            jurisdictionId: current.jurisdictionId || null,
            reportType: nextType,
            periodStart: nextDeadline.period_start.toISOString().slice(0, 10),
            periodEnd: nextDeadline.period_end.toISOString().slice(0, 10),
            dueDate: nextDeadline.due_date.toISOString().slice(0, 10),
            fiscalYear: nextYear,
            status: "not_started",
          });
        }
      }
    }
  } catch (nextPeriodErr) {
    console.error("Failed to auto-create next period:", nextPeriodErr);
    // Log to audit trail so admins can see it failed
    try {
      await logAudit({
        tenantId, userId, userName: user.name || undefined,
        action: "create", entityType: "reporting_period", entityId: periodId,
        reportingPeriodId: periodId,
        newValue: "Auto-creation of next period failed — manual creation required",
      });
    } catch {}
  }

  // Qualify referral on first submission
  try { qualifyReferral(userId); } catch {}

  // Analytics: report_submitted
  await trackEvent(userId, tenantId, "report_submitted", {
    daysBeforeDeadline: Math.ceil((new Date(current.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    completenessScore: Math.round(
      ((expenditures.length > 0 ? 1 : 0) +
        (employment.length > 0 ? 1 : 0) +
        (capacity.length > 0 ? 1 : 0) +
        (narratives.length > 0 ? 1 : 0)) * 25
    ),
  });

  return updated;
}

// Upload-based submission for free-tier users
export async function submitWithUpload(periodId: string, attestationText: string, fileKey: string, fileName: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [current] = await db
    .select()
    .from(reportingPeriods)
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .limit(1);
  if (!current) throw new Error("Period not found");

  if (current.status === "submitted" || current.lockedAt) {
    throw new Error("This period has already been submitted.");
  }

  const now = new Date();
  const [updated] = await db
    .update(reportingPeriods)
    .set({
      status: "submitted",
      submittedAt: now,
      attestation: attestationText,
      attestedBy: userId,
      attestedAt: now,
      approvedBy: current.approvedBy || userId,
      approvedAt: current.approvedAt || now,
      lockedAt: now,
      snapshotData: JSON.stringify({
        submittedAt: now.toISOString(),
        submittedBy: { id: userId, name: user.name },
        attestation: attestationText,
        uploadedFile: { key: fileKey, name: fileName },
        submissionMethod: "upload",
      }),
      updatedAt: now,
    })
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .returning();

  // Create submission log with file reference
  await db.insert(submissionLogs).values({
    reportingPeriodId: periodId,
    entityId: current.entityId,
    tenantId,
    submittedBy: userId,
    submissionMethod: "upload",
    submittedToEmail: "LCA Desk Platform",
    uploadedFileName: fileName,
    uploadedFileKey: fileKey,
    status: "delivered",
  });

  await logAudit({
    tenantId, userId, userName: user?.name || undefined,
    action: "submit", entityType: "reporting_period", entityId: periodId,
    reportingPeriodId: periodId,
    fieldName: "status", oldValue: current.status || "not_started", newValue: "submitted",
    metadata: { submissionMethod: "upload", fileName },
  });

  await logAudit({
    tenantId, userId, userName: user?.name || undefined,
    action: "lock", entityType: "reporting_period", entityId: periodId,
    reportingPeriodId: periodId,
    newValue: "Report locked after upload submission",
  });

  // Send confirmation
  const [entityForEmail] = await db.select({ legalName: entities.legalName }).from(entities).where(eq(entities.id, current.entityId)).limit(1);
  const reportTypeNames: Record<string, string> = { half_yearly_h1: "Half-Yearly (H1)", half_yearly_h2: "Half-Yearly (H2)", annual_plan: "Annual Plan", performance_report: "Performance Report" };
  unifiedNotifyReportSubmit({
    userId, tenantId,
    userName: user?.name || "User",
    entityName: entityForEmail?.legalName || "",
    reportType: reportTypeNames[current.reportType] || current.reportType,
    periodLabel: `${current.periodStart} to ${current.periodEnd}`,
    recordCounts: { expenditures: 0, employment: 0, capacity: 0 },
  });

  // Qualify referral on first submission
  try { qualifyReferral(userId); } catch {}

  return updated;
}

// Keep backward compat
export async function markPeriodSubmitted(periodId: string) {
  return attestAndSubmit(periodId, "I certify that the information contained in this report is true and accurate to the best of my knowledge.", "email");
}

export async function checkPeriodLocked(periodId: string): Promise<boolean> {
  const { tenantId } = await getSessionTenant();
  const [period] = await db
    .select({ lockedAt: reportingPeriods.lockedAt, status: reportingPeriods.status })
    .from(reportingPeriods)
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .limit(1);
  return !!(period?.lockedAt || period?.status === "submitted");
}

export async function reopenPeriod(periodId: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);

  const [updated] = await db
    .update(reportingPeriods)
    .set({ status: "in_progress", lockedAt: null, updatedAt: new Date() })
    .where(and(eq(reportingPeriods.id, periodId), eq(reportingPeriods.tenantId, tenantId)))
    .returning();

  await logAudit({
    tenantId, userId, userName: user?.name || undefined,
    action: "reopen", entityType: "reporting_period", entityId: periodId,
    reportingPeriodId: periodId,
    fieldName: "status", oldValue: "submitted", newValue: "in_progress",
    metadata: { reason: "Period reopened for amendments" },
  });

  return updated;
}

// ─── EXPENDITURE ──────────────────────────────────────────────────
export async function fetchExpenditures(periodId: string) {
  const { tenantId } = await getSessionTenant();
  return db
    .select()
    .from(expenditureRecords)
    .where(
      and(
        eq(expenditureRecords.reportingPeriodId, periodId),
        eq(expenditureRecords.tenantId, tenantId)
      )
    )
    .orderBy(expenditureRecords.createdAt);
}

export async function addExpenditure(
  periodId: string,
  entityId: string,
  data: ExpenditureInput & Record<string, unknown>
) {
  // Validate critical fields
  if (!data.supplier_name || typeof data.supplier_name !== "string") throw new Error("Supplier name is required");
  const { tenantId, userId } = await getSessionTenant();

  // Check before insert: is this the tenant's first expenditure?
  const [{ existingCount }] = await db
    .select({ existingCount: sql<number>`cast(count(*) as int)` })
    .from(expenditureRecords)
    .where(eq(expenditureRecords.tenantId, tenantId));
  const isFirstExpenditure = existingCount === 0;

  const [record] = await db
    .insert(expenditureRecords)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      typeOfItemProcured: data.type_of_item_procured as string,
      relatedSector: (data.related_sector as string) || null,
      descriptionOfGoodService: (data.description_of_good_service as string) || null,
      supplierName: data.supplier_name as string,
      supplierType: (data.supplier_type as string) || null,
      soleSourceCode: (data.sole_source_code as string) || null,
      supplierCertificateId: (data.supplier_certificate_id as string) || null,
      actualPayment: String(data.actual_payment),
      outstandingPayment: data.outstanding_payment ? String(data.outstanding_payment) : null,
      projectionNextPeriod: data.projection_next_period ? String(data.projection_next_period) : null,
      paymentMethod: (data.payment_method as string) || null,
      supplierBank: (data.supplier_bank as string) || null,
      bankLocationCountry: (data.bank_location_country as string) || null,
      currencyOfPayment: (data.currency_of_payment as string) || "GYD",
    })
    .returning();
  await logAudit({ tenantId, userId, action: "create", entityType: "expenditure_record", entityId: record.id, reportingPeriodId: periodId, newValue: `${data.supplier_name}: ${data.actual_payment}` });

  if (isFirstExpenditure) {
    await trackEvent(userId, tenantId, "first_expenditure_added", {
      category: String(data.type_of_item_procured || "unknown"),
      amount: Number(data.actual_payment) || 0,
    });
  }

  return record;
}

export async function removeExpenditure(id: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [old] = await db.select().from(expenditureRecords).where(eq(expenditureRecords.id, id)).limit(1);
  await db
    .delete(expenditureRecords)
    .where(
      and(eq(expenditureRecords.id, id), eq(expenditureRecords.tenantId, tenantId))
    );
  if (old) await logAudit({ tenantId, userId, action: "delete", entityType: "expenditure_record", entityId: id, reportingPeriodId: old.reportingPeriodId, oldValue: `${old.supplierName}: ${old.actualPayment}` });
}

export async function updateExpenditure(id: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(expenditureRecords)
    .set({
      typeOfItemProcured: data.type_of_item_procured as string,
      relatedSector: (data.related_sector as string) || null,
      descriptionOfGoodService: (data.description_of_good_service as string) || null,
      supplierName: data.supplier_name as string,
      supplierType: (data.supplier_type as string) || null,
      soleSourceCode: (data.sole_source_code as string) || null,
      supplierCertificateId: (data.supplier_certificate_id as string) || null,
      actualPayment: String(data.actual_payment),
      outstandingPayment: data.outstanding_payment ? String(data.outstanding_payment) : null,
      projectionNextPeriod: data.projection_next_period ? String(data.projection_next_period) : null,
      paymentMethod: (data.payment_method as string) || null,
      supplierBank: (data.supplier_bank as string) || null,
      bankLocationCountry: (data.bank_location_country as string) || null,
      currencyOfPayment: (data.currency_of_payment as string) || "GYD",
      notes: (data.notes as string) || null,
      updatedAt: new Date(),
    })
    .where(and(eq(expenditureRecords.id, id), eq(expenditureRecords.tenantId, tenantId)))
    .returning();
  return updated;
}

// ─── EMPLOYMENT ───────────────────────────────────────────────────
export async function fetchEmployment(periodId: string) {
  const { tenantId } = await getSessionTenant();
  return db
    .select()
    .from(employmentRecords)
    .where(
      and(
        eq(employmentRecords.reportingPeriodId, periodId),
        eq(employmentRecords.tenantId, tenantId)
      )
    )
    .orderBy(employmentRecords.createdAt);
}

export async function addEmployment(
  periodId: string,
  entityId: string,
  data: EmploymentInput & Record<string, unknown>
) {
  if (!data.employment_category || typeof data.employment_category !== "string") throw new Error("Employment category is required");
  const { tenantId, userId } = await getSessionTenant();

  // Check before insert: is this the tenant's first employment record?
  const [{ existingEmpCount }] = await db
    .select({ existingEmpCount: sql<number>`cast(count(*) as int)` })
    .from(employmentRecords)
    .where(eq(employmentRecords.tenantId, tenantId));
  const isFirstEmployment = existingEmpCount === 0;

  const [record] = await db
    .insert(employmentRecords)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      jobTitle: data.job_title as string,
      employmentCategory: data.employment_category as string,
      employmentClassification: (data.employment_classification as string) || null,
      relatedCompany: (data.related_company as string) || null,
      totalEmployees: Number(data.total_employees) || 1,
      guyanaeseEmployed: Number(data.guyanese_employed) || 0,
      totalRemunerationPaid: data.total_remuneration_paid
        ? String(data.total_remuneration_paid)
        : null,
      remunerationGuyanaeseOnly: data.remuneration_guyanese_only
        ? String(data.remuneration_guyanese_only)
        : null,
    })
    .returning();
  await logAudit({ tenantId, userId, action: "create", entityType: "employment_record", entityId: record.id, reportingPeriodId: periodId, newValue: `${data.job_title}: ${data.total_employees} employees` });

  if (isFirstEmployment) {
    await trackEvent(userId, tenantId, "first_employment_added", {
      category: String(data.employment_category),
    });
  }

  return record;
}

export async function removeEmployment(id: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [old] = await db.select().from(employmentRecords).where(eq(employmentRecords.id, id)).limit(1);
  await db
    .delete(employmentRecords)
    .where(
      and(eq(employmentRecords.id, id), eq(employmentRecords.tenantId, tenantId))
    );
  if (old) await logAudit({ tenantId, userId, action: "delete", entityType: "employment_record", entityId: id, reportingPeriodId: old.reportingPeriodId, oldValue: `${old.jobTitle}: ${old.totalEmployees} employees` });
}

export async function updateEmploymentRecord(id: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(employmentRecords)
    .set({
      jobTitle: data.job_title as string,
      employmentCategory: data.employment_category as string,
      employmentClassification: (data.employment_classification as string) || null,
      relatedCompany: (data.related_company as string) || null,
      totalEmployees: Number(data.total_employees) || 1,
      guyanaeseEmployed: Number(data.guyanese_employed) || 0,
      totalRemunerationPaid: data.total_remuneration_paid ? String(data.total_remuneration_paid) : null,
      remunerationGuyanaeseOnly: data.remuneration_guyanese_only ? String(data.remuneration_guyanese_only) : null,
      notes: (data.notes as string) || null,
    })
    .where(and(eq(employmentRecords.id, id), eq(employmentRecords.tenantId, tenantId)))
    .returning();
  return updated;
}

// ─── CAPACITY DEVELOPMENT ─────────────────────────────────────────
export async function fetchCapacity(periodId: string) {
  const { tenantId } = await getSessionTenant();
  return db
    .select()
    .from(capacityDevelopmentRecords)
    .where(
      and(
        eq(capacityDevelopmentRecords.reportingPeriodId, periodId),
        eq(capacityDevelopmentRecords.tenantId, tenantId)
      )
    )
    .orderBy(capacityDevelopmentRecords.createdAt);
}

export async function addCapacity(
  periodId: string,
  entityId: string,
  data: CapacityInput & Record<string, unknown>
) {
  const { tenantId } = await getSessionTenant();
  const [record] = await db
    .insert(capacityDevelopmentRecords)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      activity: data.activity as string,
      category: (data.category as string) || null,
      participantType: (data.participant_type as string) || null,
      guyanaeseParticipantsOnly: Number(data.guyanese_participants_only) || 0,
      totalParticipants: Number(data.total_participants) || 0,
      startDate: (data.start_date as string) || null,
      durationDays: data.duration_days ? Number(data.duration_days) : null,
      costToParticipants: data.cost_to_participants ? String(data.cost_to_participants) : null,
      expenditureOnCapacity: data.expenditure_on_capacity ? String(data.expenditure_on_capacity) : null,
    })
    .returning();
  return record;
}

export async function removeCapacity(id: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [old] = await db.select().from(capacityDevelopmentRecords).where(eq(capacityDevelopmentRecords.id, id)).limit(1);
  await db
    .delete(capacityDevelopmentRecords)
    .where(
      and(
        eq(capacityDevelopmentRecords.id, id),
        eq(capacityDevelopmentRecords.tenantId, tenantId)
      )
    );
  if (old) await logAudit({ tenantId, userId, action: "delete", entityType: "capacity_record", entityId: id, reportingPeriodId: old.reportingPeriodId, oldValue: `${old.activity}: ${old.totalParticipants} participants` });
}

export async function updateCapacityRecord(id: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(capacityDevelopmentRecords)
    .set({
      activity: data.activity as string,
      category: (data.category as string) || null,
      participantType: (data.participant_type as string) || null,
      guyanaeseParticipantsOnly: Number(data.guyanese_participants_only) || 0,
      totalParticipants: Number(data.total_participants) || 0,
      startDate: (data.start_date as string) || null,
      durationDays: data.duration_days ? Number(data.duration_days) : null,
      costToParticipants: data.cost_to_participants ? String(data.cost_to_participants) : null,
      expenditureOnCapacity: data.expenditure_on_capacity ? String(data.expenditure_on_capacity) : null,
      notes: (data.notes as string) || null,
    })
    .where(and(eq(capacityDevelopmentRecords.id, id), eq(capacityDevelopmentRecords.tenantId, tenantId)))
    .returning();
  return updated;
}

// ─── NARRATIVES ───────────────────────────────────────────────────
export async function fetchNarratives(periodId: string) {
  const { tenantId } = await getSessionTenant();
  return db
    .select()
    .from(narrativeDrafts)
    .where(
      and(
        eq(narrativeDrafts.reportingPeriodId, periodId),
        eq(narrativeDrafts.tenantId, tenantId)
      )
    );
}

export async function saveNarrative(
  periodId: string,
  entityId: string,
  section: string,
  content: string
) {
  const { tenantId, userId } = await getSessionTenant();

  const [existing] = await db
    .select()
    .from(narrativeDrafts)
    .where(
      and(
        eq(narrativeDrafts.reportingPeriodId, periodId),
        eq(narrativeDrafts.tenantId, tenantId),
        eq(narrativeDrafts.section, section)
      )
    )
    .limit(1);

  if (existing) {
    const wasEdited = existing.draftContent !== content;
    const [updated] = await db
      .update(narrativeDrafts)
      .set({ draftContent: content, modelUsed: "claude-sonnet-4-6", promptVersion: "v1.0-jurisdiction-aware" })
      .where(eq(narrativeDrafts.id, existing.id))
      .returning();
    await trackEvent(userId, tenantId, "narrative_approved", { section, wasEdited });
    return updated;
  }

  const [created] = await db
    .insert(narrativeDrafts)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      section,
      draftContent: content,
      modelUsed: "claude-sonnet-4-6",
      promptVersion: "v1.0-jurisdiction-aware",
    })
    .returning();
  // First save — treat as approval with no prior draft to compare against
  await trackEvent(userId, tenantId, "narrative_approved", { section, wasEdited: false });
  return created;
}

// ─── SECTOR CATEGORIES ───────────────────────────────────────────
export async function fetchCategories() {
  return db
    .select()
    .from(sectorCategories)
    .where(eq(sectorCategories.active, true))
    .orderBy(sectorCategories.sortOrder);
}

// ─── USER CONTEXT ─────────────────────────────────────────────────
export async function fetchUserContext() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: { with: { jurisdiction: true } } },
  });

  return {
    user: session.user,
    tenant: membership?.tenant ? {
      ...membership.tenant,
      jurisdiction: membership.tenant.jurisdiction?.name || null,
    } : null,
    role: membership?.role || null,
    isSuperAdmin: user?.isSuperAdmin ?? false,
  };
}

export async function checkSuperAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return user?.isSuperAdmin ?? false;
}

// ─── REFERRALS ───────────────────────────────────────────────────
export async function fetchMyReferralInfo() {
  try {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db.select({ referralCode: users.referralCode })
    .from(users).where(eq(users.id, session.user.id)).limit(1);

  if (!user?.referralCode) {
    // Generate one if missing (for users created before referrals existed)
    const userName = session.user.name || "USER";
    const refBase = userName.split(" ")[0].toUpperCase().slice(0, 6);
    let code = "";
    for (let i = 0; i < 5; i++) {
      const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const candidate = `${refBase}-${suffix}`;
      const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, candidate)).limit(1);
      if (!dup) { code = candidate; break; }
    }
    if (!code) code = `${refBase}-${Date.now().toString(36).toUpperCase()}`; // fallback: timestamp-based
    await db.update(users).set({ referralCode: code }).where(eq(users.id, session.user.id));
    return { code, referrals: [], totalReferred: 0, totalSignedUp: 0, totalQualified: 0 };
  }

  const myReferrals = await db.select({
    id: referrals.id,
    referredEmail: referrals.referredEmail,
    status: referrals.status,
    rewardType: referrals.rewardType,
    rewardAmount: referrals.rewardAmount,
    commissionAmount: referrals.commissionAmount,
    commissionPaidAt: referrals.commissionPaidAt,
    convertedPlan: referrals.convertedPlan,
    rewardedAt: referrals.rewardedAt,
    createdAt: referrals.createdAt,
  }).from(referrals)
    .where(eq(referrals.referrerUserId, session.user.id))
    .orderBy(desc(referrals.createdAt))
    .limit(50);

  return {
    code: user.referralCode,
    referrals: myReferrals,
    totalReferred: myReferrals.length,
    totalSignedUp: myReferrals.filter(r => r.status !== "pending").length,
    totalQualified: myReferrals.filter(r => r.status === "qualified" || r.status === "rewarded").length,
  };
  } catch {
    // referral_code column may not exist yet (migration pending)
    return null;
  }
}

export async function updateMyReferralCode(code: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Validate: alphanumeric + hyphens, 3-20 chars
  const clean = code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (clean.length < 3 || clean.length > 20) throw new Error("Code must be 3-20 characters (letters, numbers, hyphens)");

  // Check uniqueness
  const [existing] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.referralCode, clean), sql`${users.id} != ${session.user.id}`)).limit(1);
  if (existing) throw new Error("This code is already taken. Try another.");

  await db.update(users).set({ referralCode: clean }).where(eq(users.id, session.user.id));
  return { code: clean };
}

/** Called when a referred user completes a qualifying action (first report filed, paid subscription) */
export async function qualifyReferral(referredUserId: string) {
  try {
    const [ref] = await db.select().from(referrals)
      .where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.status, "signed_up")))
      .limit(1);
    if (!ref) return; // No pending referral

    const BONUS_DAYS = 14;
    const bonusMs = BONUS_DAYS * 24 * 60 * 60 * 1000;

    // Helper: extend a user's tenant trial by bonus days
    const extendTrial = async (userId: string) => {
      const [membership] = await db.select({ tenantId: tenantMembers.tenantId })
        .from(tenantMembers).where(eq(tenantMembers.userId, userId)).limit(1);
      if (!membership) return;

      const [tenant] = await db.select({ trialEndsAt: tenants.trialEndsAt })
        .from(tenants).where(eq(tenants.id, membership.tenantId)).limit(1);
      if (!tenant) return;

      // If trial exists, extend it. If no trial yet, set one starting now.
      const base = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : new Date();
      const newEnd = new Date(Math.max(base.getTime(), Date.now()) + bonusMs);
      await db.update(tenants).set({ trialEndsAt: newEnd }).where(eq(tenants.id, membership.tenantId));
    };

    // Check if referrer is an affiliate
    const [referrerUser] = await db.select({
      userRole: users.userRole,
      commissionRate: users.affiliateCommissionRate,
    }).from(users).where(eq(users.id, ref.referrerUserId)).limit(1);

    const isAffiliate = referrerUser?.userRole === "affiliate";

    // For regular (non-affiliate) referrers: extend both parties' trials
    if (!isAffiliate) {
      await extendTrial(ref.referrerUserId);
      await extendTrial(referredUserId);
    }
    const commissionRate = referrerUser?.commissionRate || 20; // default 20%

    // Determine reward type based on referrer role
    const rewardUpdate: Record<string, unknown> = {
      status: "rewarded",
      qualifiedAt: new Date(),
      rewardedAt: new Date(),
    };

    if (isAffiliate) {
      // Affiliate: calculate commission based on plan price
      // Default: 20% of monthly plan price
      const planPrices: Record<string, number> = { lite: 199, pro: 499, enterprise: 999 };
      const [referredMembership] = await db.select({ tenantId: tenantMembers.tenantId })
        .from(tenantMembers).where(eq(tenantMembers.userId, referredUserId)).limit(1);
      let planPrice = 199; // default
      if (referredMembership) {
        const [t] = await db.select({ plan: tenants.plan }).from(tenants)
          .where(eq(tenants.id, referredMembership.tenantId)).limit(1);
        if (t?.plan) planPrice = planPrices[t.plan] || 199;
      }
      const commission = (planPrice * commissionRate) / 100;
      rewardUpdate.rewardType = "commission";
      rewardUpdate.rewardAmount = `$${commission.toFixed(2)}`;
      rewardUpdate.commissionAmount = String(commission.toFixed(2));
      // Use actual plan from the referred user's tenant
      let actualPlan = "lite";
      if (referredMembership) {
        const [tp] = await db.select({ plan: tenants.plan }).from(tenants)
          .where(eq(tenants.id, referredMembership.tenantId)).limit(1);
        if (tp?.plan) actualPlan = tp.plan;
      }
      rewardUpdate.convertedPlan = actualPlan;
    } else {
      // Regular user: trial extension
      rewardUpdate.rewardType = "trial_extension";
      rewardUpdate.rewardAmount = `+${BONUS_DAYS} days (both)`;
    }

    await db.update(referrals).set(rewardUpdate).where(eq(referrals.id, ref.id));
  } catch {} // Don't break the calling workflow
}

// ─── PROFILE ──────────────────────────────────────────────────────
export async function updateProfile(data: { name: string; email: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [updated] = await db
    .update(users)
    .set({ name: data.name, email: data.email, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .returning();
  return updated;
}

export async function updatePassword(data: { currentPassword: string; newPassword: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const bcrypt = await import("bcryptjs");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.passwordHash) throw new Error("No password set");

  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const newHash = await bcrypt.hash(data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return { success: true };
}

// ─── TENANT / COMPANY ─────────────────────────────────────────────
export async function updateTenant(data: { name: string }) {
  const { tenantId } = await getSessionTenant();
  const slug = data.name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const [updated] = await db
    .update(tenants)
    .set({ name: data.name, slug })
    .where(eq(tenants.id, tenantId))
    .returning();
  return updated;
}

// ─── TEAM MEMBERS ─────────────────────────────────────────────────
export async function fetchTeamMembers() {
  const { tenantId } = await getSessionTenant();
  return db.query.tenantMembers.findMany({
    where: eq(tenantMembers.tenantId, tenantId),
    with: { user: true },
  });
}

export async function inviteTeamMember(data: { email: string; role: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const { tenantId, tenant, plan } = await getSessionTenant();

  // Check team member limit
  const currentMembers = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.tenantId, tenantId));
  const limit = getPlan(plan).teamMemberLimit;
  if (limit !== -1 && currentMembers.length >= limit) {
    throw new Error(`Team member limit reached (${limit}). Upgrade your plan to add more members.`);
  }

  // Check if user exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existingUser) {
    // User exists — add directly
    const existing = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, existingUser.id)
      ),
    });
    if (existing) throw new Error("This user is already a team member.");

    const [member] = await db
      .insert(tenantMembers)
      .values({ tenantId, userId: existingUser.id, role: data.role })
      .returning();

    // Notify the new member
    const inviterName = session.user.name || "A team admin";
    unifiedNotifyTeamInvite({
      userId: existingUser.id,
      tenantId,
      inviterName,
      companyName: tenant.name,
    }).catch(() => {});

    return member;
  }

  // User doesn't exist — check for existing pending invite
  const existingInvite = await db.select({ id: teamInvites.id }).from(teamInvites)
    .where(and(eq(teamInvites.email, data.email), eq(teamInvites.tenantId, tenantId), eq(teamInvites.status, "pending")))
    .limit(1);
  if (existingInvite.length > 0) throw new Error("An invitation has already been sent to this email.");

  const { randomUUID } = await import("crypto");
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  await db.insert(teamInvites).values({
    email: data.email,
    token,
    tenantId,
    role: data.role,
    invitedBy: session.user.id,
    inviterName: session.user.name || "A team admin",
    expiresAt,
  });

  // Send invite email
  try {
    const { sendEmail } = await import("@/lib/email/client");
    const baseUrl = process.env.NEXTAUTH_URL || "https://app.lcadesk.com";
    const signupUrl = `${baseUrl}/auth/signup?invite=${token}&email=${encodeURIComponent(data.email)}&role=filer`;
    await sendEmail({
      to: data.email,
      subject: `You're invited to join ${tenant.name} on LCA Desk`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0F172A">${session.user.name || "A team admin"} invited you to ${tenant.name}</h2>
        <p style="color:#475569">You've been invited to join <strong>${tenant.name}</strong> on LCA Desk — the local content compliance platform for the petroleum sector.</p>
        <p style="color:#475569">Click below to create your account and join the team:</p>
        <a href="${signupUrl}" style="display:inline-block;padding:12px 24px;background:#047857;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">Accept Invitation</a>
        <p style="color:#94A3B8;font-size:13px">This invitation expires in 14 days. If you didn't expect this, you can ignore it.</p>
      </div>`,
    });
  } catch {}

  return { invited: true, email: data.email };
}

export async function acceptPendingInvites(userId: string, email: string) {
  // Security: verify the caller owns this userId (called from register route with fresh user,
  // or verify via session). Accept only if email matches a real pending invite.
  const session = await auth();
  if (session?.user?.id && session.user.id !== userId) throw new Error("Unauthorized");

  const pending = await db.select().from(teamInvites)
    .where(and(eq(teamInvites.email, email), eq(teamInvites.status, "pending")));

  let accepted = 0;
  for (const invite of pending) {
    if (new Date(invite.expiresAt) < new Date()) {
      await db.update(teamInvites).set({ status: "expired" }).where(eq(teamInvites.id, invite.id));
      continue;
    }

    if (invite.tenantId) {
      const existing = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.tenantId, invite.tenantId), eq(tenantMembers.userId, userId)),
      });
      if (!existing) {
        await db.insert(tenantMembers).values({ tenantId: invite.tenantId, userId, role: invite.role });
      }
    }

    if (invite.secretariatOfficeId) {
      // Check for existing membership to avoid duplicates
      const existingMember = await db.select({ id: secretariatMembers.id }).from(secretariatMembers)
        .where(and(eq(secretariatMembers.officeId, invite.secretariatOfficeId), eq(secretariatMembers.userId, userId)))
        .limit(1);
      if (existingMember.length === 0) {
        const [userData] = await db.select({ userRole: users.userRole }).from(users).where(eq(users.id, userId)).limit(1);
        const currentRole = userData?.userRole || "";
        if (!currentRole.includes("secretariat")) {
          const newRole = currentRole ? `${currentRole},secretariat` : "secretariat";
          // IMPORTANT: Role changes require the user to log out and back in — JWT is not auto-invalidated
          await db.update(users).set({ userRole: newRole }).where(eq(users.id, userId));
          await logAudit({
            tenantId: invite.secretariatOfficeId,
            userId,
            action: "update",
            entityType: "user_role",
            entityId: userId,
            oldValue: currentRole,
            newValue: newRole,
          });
        }
        await db.insert(secretariatMembers).values({ officeId: invite.secretariatOfficeId, userId, role: invite.role });
      }
    }

    await db.update(teamInvites).set({ status: "accepted", acceptedAt: new Date() }).where(eq(teamInvites.id, invite.id));
    accepted++;
  }

  return accepted;
}

export async function fetchPendingInvites() {
  const { tenantId } = await getSessionTenant();
  return db.select({
    id: teamInvites.id,
    email: teamInvites.email,
    role: teamInvites.role,
    inviterName: teamInvites.inviterName,
    status: teamInvites.status,
    expiresAt: teamInvites.expiresAt,
    createdAt: teamInvites.createdAt,
  }).from(teamInvites)
    .where(and(eq(teamInvites.tenantId, tenantId), eq(teamInvites.status, "pending")))
    .orderBy(desc(teamInvites.createdAt))
    .limit(50);
}

export async function cancelInvite(inviteId: string) {
  const { tenantId } = await getSessionTenant();
  await db.update(teamInvites).set({ status: "expired" })
    .where(and(eq(teamInvites.id, inviteId), eq(teamInvites.tenantId, tenantId)));
  return { success: true };
}

export async function removeTeamMember(memberId: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .delete(tenantMembers)
    .where(
      and(
        eq(tenantMembers.id, memberId),
        eq(tenantMembers.tenantId, tenantId)
      )
    );
}

export async function updateTeamMemberRole(memberId: string, role: string) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(tenantMembers)
    .set({ role })
    .where(
      and(
        eq(tenantMembers.id, memberId),
        eq(tenantMembers.tenantId, tenantId)
      )
    )
    .returning();
  return updated;
}

// ─── RECENT ACTIVITY ──────────────────────────────────────────────
export async function fetchRecentActivity() {
  const { tenantId } = await getSessionTenant();

  // Get recent reporting period updates as activity
  const recentPeriods = await db
    .select({
      id: reportingPeriods.id,
      entityId: reportingPeriods.entityId,
      reportType: reportingPeriods.reportType,
      status: reportingPeriods.status,
      updatedAt: reportingPeriods.updatedAt,
      entityName: entities.legalName,
    })
    .from(reportingPeriods)
    .innerJoin(entities, eq(reportingPeriods.entityId, entities.id))
    .where(eq(reportingPeriods.tenantId, tenantId))
    .orderBy(reportingPeriods.updatedAt)
    .limit(5);

  // Also get recent audit log entries
  const recentAudit = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      userName: auditLogs.userName,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, tenantId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

  const periodItems = recentPeriods.map((p) => ({
    id: p.id,
    type: "period_update" as const,
    entityName: p.entityName,
    reportType: p.reportType,
    status: p.status,
    timestamp: p.updatedAt,
  }));

  const auditItems = recentAudit.map((a) => ({
    id: a.id,
    type: "audit" as const,
    entityName: a.userName || "System",
    reportType: `${a.action} ${a.entityType?.replace(/_/g, " ")}`,
    status: a.action === "submit" ? "submitted" : a.action === "create" ? "in_progress" : a.action === "delete" ? "not_started" : "in_progress",
    timestamp: a.createdAt,
  }));

  return [...periodItems, ...auditItems]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 8);
}

// ─── CHAT CONVERSATIONS ──────────────────────────────────────────
export async function fetchChatConversations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.query.chatConversations.findMany({
    where: eq(chatConversations.userId, session.user.id),
    orderBy: (c, { desc }) => [desc(c.updatedAt)],
  });
}

export async function fetchChatMessages(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Verify ownership
  const conv = await db.query.chatConversations.findFirst({
    where: and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, session.user.id)
    ),
  });
  if (!conv) return [];

  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt);
}

export async function createChatConversation(title?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [conv] = await db
    .insert(chatConversations)
    .values({
      userId: session.user.id,
      title: title || "New conversation",
    })
    .returning();
  return conv;
}

export async function saveChatMessage(
  conversationId: string,
  role: string,
  content: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [msg] = await db
    .insert(chatMessages)
    .values({ conversationId, role, content })
    .returning();

  // Update conversation title from first user message if still default
  if (role === "user") {
    const conv = await db.query.chatConversations.findFirst({
      where: eq(chatConversations.id, conversationId),
    });
    if (conv?.title === "New conversation") {
      const title = content.length > 50 ? content.slice(0, 50) + "..." : content;
      await db
        .update(chatConversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(chatConversations.id, conversationId));
    } else {
      await db
        .update(chatConversations)
        .set({ updatedAt: new Date() })
        .where(eq(chatConversations.id, conversationId));
    }
  }

  return msg;
}

export async function deleteChatConversation(conversationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .delete(chatConversations)
    .where(
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, session.user.id)
      )
    );
}

// ─── PLAN & USAGE ────────────────────────────────────────────────
export async function fetchPlanAndUsage() {
  const { tenantId, tenant } = await getSessionTenant({ skipTrialCheck: true });
  const plan = tenant.plan || "lite";
  const trialEndsAt = tenant.trialEndsAt ?? null;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [usage] = await db
    .select()
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.tenantId, tenantId),
        eq(usageTracking.periodMonth, currentMonth)
      )
    )
    .limit(1);

  const entityCount = (
    await db.select().from(entities)
      .where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)))
  ).length;

  const memberCount = (
    await db.select().from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId))
  ).length;

  const stripeSubId = tenant.stripeSubscriptionId ?? null;
  const stripeSubStatus = tenant.stripeSubscriptionStatus ?? null;
  const billingAccess = getBillingAccess(plan, trialEndsAt, stripeSubId, stripeSubStatus);

  return {
    plan,
    trialEndsAt,
    stripeSubscriptionId: stripeSubId,
    stripeSubscriptionStatus: stripeSubStatus,
    billingAccess,
    isInTrial: isInTrial(trialEndsAt) || stripeSubStatus === "trialing",
    isTrialExpired: isTrialExpired(trialEndsAt, stripeSubId),
    trialDaysRemaining: getTrialDaysRemaining(trialEndsAt),
    effectivePlan: getEffectivePlan(plan, trialEndsAt).code,
    usage: {
      aiDraftsUsed: usage?.aiDraftsUsed || 0,
      aiChatMessagesUsed: usage?.aiChatMessagesUsed || 0,
      entityCount,
      memberCount,
    },
    periodMonth: currentMonth,
  };
}

export async function incrementUsage(
  type: "aiDraftsUsed" | "aiChatMessagesUsed"
) {
  const { tenantId, plan, trialEndsAt } = await getSessionTenant();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const planConfig = getEffectivePlan(plan, trialEndsAt);
  const limitKey = type === "aiDraftsUsed" ? "aiDraftsPerMonth" : "aiChatMessagesPerMonth";
  const limit = planConfig[limitKey];

  const [existing] = await db
    .select()
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.tenantId, tenantId),
        eq(usageTracking.periodMonth, currentMonth)
      )
    )
    .limit(1);

  if (existing) {
    const current = existing[type] || 0;
    if (limit !== -1 && current >= limit) {
      throw new Error(`Monthly ${type === "aiDraftsUsed" ? "AI draft" : "AI chat"} limit reached (${limit}). Upgrade your plan for unlimited access.`);
    }
    const newValue = current + 1;
    await db
      .update(usageTracking)
      .set({ [type]: newValue, updatedAt: new Date() })
      .where(eq(usageTracking.id, existing.id));
    return newValue;
  }

  const [created] = await db
    .insert(usageTracking)
    .values({
      tenantId,
      periodMonth: currentMonth,
      [type]: 1,
    })
    .returning();

  return created[type] || 1;
}

// ─── QBO INTEGRATION ─────────────────────────────────────────────
export async function fetchQboStatus() {
  const { tenant } = await getSessionTenant();
  return {
    connected: !!tenant.qboRealmId,
    companyName: tenant.qboCompanyName || null,
    realmId: tenant.qboRealmId || null,
    connectedAt: tenant.qboConnectedAt || null,
  };
}

export async function disconnectQbo() {
  const { tenantId } = await getSessionTenant();
  await db
    .update(tenants)
    .set({
      qboRealmId: null,
      qboCompanyName: null,
      qboAccessToken: null,
      qboRefreshToken: null,
      qboTokenExpiresAt: null,
      qboConnectedAt: null,
    })
    .where(eq(tenants.id, tenantId));
}

// ─── SUPPLIER DIRECTORY ──────────────────────────────────────────
export async function fetchSuppliers() {
  const { tenantId } = await getSessionTenant();
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.tenantId, tenantId))
    .orderBy(suppliers.name);
}

export async function addSupplier(data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [supplier] = await db
    .insert(suppliers)
    .values({
      tenantId,
      name: data.name as string,
      certificateId: (data.certificate_id as string) || null,
      soleSourceCode: (data.sole_source_code as string) || null,
      bankName: (data.bank_name as string) || null,
      bankCountry: (data.bank_country as string) || null,
      defaultSector: (data.default_sector as string) || null,
      contactName: (data.contact_name as string) || null,
      contactEmail: (data.contact_email as string) || null,
      contactPhone: (data.contact_phone as string) || null,
      notes: (data.notes as string) || null,
    })
    .returning();
  return supplier;
}

export async function updateSupplier(supplierId: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(suppliers)
    .set({
      name: data.name as string,
      certificateId: (data.certificate_id as string) || null,
      soleSourceCode: (data.sole_source_code as string) || null,
      bankName: (data.bank_name as string) || null,
      bankCountry: (data.bank_country as string) || null,
      defaultSector: (data.default_sector as string) || null,
      contactName: (data.contact_name as string) || null,
      contactEmail: (data.contact_email as string) || null,
      contactPhone: (data.contact_phone as string) || null,
      notes: (data.notes as string) || null,
      updatedAt: new Date(),
    })
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId)))
    .returning();
  return updated;
}

export async function deleteSupplier(supplierId: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .delete(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId)));
}

// ─── EMPLOYEE ROSTER ─────────────────────────────────────────────
export async function fetchEmployees(entityId?: string) {
  const { tenantId } = await getSessionTenant();
  if (entityId) {
    return db
      .select()
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.entityId, entityId), eq(employees.active, true)))
      .orderBy(employees.fullName);
  }
  return db
    .select()
    .from(employees)
    .where(and(eq(employees.tenantId, tenantId), eq(employees.active, true)))
    .orderBy(employees.fullName);
}

export async function addEmployee(data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [employee] = await db
    .insert(employees)
    .values({
      tenantId,
      entityId: (data.entity_id as string) || null,
      fullName: data.full_name as string,
      jobTitle: data.job_title as string,
      employmentCategory: data.employment_category as string,
      employmentClassification: (data.employment_classification as string) || null,
      isGuyanese: data.is_guyanese === true || data.is_guyanese === "true",
      nationality: (data.nationality as string) || null,
      contractType: (data.contract_type as string) || null,
      startDate: (data.start_date as string) || null,
      notes: (data.notes as string) || null,
    })
    .returning();
  return employee;
}

export async function updateEmployee(employeeId: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(employees)
    .set({
      fullName: data.full_name as string,
      jobTitle: data.job_title as string,
      employmentCategory: data.employment_category as string,
      employmentClassification: (data.employment_classification as string) || null,
      isGuyanese: data.is_guyanese === true || data.is_guyanese === "true",
      nationality: (data.nationality as string) || null,
      contractType: (data.contract_type as string) || null,
      startDate: (data.start_date as string) || null,
      notes: (data.notes as string) || null,
      active: data.active !== false,
      updatedAt: new Date(),
    })
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .returning();
  return updated;
}

export async function deleteEmployee(employeeId: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .update(employees)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)));
}

// ─── DUPLICATE PERIOD ────────────────────────────────────────────
export async function duplicatePeriod(sourcePeriodId: string, newReportType: string, newFiscalYear: number, newPeriodStart: string, newPeriodEnd: string, newDueDate: string) {
  const { tenantId } = await getSessionTenant();

  // Verify source period belongs to tenant
  const source = await db.query.reportingPeriods.findFirst({
    where: and(
      eq(reportingPeriods.id, sourcePeriodId),
      eq(reportingPeriods.tenantId, tenantId)
    ),
  });
  if (!source) throw new Error("Source period not found");

  // Create new period
  const [newPeriod] = await db
    .insert(reportingPeriods)
    .values({
      entityId: source.entityId,
      tenantId,
      jurisdictionId: source.jurisdictionId,
      reportType: newReportType,
      periodStart: newPeriodStart,
      periodEnd: newPeriodEnd,
      dueDate: newDueDate,
      fiscalYear: newFiscalYear,
      status: "not_started",
    })
    .returning();

  // Copy expenditure records
  const sourceExp = await db
    .select()
    .from(expenditureRecords)
    .where(eq(expenditureRecords.reportingPeriodId, sourcePeriodId));

  if (sourceExp.length > 0) {
    await db.insert(expenditureRecords).values(
      sourceExp.map((e) => ({
        reportingPeriodId: newPeriod.id,
        entityId: e.entityId,
        tenantId,
        typeOfItemProcured: e.typeOfItemProcured,
        relatedSector: e.relatedSector,
        descriptionOfGoodService: e.descriptionOfGoodService,
        supplierName: e.supplierName,
        supplierType: e.supplierType,
        soleSourceCode: e.soleSourceCode,
        supplierCertificateId: e.supplierCertificateId,
        actualPayment: "0",
        outstandingPayment: null,
        projectionNextPeriod: null,
        paymentMethod: e.paymentMethod,
        supplierBank: e.supplierBank,
        bankLocationCountry: e.bankLocationCountry,
        currencyOfPayment: e.currencyOfPayment,
      }))
    );
  }

  // Copy employment records
  const sourceEmp = await db
    .select()
    .from(employmentRecords)
    .where(eq(employmentRecords.reportingPeriodId, sourcePeriodId));

  if (sourceEmp.length > 0) {
    await db.insert(employmentRecords).values(
      sourceEmp.map((e) => ({
        reportingPeriodId: newPeriod.id,
        entityId: e.entityId,
        tenantId,
        jobTitle: e.jobTitle,
        employmentCategory: e.employmentCategory,
        employmentClassification: e.employmentClassification,
        relatedCompany: e.relatedCompany,
        totalEmployees: e.totalEmployees,
        guyanaeseEmployed: e.guyanaeseEmployed,
        totalRemunerationPaid: "0",
        remunerationGuyanaeseOnly: "0",
      }))
    );
  }

  // Copy capacity records (structure only, reset amounts)
  const sourceCap = await db
    .select()
    .from(capacityDevelopmentRecords)
    .where(eq(capacityDevelopmentRecords.reportingPeriodId, sourcePeriodId));

  if (sourceCap.length > 0) {
    await db.insert(capacityDevelopmentRecords).values(
      sourceCap.map((c) => ({
        reportingPeriodId: newPeriod.id,
        entityId: c.entityId,
        tenantId,
        activity: c.activity,
        category: c.category,
        participantType: c.participantType,
        guyanaeseParticipantsOnly: 0,
        totalParticipants: 0,
        startDate: null,
        durationDays: null,
        costToParticipants: null,
        expenditureOnCapacity: null,
      }))
    );
  }

  return newPeriod;
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────
export async function fetchNotifications(limit: number = 20) {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function fetchUnreadCount() {
  const session = await auth();
  if (!session?.user?.id) return 0;

  const result = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        eq(notifications.read, false)
      )
    );

  return result.length;
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, session.user.id)
      )
    );
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        eq(notifications.read, false)
      )
    );
}

export async function generateDeadlineNotifications() {
  const session = await auth();
  if (!session?.user?.id) return;

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
  });
  if (!membership) return;

  const tenantId = membership.tenantId;

  // Get all entities for this tenant
  const entityList = await db
    .select()
    .from(entities)
    .where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)));

  const now = new Date();
  const { calculateDeadlines } = await import("@/lib/compliance/deadlines");
  const currentYear = now.getFullYear();

  for (const entity of entityList) {
    const entJCode = await getEntityJurisdictionCode(entity.id);
    const deadlines = calculateDeadlines(entJCode, currentYear);

    for (const deadline of deadlines) {
      const daysRemaining = Math.floor(
        (deadline.due_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if we already sent this notification (by type + title match)
      let notifType = "";
      let title = "";
      let message = "";

      if (daysRemaining < 0 && daysRemaining > -60) {
        notifType = "deadline_overdue";
        title = `${deadline.label} is overdue`;
        message = `${entity.legalName}: ${deadline.label} was due ${Math.abs(daysRemaining)} days ago on ${deadline.due_date.toLocaleDateString()}.`;
      } else if (daysRemaining >= 0 && daysRemaining <= 14) {
        notifType = "deadline_warning";
        title = `${deadline.label} due in ${daysRemaining} days`;
        message = `${entity.legalName}: ${deadline.label} is due on ${deadline.due_date.toLocaleDateString()}. Start filing now.`;
      } else {
        continue;
      }

      // Check for existing notification with same title to avoid duplicates
      const existing = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, session.user.id),
            eq(notifications.title, title)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(notifications).values({
          userId: session.user.id,
          tenantId,
          type: notifType,
          title,
          message,
          link: `/dashboard/entities/${entity.id}`,
        });
      }
    }

    // Check LCS certificate expiry
    if (entity.lcsCertificateExpiry) {
      const expiry = new Date(entity.lcsCertificateExpiry);
      const daysToExpiry = Math.floor(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysToExpiry >= 0 && daysToExpiry <= 30) {
        const title = `LCS Certificate expiring in ${daysToExpiry} days`;
        const existing = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, session.user.id),
              eq(notifications.title, title)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(notifications).values({
            userId: session.user.id,
            tenantId,
            type: "cert_expiring",
            title,
            message: `${entity.legalName}: LCS Certificate ${entity.lcsCertificateId || ""} expires on ${expiry.toLocaleDateString()}.`,
            link: `/dashboard/entities/${entity.id}`,
          });
        }
      }
    }
  }
}

// ─── STEP COMPLETION ─────────────────────────────────────────────
export async function fetchStepCompletion(periodId: string) {
  const { tenantId } = await getSessionTenant();

  const [exps, emps, caps, nars, period] = await Promise.all([
    db.select().from(expenditureRecords).where(and(eq(expenditureRecords.reportingPeriodId, periodId), eq(expenditureRecords.tenantId, tenantId))).limit(1),
    db.select().from(employmentRecords).where(and(eq(employmentRecords.reportingPeriodId, periodId), eq(employmentRecords.tenantId, tenantId))).limit(1),
    db.select().from(capacityDevelopmentRecords).where(and(eq(capacityDevelopmentRecords.reportingPeriodId, periodId), eq(capacityDevelopmentRecords.tenantId, tenantId))).limit(1),
    db.select({ section: narrativeDrafts.section }).from(narrativeDrafts).where(and(eq(narrativeDrafts.reportingPeriodId, periodId), eq(narrativeDrafts.tenantId, tenantId))),
    db.select({ status: reportingPeriods.status }).from(reportingPeriods).where(eq(reportingPeriods.id, periodId)).limit(1),
  ]);

  const completed: string[] = ["company_info"];
  if (exps.length > 0) completed.push("expenditure");
  if (emps.length > 0) completed.push("employment");
  if (caps.length > 0) completed.push("capacity");
  // Narrative complete only if all 3 sections have drafts
  const narSections = new Set(nars.map(n => n.section));
  if (narSections.has("expenditure_narrative") && narSections.has("employment_narrative") && narSections.has("capacity_narrative")) {
    completed.push("narrative");
  }
  // Review complete if all 3 data steps + narrative done
  if (exps.length > 0 && emps.length > 0 && caps.length > 0) completed.push("review");
  // Export complete after submission
  if (period[0]?.status === "submitted" || period[0]?.status === "acknowledged") completed.push("export");
  return completed;
}

// ─── JOB POSTINGS ─────────────────────────────────────────────────
export async function fetchJobPostings(status?: string) {
  const { tenantId } = await getSessionTenant();
  if (status && status !== "all") {
    return db
      .select()
      .from(jobPostings)
      .where(and(eq(jobPostings.tenantId, tenantId), eq(jobPostings.status, status)))
      .orderBy(jobPostings.createdAt);
  }
  return db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.tenantId, tenantId))
    .orderBy(jobPostings.createdAt);
}

export async function addJobPosting(data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const statement = (data.guyanese_first_statement as string) ||
    `In accordance with Section 12 of the Local Content Act 2021, ${data.job_title} position(s) are advertised with first consideration given to qualified Guyanese nationals.`;
  const [posting] = await db
    .insert(jobPostings)
    .values({
      tenantId,
      entityId: (data.entity_id as string) || null,
      jobTitle: data.job_title as string,
      employmentCategory: data.employment_category as string,
      employmentClassification: (data.employment_classification as string) || null,
      contractType: data.contract_type as string,
      location: (data.location as string) || null,
      description: (data.description as string) || null,
      qualifications: (data.qualifications as string) || null,
      vacancyCount: Number(data.vacancy_count) || 1,
      applicationDeadline: (data.application_deadline as string) || null,
      startDate: (data.start_date as string) || null,
      isPublic: data.is_public !== false,
      guyaneseFirstStatement: statement,
      status: "open",
    })
    .returning();
  return posting;
}

export async function updateJobPosting(id: string, data: Record<string, unknown>) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(jobPostings)
    .set({
      entityId: (data.entity_id as string) || null,
      jobTitle: data.job_title as string,
      employmentCategory: data.employment_category as string,
      employmentClassification: (data.employment_classification as string) || null,
      contractType: data.contract_type as string,
      location: (data.location as string) || null,
      description: (data.description as string) || null,
      qualifications: (data.qualifications as string) || null,
      vacancyCount: Number(data.vacancy_count) || 1,
      applicationDeadline: (data.application_deadline as string) || null,
      startDate: (data.start_date as string) || null,
      isPublic: data.is_public !== false,
      guyaneseFirstStatement: (data.guyanese_first_statement as string) || undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(jobPostings.id, id), eq(jobPostings.tenantId, tenantId)))
    .returning();
  return updated;
}

export async function closeJobPosting(id: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .update(jobPostings)
    .set({ status: "closed", updatedAt: new Date() })
    .where(and(eq(jobPostings.id, id), eq(jobPostings.tenantId, tenantId)));
}

export async function deleteJobPosting(id: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .delete(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.tenantId, tenantId)));
}

export async function reopenJobPosting(id: string) {
  const { tenantId } = await getSessionTenant();
  const [updated] = await db
    .update(jobPostings)
    .set({ status: "open", filledAt: null, updatedAt: new Date() })
    .where(and(eq(jobPostings.id, id), eq(jobPostings.tenantId, tenantId)))
    .returning();
  return updated;
}

export async function fetchApplicationCounts() {
  const { tenantId } = await getSessionTenant();
  const postingIds = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(eq(jobPostings.tenantId, tenantId));

  const counts: Record<string, number> = {};
  for (const p of postingIds) {
    const apps = await db
      .select({ id: jobApplications.id })
      .from(jobApplications)
      .where(eq(jobApplications.jobPostingId, p.id));
    counts[p.id] = apps.length;
  }
  return counts;
}

// ─── JOB APPLICATIONS ─────────────────────────────────────────────
export async function fetchApplicationsForPosting(postingId: string) {
  const { tenantId } = await getSessionTenant();
  // Verify posting belongs to tenant
  const [posting] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, postingId), eq(jobPostings.tenantId, tenantId)))
    .limit(1);
  if (!posting) throw new Error("Posting not found");
  
  return db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.jobPostingId, postingId))
    .orderBy(jobApplications.createdAt);
}

export async function updateApplicationStatus(applicationId: string, status: string, reviewNotes?: string) {
  const [updated] = await db
    .update(jobApplications)
    .set({
      status,
      reviewNotes: reviewNotes || undefined,
      updatedAt: new Date(),
    })
    .where(eq(jobApplications.id, applicationId))
    .returning();

  // Notify applicant of status change
  if (updated) {
    const [posting] = await db.select({ jobTitle: jobPostings.jobTitle, tenantId: jobPostings.tenantId }).from(jobPostings).where(eq(jobPostings.id, updated.jobPostingId)).limit(1);
    if (posting) {
      const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, posting.tenantId)).limit(1);
      if (updated.applicantUserId) {
        // In-app + email for registered users
        unifiedNotifyAppStatus({
          userId: updated.applicantUserId,
          applicantName: updated.applicantName,
          jobTitle: posting.jobTitle,
          companyName: tenant?.name || "",
          newStatus: status,
        });
      } else if (updated.applicantEmail) {
        // Email-only for public applicants (no userId for in-app notification)
        const { sendEmail } = await import("@/lib/email/client");
        const { applicationStatusEmail } = await import("@/lib/email/templates");
        const notifyStatuses = ["reviewing", "shortlisted", "interviewed", "selected", "rejected"];
        if (notifyStatuses.includes(status)) {
          sendEmail({
            to: updated.applicantEmail,
            subject: `Application update: ${posting.jobTitle}`,
            html: applicationStatusEmail({
              applicantName: updated.applicantName,
              jobTitle: posting.jobTitle,
              companyName: tenant?.name || "",
              newStatus: status,
            }),
          }).catch(() => {});
        }
      }
    }
  }

  return updated;
}

export async function generateFirstConsiderationRecord(postingId: string) {
  const { tenantId } = await getSessionTenant();
  const [posting] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, postingId), eq(jobPostings.tenantId, tenantId)))
    .limit(1);
  if (!posting) throw new Error("Posting not found");

  const applications = await db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.jobPostingId, postingId));

  const totalApps = applications.length;
  const guyaneseApps = applications.filter(a => a.isGuyanese).length;
  const nonGuyaneseApps = totalApps - guyaneseApps;
  const selected = applications.filter(a => a.status === "selected");
  const guyaneseSelected = selected.filter(a => a.isGuyanese).length;

  return {
    posting: {
      jobTitle: posting.jobTitle,
      employmentCategory: posting.employmentCategory,
      contractType: posting.contractType,
      location: posting.location,
      vacancyCount: posting.vacancyCount,
      postedDate: posting.createdAt,
      deadline: posting.applicationDeadline,
      guyaneseFirstStatement: posting.guyaneseFirstStatement,
    },
    applications: {
      total: totalApps,
      guyanese: guyaneseApps,
      nonGuyanese: nonGuyaneseApps,
      selected: selected.length,
      guyaneseSelected,
    },
    compliance: {
      firstConsiderationGiven: true,
      statement: posting.guyaneseFirstStatement,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ─── OPPORTUNITIES FEED ──────────────────────────────────────────
export async function fetchOpportunitiesFeed(filters?: {
  type?: string;
  category?: string;
  status?: string;
}) {
  let query = db.select().from(lcsOpportunities).$dynamic();
  
  // Apply filters using raw where conditions
  const conditions = [];
  if (filters?.type) conditions.push(eq(lcsOpportunities.type, filters.type));
  if (filters?.category) conditions.push(eq(lcsOpportunities.lcaCategory, filters.category));
  if (filters?.status) conditions.push(eq(lcsOpportunities.status, filters.status));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  return query.orderBy(lcsOpportunities.postedDate).limit(200);
}

export async function fetchSavedOpportunities() {
  const session = await auth();
  if (!session?.user?.id) return [];
  
  const { tenantId } = await getSessionTenant();
  return db
    .select({
      id: savedOpportunities.id,
      opportunityId: savedOpportunities.opportunityId,
      notes: savedOpportunities.notes,
      savedAt: savedOpportunities.createdAt,
    })
    .from(savedOpportunities)
    .where(eq(savedOpportunities.tenantId, tenantId));
}

export async function saveOpportunity(opportunityId: string, notes?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const { tenantId } = await getSessionTenant();
  
  const [saved] = await db
    .insert(savedOpportunities)
    .values({
      tenantId,
      userId: session.user.id,
      opportunityId,
      notes: notes || null,
    })
    .onConflictDoNothing()
    .returning();
  return saved;
}

export async function unsaveOpportunity(opportunityId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  
  await db
    .delete(savedOpportunities)
    .where(
      and(
        eq(savedOpportunities.userId, session.user.id),
        eq(savedOpportunities.opportunityId, opportunityId)
      )
    );
}

// ─── HIRE APPLICANT → EMPLOYEE ROSTER ─────────────────────────────
export async function hireApplicant(applicationId: string, entityId: string) {
  const { tenantId } = await getSessionTenant();

  // Validate entity belongs to this tenant
  const [entityCheck] = await db.select({ id: entities.id }).from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.tenantId, tenantId))).limit(1);
  if (!entityCheck) throw new Error("Entity not found or doesn't belong to your organization");

  const [application] = await db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.id, applicationId))
    .limit(1);
  if (!application) throw new Error("Application not found");

  const [posting] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, application.jobPostingId), eq(jobPostings.tenantId, tenantId)))
    .limit(1);
  if (!posting) throw new Error("Posting not found or doesn't belong to your organization");

  // Create employee record from application data
  const [employee] = await db
    .insert(employees)
    .values({
      tenantId,
      entityId,
      fullName: application.applicantName,
      jobTitle: posting?.jobTitle || "",
      employmentCategory: application.employmentCategory || posting?.employmentCategory || "Non-Technical",
      employmentClassification: application.employmentClassification || null,
      isGuyanese: application.isGuyanese ?? true,
      nationality: application.nationality || "Guyanese",
      contractType: posting?.contractType || "contract",
      startDate: new Date().toISOString().slice(0, 10),
      active: true,
    })
    .returning();

  // Link application to employee
  await db
    .update(jobApplications)
    .set({ status: "selected", employeeRecordId: employee.id, hiredAt: new Date(), updatedAt: new Date() })
    .where(eq(jobApplications.id, applicationId));

  // Update posting
  await db
    .update(jobPostings)
    .set({ guyaneseHired: application.isGuyanese, status: "filled", filledAt: new Date(), updatedAt: new Date() })
    .where(eq(jobPostings.id, application.jobPostingId));

  return employee;
}

// ─── UPGRADE SUPPLIER TO FILER ────────────────────────────────────
export async function upgradeSupplierToFiler(companyName: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [guyana] = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.code, "GY"))
    .limit(1);

  const slug = companyName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: companyName,
      slug,
      jurisdictionId: guyana?.id,
      plan: "lite",
      planEntityLimit: 1,
      trialEndsAt,
    })
    .returning();

  await db.insert(tenantMembers).values({
    tenantId: tenant.id,
    userId: session.user.id,
    role: "owner",
  });

  // Pre-create entity from supplier profile if they have LCS cert
  const [profile] = await db
    .select()
    .from(supplierProfiles)
    .where(eq(supplierProfiles.userId, session.user.id))
    .limit(1);

  if (profile?.lcsCertId && guyana) {
    await db.insert(entities).values({
      tenantId: tenant.id,
      jurisdictionId: guyana.id,
      legalName: profile.legalName || companyName,
      lcsCertificateId: profile.lcsCertId,
      lcsCertificateExpiry: profile.lcsExpirationDate || undefined,
    });
  }

  // Update role to include filer
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const currentRole = user?.userRole || "supplier";
  const newRole = currentRole.includes("filer") ? currentRole : `${currentRole},filer`;

  // IMPORTANT: Role changes require the user to log out and back in — JWT is not auto-invalidated
  await db
    .update(users)
    .set({ userRole: newRole, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  await logAudit({
    tenantId: tenant.id,
    userId: session.user.id,
    action: "update",
    entityType: "user_role",
    entityId: session.user.id,
    oldValue: currentRole,
    newValue: newRole,
  });

  return { tenantId: tenant.id };
}

// ─── JOB SEEKER PORTAL ────────────────────────────────────────────
export async function fetchMyApplications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db
    .select({
      id: jobApplications.id,
      jobTitle: jobPostings.jobTitle,
      companyName: tenants.name,
      status: jobApplications.status,
      appliedAt: jobApplications.createdAt,
      isGuyanese: jobApplications.isGuyanese,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobPostingId, jobPostings.id))
    .innerJoin(tenants, eq(jobPostings.tenantId, tenants.id))
    .where(eq(jobApplications.applicantUserId, session.user.id))
    .orderBy(jobApplications.createdAt);
}

// ─── SUPPLIER PORTAL ──────────────────────────────────────────────
export async function fetchMySupplierProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return db.query.supplierProfiles.findFirst({
    where: eq(supplierProfiles.userId, session.user.id),
  });
}

export async function updateMySupplierProfile(data: Record<string, unknown>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [updated] = await db
    .update(supplierProfiles)
    .set({
      legalName: (data.legal_name as string) || null,
      tradingName: (data.trading_name as string) || null,
      address: (data.address as string) || null,
      website: (data.website as string) || null,
      serviceCategories: (data.service_categories as string[]) || [],
      profileVisible: data.profile_visible !== false,
      updatedAt: new Date(),
    })
    .where(eq(supplierProfiles.userId, session.user.id))
    .returning();
  return updated;
}

// ─── JOB SEEKER PORTAL (EXTENDED) ────────────────────────────────

export async function fetchMyProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const profile = await db.query.jobSeekerProfiles.findFirst({
    where: eq(jobSeekerProfiles.userId, session.user.id),
  });

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return profile ? { ...profile, name: user?.name, email: user?.email } : null;
}

export async function updateMyProfile(data: {
  currentJobTitle?: string;
  employmentCategory?: string;
  employmentClassification?: string;
  yearsExperience?: number;
  isGuyanese?: boolean;
  guyaneseStatus?: string;
  nationality?: string;
  nationalIdNumber?: string;
  iscoCode?: string;
  educationLevel?: string;
  educationField?: string;
  certifications?: string[];
  workPermitStatus?: string;
  lcaAttestation?: boolean;
  cvUrl?: string;
  skills?: string[];
  locationPreference?: string;
  contractTypePreference?: string;
  alertsEnabled?: boolean;
  profileVisible?: boolean;
  name?: string;
  resumeContent?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  if (data.name) {
    await db.update(users).set({ name: data.name, updatedAt: new Date() }).where(eq(users.id, session.user.id));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
      currentJobTitle: data.currentJobTitle ?? undefined,
      employmentCategory: data.employmentCategory ?? undefined,
      employmentClassification: data.employmentClassification ?? undefined,
      yearsExperience: data.yearsExperience ?? undefined,
      isGuyanese: data.isGuyanese ?? undefined,
      guyaneseStatus: data.guyaneseStatus ?? undefined,
      nationality: data.nationality ?? undefined,
      nationalIdNumber: data.nationalIdNumber ?? undefined,
      iscoCode: data.iscoCode ?? undefined,
      educationLevel: data.educationLevel ?? undefined,
      educationField: data.educationField ?? undefined,
      certifications: data.certifications ?? undefined,
      workPermitStatus: data.workPermitStatus ?? undefined,
      cvUrl: data.cvUrl ?? undefined,
      skills: data.skills ?? undefined,
      locationPreference: data.locationPreference ?? undefined,
      contractTypePreference: data.contractTypePreference ?? undefined,
      profileVisible: data.profileVisible ?? undefined,
      resumeContent: data.resumeContent ?? undefined,
      updatedAt: new Date(),
  };

  // Handle attestation
  if (data.lcaAttestation) {
    updates.lcaAttestationDate = new Date();
    updates.lcaAttestationText = "I certify that the information provided regarding my nationality, residency status, and qualifications is true and accurate. I understand this information may be used for Local Content Act compliance reporting.";
  }

  const [updated] = await db
    .update(jobSeekerProfiles)
    .set(updates)
    .where(eq(jobSeekerProfiles.userId, session.user.id))
    .returning();

  return updated;
}

export async function fetchPublicJobs(filters?: {
  category?: string;
  contractType?: string;
  location?: string;
  search?: string;
}) {
  const conditions = [
    eq(jobPostings.status, "open"),
    eq(jobPostings.isPublic, true),
  ];
  if (filters?.category) conditions.push(eq(jobPostings.employmentCategory, filters.category));
  if (filters?.contractType) conditions.push(eq(jobPostings.contractType, filters.contractType));

  const results = await db
    .select({
      id: jobPostings.id,
      jobTitle: jobPostings.jobTitle,
      employmentCategory: jobPostings.employmentCategory,
      employmentClassification: jobPostings.employmentClassification,
      contractType: jobPostings.contractType,
      location: jobPostings.location,
      description: jobPostings.description,
      qualifications: jobPostings.qualifications,
      vacancyCount: jobPostings.vacancyCount,
      applicationDeadline: jobPostings.applicationDeadline,
      startDate: jobPostings.startDate,
      guyaneseFirstStatement: jobPostings.guyaneseFirstStatement,
      createdAt: jobPostings.createdAt,
      companyName: tenants.name,
    })
    .from(jobPostings)
    .innerJoin(tenants, eq(jobPostings.tenantId, tenants.id))
    .where(and(...conditions))
    .orderBy(jobPostings.createdAt)
    .limit(100);

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return results.filter(
      (j) =>
        j.jobTitle.toLowerCase().includes(q) ||
        j.companyName.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q)
    );
  }

  return results;
}

export async function fetchJobDetail(jobId: string) {
  const [job] = await db
    .select({
      id: jobPostings.id,
      jobTitle: jobPostings.jobTitle,
      employmentCategory: jobPostings.employmentCategory,
      employmentClassification: jobPostings.employmentClassification,
      contractType: jobPostings.contractType,
      location: jobPostings.location,
      description: jobPostings.description,
      qualifications: jobPostings.qualifications,
      vacancyCount: jobPostings.vacancyCount,
      applicationDeadline: jobPostings.applicationDeadline,
      startDate: jobPostings.startDate,
      guyaneseFirstStatement: jobPostings.guyaneseFirstStatement,
      status: jobPostings.status,
      createdAt: jobPostings.createdAt,
      companyName: tenants.name,
    })
    .from(jobPostings)
    .innerJoin(tenants, eq(jobPostings.tenantId, tenants.id))
    .where(and(eq(jobPostings.id, jobId), eq(jobPostings.isPublic, true)))
    .limit(1);

  return job ?? null;
}

export async function applyToJob(data: {
  jobPostingId: string;
  coverNote?: string;
  cvUrl?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const profile = await db.query.jobSeekerProfiles.findFirst({
    where: eq(jobSeekerProfiles.userId, session.user.id),
  });

  const existing = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.jobPostingId, data.jobPostingId),
        eq(jobApplications.applicantUserId, session.user.id)
      )
    )
    .limit(1);

  if (existing.length > 0) throw new Error("You have already applied to this position");

  const [application] = await db
    .insert(jobApplications)
    .values({
      jobPostingId: data.jobPostingId,
      applicantUserId: session.user.id,
      applicantName: user?.name || "Unknown",
      applicantEmail: user?.email || "",
      isGuyanese: profile?.isGuyanese ?? true,
      nationality: profile?.nationality || "Guyanese",
      employmentCategory: profile?.employmentCategory || null,
      employmentClassification: profile?.employmentClassification || null,
      coverNote: data.coverNote || null,
      cvUrl: data.cvUrl || profile?.cvUrl || null,
    })
    .returning();

  return application;
}

export async function fetchSeekerOpportunities(filters?: {
  type?: string;
  category?: string;
  search?: string;
}) {
  const conditions = [eq(lcsOpportunities.status, "active")];
  if (filters?.type) conditions.push(eq(lcsOpportunities.type, filters.type));
  if (filters?.category) conditions.push(eq(lcsOpportunities.lcaCategory, filters.category));

  const results = await db
    .select()
    .from(lcsOpportunities)
    .where(and(...conditions))
    .orderBy(lcsOpportunities.postedDate)
    .limit(200);

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return results.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.contractorName.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }

  return results;
}

export async function seekerSaveOpportunity(opportunityId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [saved] = await db
    .insert(savedOpportunities)
    .values({
      tenantId: session.user.id,
      userId: session.user.id,
      opportunityId,
    })
    .onConflictDoNothing()
    .returning();
  return saved;
}

export async function seekerUnsaveOpportunity(opportunityId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .delete(savedOpportunities)
    .where(
      and(
        eq(savedOpportunities.userId, session.user.id),
        eq(savedOpportunities.opportunityId, opportunityId)
      )
    );
}

export async function fetchMySavedOpportunities() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db
    .select({
      id: savedOpportunities.id,
      opportunityId: savedOpportunities.opportunityId,
      notes: savedOpportunities.notes,
      savedAt: savedOpportunities.createdAt,
      title: lcsOpportunities.title,
      contractorName: lcsOpportunities.contractorName,
      type: lcsOpportunities.type,
      deadline: lcsOpportunities.deadline,
      sourceUrl: lcsOpportunities.sourceUrl,
    })
    .from(savedOpportunities)
    .innerJoin(lcsOpportunities, eq(savedOpportunities.opportunityId, lcsOpportunities.id))
    .where(eq(savedOpportunities.userId, session.user.id))
    .orderBy(savedOpportunities.createdAt);
}

// ─── SEEKER: SAVE JOBS ──────────────────────────────────────────

export async function seekerSaveJob(jobId: string, jobType: "posted" | "lcs") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.insert(savedJobs).values({
    userId: session.user.id,
    jobPostingId: jobType === "posted" ? jobId : null,
    lcsJobId: jobType === "lcs" ? jobId : null,
    jobType,
  }).onConflictDoNothing();
}

export async function seekerUnsaveJob(savedId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await db.delete(savedJobs).where(and(eq(savedJobs.id, savedId), eq(savedJobs.userId, session.user.id)));
}

export async function fetchMySavedJobs() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const saved = await db.select().from(savedJobs)
    .where(eq(savedJobs.userId, session.user.id))
    .orderBy(desc(savedJobs.createdAt)).limit(50);

  const results = [];
  for (const s of saved) {
    if (s.jobType === "posted" && s.jobPostingId) {
      const [job] = await db.select({ title: jobPostings.jobTitle, company: tenants.name, category: jobPostings.employmentCategory, location: jobPostings.location, deadline: jobPostings.applicationDeadline })
        .from(jobPostings).innerJoin(tenants, eq(jobPostings.tenantId, tenants.id))
        .where(eq(jobPostings.id, s.jobPostingId)).limit(1);
      if (job) results.push({ id: s.id, jobType: "posted", jobId: s.jobPostingId, savedAt: s.createdAt, ...job });
    } else if (s.jobType === "lcs" && s.lcsJobId) {
      const [job] = await db.select({ title: lcsEmploymentNotices.jobTitle, company: lcsEmploymentNotices.companyName, category: lcsEmploymentNotices.employmentCategory, location: lcsEmploymentNotices.location, deadline: lcsEmploymentNotices.closingDate })
        .from(lcsEmploymentNotices).where(eq(lcsEmploymentNotices.id, s.lcsJobId)).limit(1);
      if (job) results.push({ id: s.id, jobType: "lcs", jobId: s.lcsJobId, savedAt: s.createdAt, ...job });
    }
  }
  return results;
}

export async function fetchSeekerDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const apps = await db
    .select({ status: jobApplications.status })
    .from(jobApplications)
    .where(eq(jobApplications.applicantUserId, session.user.id));

  const saved = await db
    .select({ id: savedOpportunities.id })
    .from(savedOpportunities)
    .where(eq(savedOpportunities.userId, session.user.id));

  const savedJobCount = await db
    .select({ id: savedJobs.id })
    .from(savedJobs)
    .where(eq(savedJobs.userId, session.user.id));

  const openJobs = await db
    .select({ id: jobPostings.id, category: jobPostings.employmentCategory, title: jobPostings.jobTitle, company: tenants.name })
    .from(jobPostings)
    .innerJoin(tenants, eq(jobPostings.tenantId, tenants.id))
    .where(and(eq(jobPostings.status, "open"), eq(jobPostings.isPublic, true)))
    .limit(500);

  const profile = await db.query.jobSeekerProfiles.findFirst({
    where: eq(jobSeekerProfiles.userId, session.user.id),
  });

  // Badges
  const badges = await db.select({ courseId: userCourseProgress.courseId, badgeEarnedAt: userCourseProgress.badgeEarnedAt })
    .from(userCourseProgress)
    .where(and(eq(userCourseProgress.userId, session.user.id), sql`${userCourseProgress.badgeEarnedAt} IS NOT NULL`))
    .limit(10);
  const uniqueBadgeCourseIds = [...new Set(badges.map(b => b.courseId))];
  const earnedBadges = uniqueBadgeCourseIds.length > 0
    ? await db.select({ id: courses.id, badgeLabel: courses.badgeLabel, badgeColor: courses.badgeColor })
        .from(courses).where(sql`${courses.id} = ANY(${uniqueBadgeCourseIds})`)
    : [];

  // Recommended jobs: match by employment category, then skills in title
  const seekerCategory = profile?.employmentCategory || "";
  const seekerSkills = profile?.skills || [];
  const matched = openJobs
    .filter(j => {
      if (seekerCategory && j.category === seekerCategory) return true;
      if (seekerSkills.some(s => j.title.toLowerCase().includes(s.toLowerCase()))) return true;
      return false;
    })
    .slice(0, 6);
  // If not enough matches, pad with recent jobs
  const recommended = matched.length >= 4 ? matched : [...matched, ...openJobs.filter(j => !matched.includes(j)).slice(0, 6 - matched.length)];

  return {
    totalApplications: apps.length,
    activeApplications: apps.filter((a) => !["selected", "rejected"].includes(a.status || "")).length,
    selectedCount: apps.filter((a) => a.status === "selected").length,
    rejectedCount: apps.filter((a) => a.status === "rejected").length,
    savedOpportunities: saved.length,
    savedJobs: savedJobCount.length,
    openJobsCount: openJobs.length,
    profileComplete: !!(
      profile?.currentJobTitle &&
      profile?.employmentCategory &&
      profile?.skills?.length
    ),
    profile,
    earnedBadges,
    recommendedJobs: recommended.map(j => ({ id: j.id, title: j.title, company: j.company, category: j.category })),
  };
}

// ─── USER PROFILE & AVATAR ──────────────────────────────────────

export async function fetchUserSettings() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const [user] = await db.select({
    name: users.name,
    email: users.email,
    phone: users.phone,
    avatarUrl: users.avatarUrl,
    linkedinUrl: users.linkedinUrl,
    twitterUrl: users.twitterUrl,
    websiteUrl: users.websiteUrl,
    affiliatePayoutEmail: users.affiliatePayoutEmail,
  }).from(users).where(eq(users.id, session.user.id)).limit(1);
  return user;
}

export async function updateUserSettings(data: {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  affiliatePayoutEmail?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await db.update(users).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
    ...(data.linkedinUrl !== undefined ? { linkedinUrl: data.linkedinUrl } : {}),
    ...(data.twitterUrl !== undefined ? { twitterUrl: data.twitterUrl } : {}),
    ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl } : {}),
    ...(data.affiliatePayoutEmail !== undefined ? { affiliatePayoutEmail: data.affiliatePayoutEmail } : {}),
    updatedAt: new Date(),
  }).where(eq(users.id, session.user.id));
}

// ─── NOTIFICATION PREFERENCES ────────────────────────────────────

export async function fetchUserNotificationPreferences() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return fetchNotifPrefs(session.user.id);
}

export async function updateUserNotificationPreferences(prefs: Record<string, boolean>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return updateNotifPrefs(session.user.id, prefs);
}

// ─── FEATURE PREFERENCES ─────────────────────────────────────────

export interface FeaturePreferences {
  smartMatching: boolean;
  opportunityAlerts: boolean;
  analytics: boolean;
  bidTracking: boolean;
}

const DEFAULT_PREFERENCES: FeaturePreferences = {
  smartMatching: true,
  opportunityAlerts: true,
  analytics: true,
  bidTracking: true,
};

export async function fetchFeaturePreferences(): Promise<FeaturePreferences> {
  const { tenant } = await getSessionTenant();
  if (!tenant.featurePreferences) return DEFAULT_PREFERENCES;
  try { return { ...DEFAULT_PREFERENCES, ...JSON.parse(tenant.featurePreferences as string) }; }
  catch { return DEFAULT_PREFERENCES; }
}

export async function updateFeaturePreferences(prefs: Partial<FeaturePreferences>) {
  const { tenantId, tenant } = await getSessionTenant();
  let current = DEFAULT_PREFERENCES;
  try { if (tenant.featurePreferences) current = { ...current, ...JSON.parse(tenant.featurePreferences as string) }; } catch {}

  const updated = { ...current, ...prefs };
  await db.update(tenants).set({ featurePreferences: JSON.stringify(updated) }).where(eq(tenants.id, tenantId));
  return updated;
}

// ─── SMART MATCHING ──────────────────────────────────────────────

export async function fetchMatchedOpportunities(limit = 20) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = ((session.user as any)?.userRole as string) ?? "filer";

  // Get user's profile keywords for matching
  let matchKeywords: string[] = [];

  if (userRole.includes("supplier")) {
    const profile = await db.query.supplierProfiles.findFirst({
      where: eq(supplierProfiles.userId, session.user.id),
    });
    matchKeywords = profile?.serviceCategories || [];
    if (profile?.legalName) matchKeywords.push(profile.legalName);
  } else if (userRole.includes("job_seeker")) {
    const profile = await db.query.jobSeekerProfiles.findFirst({
      where: eq(jobSeekerProfiles.userId, session.user.id),
    });
    matchKeywords = [
      ...(profile?.skills || []),
      profile?.employmentCategory,
      profile?.currentJobTitle,
    ].filter(Boolean) as string[];
  } else {
    // Filer — match based on entity service types and supplier categories
    try {
      const { tenantId } = await getSessionTenant();
      const ents = await db.select({ legalName: entities.legalName, companyType: entities.companyType }).from(entities).where(eq(entities.tenantId, tenantId));
      matchKeywords = ents.map(e => e.legalName).filter(Boolean) as string[];
    } catch { /* no tenant */ }
  }

  // Get active opportunities
  const allOpps = await db
    .select()
    .from(lcsOpportunities)
    .where(eq(lcsOpportunities.status, "active"))
    .orderBy(desc(lcsOpportunities.postedDate))
    .limit(200);

  if (matchKeywords.length === 0) return allOpps.slice(0, limit);

  // Score each opportunity by keyword match
  const scored = allOpps.map(opp => {
    let score = 0;
    const searchText = [
      opp.title, opp.description, opp.contractorName,
      opp.lcaCategory, opp.aiSummary,
    ].filter(Boolean).join(" ").toLowerCase();

    for (const keyword of matchKeywords) {
      if (searchText.includes(keyword.toLowerCase())) score += 10;
      // Partial word match
      const words = keyword.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && searchText.includes(word)) score += 3;
      }
    }

    return { ...opp, matchScore: score };
  });

  // Sort by score (highest first), then by date
  scored.sort((a, b) => b.matchScore - a.matchScore || (
    new Date(b.postedDate || 0).getTime() - new Date(a.postedDate || 0).getTime()
  ));

  return scored.slice(0, limit);
}

// ─── OPPORTUNITIES ANALYTICS ─────────────────────────────────────

export async function fetchOpportunityAnalytics() {
  const allOpps = await db.select().from(lcsOpportunities).limit(500);

  // Contractor breakdown
  const contractorCounts: Record<string, number> = {};
  for (const opp of allOpps) {
    contractorCounts[opp.contractorName] = (contractorCounts[opp.contractorName] || 0) + 1;
  }
  const topContractors = Object.entries(contractorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  // Notice type breakdown
  const typeCounts: Record<string, number> = {};
  for (const opp of allOpps) {
    const t = opp.noticeType || "Other";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const opp of allOpps) {
    if (opp.lcaCategory) {
      categoryCounts[opp.lcaCategory] = (categoryCounts[opp.lcaCategory] || 0) + 1;
    }
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Monthly trend (last 12 months)
  const monthlyTrend: Record<string, number> = {};
  for (const opp of allOpps) {
    if (opp.postedDate) {
      const month = opp.postedDate.slice(0, 7); // YYYY-MM
      monthlyTrend[month] = (monthlyTrend[month] || 0) + 1;
    }
  }

  // Status breakdown
  const active = allOpps.filter(o => o.status === "active").length;
  const expired = allOpps.filter(o => o.status === "expired").length;

  // Deadline stats
  const withDeadline = allOpps.filter(o => o.deadline);
  const avgDeadlineDays = withDeadline.length > 0
    ? Math.round(withDeadline.reduce((sum, o) => {
        const posted = new Date(o.postedDate || o.scrapedAt || new Date());
        const deadline = new Date(o.deadline!);
        return sum + Math.max(0, (deadline.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
      }, 0) / withDeadline.length)
    : null;

  return {
    totalNotices: allOpps.length,
    active,
    expired,
    topContractors,
    typeCounts,
    topCategories,
    monthlyTrend,
    avgDeadlineDays,
    withAiSummary: allOpps.filter(o => o.aiSummary).length,
  };
}

// ─── CONTRACTOR PROFILES ─────────────────────────────────────────

export async function fetchContractorProfile(contractorName: string) {
  const notices = await db
    .select()
    .from(lcsOpportunities)
    .where(eq(lcsOpportunities.contractorName, contractorName))
    .orderBy(desc(lcsOpportunities.postedDate));

  if (notices.length === 0) return null;

  // Extract unique categories
  const categories = [...new Set(notices.map(n => n.lcaCategory).filter(Boolean))];
  const noticeTypes = [...new Set(notices.map(n => n.noticeType).filter(Boolean))];

  // Contact info from AI summaries
  const contacts: Array<{ name?: string; email?: string; phone?: string }> = [];
  for (const n of notices) {
    if (n.aiSummary) {
      try {
        const parsed = JSON.parse(n.aiSummary);
        if (parsed.contact_email || parsed.contact_emails || parsed.contact_name) {
          contacts.push({
            name: parsed.contact_name || undefined,
            email: parsed.contact_email || (parsed.contact_emails?.[0]) || undefined,
            phone: parsed.contact_phone || undefined,
          });
        }
      } catch {}
    }
  }

  // Deduplicate contacts by email
  const uniqueContacts = contacts.filter((c, i, arr) =>
    c.email ? arr.findIndex(x => x.email === c.email) === i : i === 0
  ).slice(0, 5);

  return {
    contractorName,
    totalNotices: notices.length,
    activeNotices: notices.filter(n => n.status === "active").length,
    categories,
    noticeTypes,
    contacts: uniqueContacts,
    firstNotice: notices[notices.length - 1]?.postedDate,
    latestNotice: notices[0]?.postedDate,
    notices: notices.slice(0, 20), // Latest 20
  };
}

// ─── SUPPORT TICKETS ─────────────────────────────────────────────

export async function createSupportTicket(data: {
  subject: string;
  description: string;
  category?: string;
  priority?: string;
  screenshotUrls?: string[];
  pageUrl?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  let tenantId: string | null = null;
  try { const ctx = await getSessionTenant(); tenantId = ctx.tenantId; } catch {}

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId: session.user.id,
      tenantId,
      subject: data.subject,
      description: data.description,
      category: data.category || "general",
      priority: data.priority || "normal",
      screenshotUrls: data.screenshotUrls?.length ? JSON.stringify(data.screenshotUrls) : null,
      pageUrl: data.pageUrl || null,
    })
    .returning();

  return ticket;
}

export async function fetchMyTickets() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(50);
}

export async function fetchTicketWithReplies(ticketId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, session.user.id)))
    .limit(1);

  if (!ticket) return null;

  const replies = await db
    .select({
      id: ticketReplies.id,
      message: ticketReplies.message,
      isAdmin: ticketReplies.isAdmin,
      createdAt: ticketReplies.createdAt,
      userName: users.name,
    })
    .from(ticketReplies)
    .innerJoin(users, eq(ticketReplies.userId, users.id))
    .where(eq(ticketReplies.ticketId, ticketId))
    .orderBy(ticketReplies.createdAt);

  return { ticket, replies };
}

export async function addTicketReply(ticketId: string, message: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Verify ticket belongs to user (or user is admin)
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error("Ticket not found");

  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const isAdmin = !!user?.isSuperAdmin;

  if (ticket.userId !== session.user.id && !isAdmin) throw new Error("Not authorized");

  const [reply] = await db
    .insert(ticketReplies)
    .values({
      ticketId,
      userId: session.user.id,
      message,
      isAdmin,
    })
    .returning();

  // Reopen ticket if user replies to a resolved ticket
  if (ticket.status === "resolved" || ticket.status === "closed") {
    await db.update(supportTickets).set({ status: "open", updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
  }

  return reply;
}

// ─── COMPLIANCE REPORTING & ANALYTICS ────────────────────────────

export async function fetchComplianceAnalytics() {
  const { tenantId } = await getSessionTenant();

  // Get all entities
  const allEntities = await db.select().from(entities)
    .where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)));

  // Get all periods with data
  const allPeriods = await db.select().from(reportingPeriods)
    .where(eq(reportingPeriods.tenantId, tenantId))
    .orderBy(reportingPeriods.periodStart);

  // Get all records across all periods
  const allExpenditures = await db.select().from(expenditureRecords)
    .where(eq(expenditureRecords.tenantId, tenantId));
  const allEmployment = await db.select().from(employmentRecords)
    .where(eq(employmentRecords.tenantId, tenantId));
  const allCapacity = await db.select().from(capacityDevelopmentRecords)
    .where(eq(capacityDevelopmentRecords.tenantId, tenantId));

  // ── Local Content Rate by Period ──
  const lcRateTrend = allPeriods.map(p => {
    const periodExp = allExpenditures.filter(e => e.reportingPeriodId === p.id);
    const total = periodExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guyanese = periodExp.filter(e => !!e.supplierCertificateId)
      .reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const label = p.reportType === "half_yearly_h1" ? `H1 ${p.fiscalYear}` :
      p.reportType === "half_yearly_h2" ? `H2 ${p.fiscalYear}` :
      `${p.fiscalYear}`;
    return {
      period: label,
      periodId: p.id,
      entityId: p.entityId,
      totalExpenditure: total,
      guyaneseExpenditure: guyanese,
      lcRate: total > 0 ? Math.round((guyanese / total) * 1000) / 10 : 0,
      status: p.status,
    };
  });

  // ── Employment by Category across all periods ──
  const empByCategory = ["Managerial", "Technical", "Non-Technical"].map(cat => {
    const filtered = allEmployment.filter(e => e.employmentCategory === cat);
    const total = filtered.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyanese = filtered.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
    return {
      category: cat,
      total,
      guyanese,
      pct: total > 0 ? Math.round((guyanese / total) * 1000) / 10 : 0,
    };
  });

  // ── Employment trend by period ──
  const empTrend = allPeriods.map(p => {
    const periodEmp = allEmployment.filter(e => e.reportingPeriodId === p.id);
    const total = periodEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyanese = periodEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
    const label = p.reportType === "half_yearly_h1" ? `H1 ${p.fiscalYear}` :
      p.reportType === "half_yearly_h2" ? `H2 ${p.fiscalYear}` : `${p.fiscalYear}`;
    return {
      period: label,
      total,
      guyanese,
      pct: total > 0 ? Math.round((guyanese / total) * 1000) / 10 : 0,
    };
  });

  // ── Expenditure by sector ──
  const sectorSpend: Record<string, number> = {};
  for (const e of allExpenditures) {
    const sector = e.relatedSector || "Uncategorized";
    sectorSpend[sector] = (sectorSpend[sector] || 0) + Number(e.actualPayment || 0);
  }
  const topSectors = Object.entries(sectorSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => ({ name, amount }));

  // ── Expenditure by payment method ──
  const paymentMethods: Record<string, number> = {};
  for (const e of allExpenditures) {
    const method = e.paymentMethod || "Not specified";
    paymentMethods[method] = (paymentMethods[method] || 0) + Number(e.actualPayment || 0);
  }

  // ── Expenditure by bank location ──
  const bankLocations: Record<string, number> = {};
  for (const e of allExpenditures) {
    const loc = e.bankLocationCountry || "Not specified";
    bankLocations[loc] = (bankLocations[loc] || 0) + Number(e.actualPayment || 0);
  }

  // ── Supplier breakdown ──
  const guyaneseSuppliers = new Set(allExpenditures.filter(e => !!e.supplierCertificateId).map(e => e.supplierName));
  const intlSuppliers = new Set(allExpenditures.filter(e => !e.supplierCertificateId).map(e => e.supplierName));

  // ── Top suppliers by spend ──
  const supplierSpend: Record<string, { amount: number; guyanese: boolean }> = {};
  for (const e of allExpenditures) {
    if (!supplierSpend[e.supplierName]) {
      supplierSpend[e.supplierName] = { amount: 0, guyanese: !!e.supplierCertificateId };
    }
    supplierSpend[e.supplierName].amount += Number(e.actualPayment || 0);
  }
  const topSuppliers = Object.entries(supplierSpend)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([name, data]) => ({ name, amount: data.amount, guyanese: data.guyanese }));

  // ── Capacity development summary ──
  const totalTrainingSpend = allCapacity.reduce((s, c) => s + Number(c.expenditureOnCapacity || 0), 0);
  const totalParticipants = allCapacity.reduce((s, c) => s + (c.totalParticipants || 0), 0);
  const guyaneseParticipants = allCapacity.reduce((s, c) => s + (c.guyanaeseParticipantsOnly || 0), 0);
  const totalTrainingDays = allCapacity.reduce((s, c) => s + (c.durationDays || 0), 0);

  // ── Deadline compliance ──
  const submittedOnTime = allPeriods.filter(p =>
    p.status === "submitted" && p.submittedAt && new Date(p.submittedAt) <= new Date(p.dueDate)
  ).length;
  const submittedLate = allPeriods.filter(p =>
    p.status === "submitted" && p.submittedAt && new Date(p.submittedAt) > new Date(p.dueDate)
  ).length;
  const overdue = allPeriods.filter(p =>
    p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) < new Date()
  ).length;
  const upcoming = allPeriods.filter(p =>
    p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) >= new Date()
  ).length;

  // ── Projection vs Actual ──
  const projectionVsActual = allPeriods.map(p => {
    const periodExp = allExpenditures.filter(e => e.reportingPeriodId === p.id);
    const actual = periodExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const projected = periodExp.reduce((s, e) => s + Number(e.projectionNextPeriod || 0), 0);
    const label = p.reportType === "half_yearly_h1" ? `H1 ${p.fiscalYear}` :
      p.reportType === "half_yearly_h2" ? `H2 ${p.fiscalYear}` : `${p.fiscalYear}`;
    return { period: label, actual, projected };
  }).filter(p => p.actual > 0 || p.projected > 0);

  // ── Entity scorecard ──
  const entityScorecard = allEntities.map(entity => {
    const entityPeriods = allPeriods.filter(p => p.entityId === entity.id);
    const entityExp = allExpenditures.filter(e => e.entityId === entity.id);
    const entityEmp = allEmployment.filter(e => e.entityId === entity.id);
    const totalSpend = entityExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guySpend = entityExp.filter(e => !!e.supplierCertificateId)
      .reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const totalHead = entityEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyHead = entityEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);

    return {
      entityId: entity.id,
      entityName: entity.legalName,
      companyType: entity.companyType,
      periodsCount: entityPeriods.length,
      submittedCount: entityPeriods.filter(p => p.status === "submitted" || p.status === "acknowledged").length,
      lcRate: totalSpend > 0 ? Math.round((guySpend / totalSpend) * 1000) / 10 : 0,
      totalExpenditure: totalSpend,
      totalEmployees: totalHead,
      guyaneseEmployees: guyHead,
      guyaneseEmployeePct: totalHead > 0 ? Math.round((guyHead / totalHead) * 1000) / 10 : 0,
    };
  });

  // ── Hiring pipeline (from job postings) ──
  const allJobPostings = await db.select().from(jobPostings).where(eq(jobPostings.tenantId, tenantId));
  const totalPosted = allJobPostings.length;
  const totalFilled = allJobPostings.filter(j => j.status === "filled").length;

  // Fetch all applications for this tenant's postings in one query
  const postingIds = allJobPostings.map(p => p.id);
  const allApps = postingIds.length > 0
    ? await db.select().from(jobApplications).where(
        sql`${jobApplications.jobPostingId} = ANY(${postingIds})`
      )
    : [];
  const totalApplications = allApps.length;
  const guyaneseApplications = allApps.filter(a => a.isGuyanese).length;
  const guyaneseHired = allApps.filter(a => a.status === "selected" && a.isGuyanese).length;

  return {
    // Overview
    entityCount: allEntities.length,
    periodCount: allPeriods.length,
    totalExpenditure: allExpenditures.reduce((s, e) => s + Number(e.actualPayment || 0), 0),
    totalEmployees: allEmployment.reduce((s, e) => s + (e.totalEmployees || 0), 0),

    // Trends
    lcRateTrend,
    empTrend,
    projectionVsActual,

    // Employment
    empByCategory,
    employmentMinimums: { managerial: 75, technical: 60, non_technical: 80 },

    // Expenditure
    topSectors,
    topSuppliers,
    paymentMethods,
    bankLocations,
    supplierCount: { guyanese: guyaneseSuppliers.size, international: intlSuppliers.size },

    // Capacity
    capacity: { totalTrainingSpend, totalParticipants, guyaneseParticipants, totalTrainingDays, activities: allCapacity.length },

    // Deadline compliance
    deadlineCompliance: { submittedOnTime, submittedLate, overdue, upcoming },

    // Entity scorecard
    entityScorecard,

    // Hiring pipeline
    hiringPipeline: { totalPosted, totalFilled, totalApplications, guyaneseApplications, guyaneseHired },
  };
}

// ─── COMPANY PROFILES ────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export async function aggregateCompanyProfiles() {
  // Get all unique companies from ALL data sources
  const opps = await db.select({ name: lcsOpportunities.contractorName }).from(lcsOpportunities).limit(500);
  const jobs = await db.select({ name: lcsEmploymentNotices.companyName }).from(lcsEmploymentNotices).limit(500);
  const register = await db.select().from(lcsRegister).limit(2000);

  // Build unified company map: name → LCS register data (if any)
  const companyMap = new Map<string, typeof register[number] | null>();

  // Add from opportunities + jobs
  for (const o of opps) if (o.name && o.name !== "Unknown") companyMap.set(o.name, null);
  for (const j of jobs) if (j.name && j.name !== "Unknown") companyMap.set(j.name, null);

  // Add ALL LCS register companies (this is the big one — 700+)
  for (const r of register) {
    companyMap.set(r.legalName, r);
    // Also try trading name
    if (r.tradingName && r.tradingName !== r.legalName) {
      if (!companyMap.has(r.tradingName)) companyMap.set(r.tradingName, r);
    }
  }

  // Cross-reference: link opportunity/job companies to LCS register
  for (const [name] of companyMap) {
    if (!companyMap.get(name)) {
      const match = register.find(r =>
        r.legalName.toLowerCase() === name.toLowerCase() ||
        r.tradingName?.toLowerCase() === name.toLowerCase() ||
        r.legalName.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(r.legalName.toLowerCase())
      );
      if (match) companyMap.set(name, match);
    }
  }

  let created = 0;
  let updated = 0;

  for (const [companyName, lcsData] of companyMap) {
    const slug = slugify(companyName);

    // Count opportunities + jobs
    const companyOpps = opps.filter(o => o.name === companyName);
    const companyJobs = jobs.filter(j => j.name === companyName);
    const activeOpps = await db.select({ id: lcsOpportunities.id })
      .from(lcsOpportunities)
      .where(and(eq(lcsOpportunities.contractorName, companyName), eq(lcsOpportunities.status, "active")))
      .limit(200);
    const openJobs = await db.select({ id: lcsEmploymentNotices.id })
      .from(lcsEmploymentNotices)
      .where(and(eq(lcsEmploymentNotices.companyName, companyName), eq(lcsEmploymentNotices.status, "open")))
      .limit(200);

    // Aggregate contact info from AI summaries
    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();
    const nameSet = new Set<string>();
    const procCats = new Set<string>();
    const empCats = new Set<string>();

    const oppDetails = await db.select({ aiSummary: lcsOpportunities.aiSummary, lcaCategory: lcsOpportunities.lcaCategory })
      .from(lcsOpportunities).where(eq(lcsOpportunities.contractorName, companyName)).limit(50);
    for (const o of oppDetails) {
      if (o.lcaCategory) procCats.add(o.lcaCategory);
      if (o.aiSummary) {
        try {
          const s = JSON.parse(o.aiSummary);
          if (s.contact_emails) s.contact_emails.forEach((e: string) => emailSet.add(e));
          if (s.contact_email) {
            const found = String(s.contact_email).match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
            if (found) found.forEach(e => emailSet.add(e));
          }
          if (s.contact_phone) phoneSet.add(s.contact_phone);
          if (s.contact_name) nameSet.add(s.contact_name);
        } catch {}
      }
    }

    const jobDetails = await db.select({ aiSummary: lcsEmploymentNotices.aiSummary, employmentCategory: lcsEmploymentNotices.employmentCategory })
      .from(lcsEmploymentNotices).where(eq(lcsEmploymentNotices.companyName, companyName)).limit(50);
    for (const j of jobDetails) {
      if (j.employmentCategory) empCats.add(j.employmentCategory);
      if (j.aiSummary) {
        try { const s = JSON.parse(j.aiSummary); if (s.contact_email) emailSet.add(s.contact_email); } catch {}
      }
    }

    // Add LCS register contact info
    if (lcsData) {
      if (lcsData.email) emailSet.add(lcsData.email);
      if (lcsData.phone) phoneSet.add(lcsData.phone);
      if (lcsData.serviceCategories) lcsData.serviceCategories.forEach(c => procCats.add(c));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileData: Record<string, any> = {
      companyName,
      legalName: lcsData?.legalName || companyName,
      website: lcsData?.website || null,
      totalOpportunities: companyOpps.length,
      activeOpportunities: activeOpps.length,
      totalJobPostings: companyJobs.length,
      openJobPostings: openJobs.length,
      contactEmails: emailSet.size > 0 ? JSON.stringify([...emailSet]) : null,
      contactPhones: phoneSet.size > 0 ? JSON.stringify([...phoneSet]) : null,
      contactNames: nameSet.size > 0 ? JSON.stringify([...nameSet]) : null,
      procurementCategories: [...procCats],
      employmentCategories: [...empCats],
      // LCS register data
      lcsCertId: lcsData?.certId || null,
      lcsRegistered: !!lcsData,
      lcsStatus: lcsData?.status || null,
      lcsExpirationDate: lcsData?.expirationDate || null,
      lcsEmail: lcsData?.email || null,
      lcsPhone: lcsData?.phone || null,
      lcsAddress: lcsData?.address || null,
      lcsServiceCategories: lcsData?.serviceCategories || [],
      lastAggregatedAt: new Date(),
      updatedAt: new Date(),
    };

    // Upsert — don't overwrite claimed profiles' manual edits
    const [existing] = await db.select({ id: companyProfiles.id, claimed: companyProfiles.claimed })
      .from(companyProfiles).where(eq(companyProfiles.slug, slug)).limit(1);

    if (existing) {
      // Don't overwrite contact info on claimed profiles
      if (existing.claimed) {
        delete profileData.contactEmails;
        delete profileData.contactPhones;
        delete profileData.contactNames;
        delete profileData.website;
      }
      await db.update(companyProfiles).set(profileData).where(eq(companyProfiles.id, existing.id));
      updated++;
    } else {
      await db.insert(companyProfiles).values({ ...profileData, slug, companyName });
      created++;
    }
  }

  return { created, updated, total: companyMap.size };
}

export async function fetchCompanyProfile(slug: string) {
  const [profile] = await db.select().from(companyProfiles)
    .where(eq(companyProfiles.slug, slug)).limit(1);
  if (!profile) return null;

  // Get linked data
  const opportunities = await db.select()
    .from(lcsOpportunities)
    .where(eq(lcsOpportunities.contractorName, profile.companyName))
    .orderBy(desc(lcsOpportunities.postedDate))
    .limit(20);

  const jobPostings = await db.select()
    .from(lcsEmploymentNotices)
    .where(eq(lcsEmploymentNotices.companyName, profile.companyName))
    .orderBy(desc(lcsEmploymentNotices.postedDate))
    .limit(20);

  return { profile, opportunities, jobPostings };
}

export async function fetchAllCompanyProfiles() {
  return db.select().from(companyProfiles)
    .orderBy(desc(companyProfiles.totalOpportunities))
    .limit(1000);
}

export async function claimCompanyProfile(profileId: string, verification?: {
  method: "email_domain" | "lcs_cert" | "manual";
  lcsCertId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [profile] = await db.select().from(companyProfiles)
    .where(eq(companyProfiles.id, profileId)).limit(1);
  if (!profile) throw new Error("Profile not found");
  if (profile.claimed) throw new Error("This company has already been claimed");

  const [user] = await db.select({ email: users.email }).from(users)
    .where(eq(users.id, session.user.id)).limit(1);

  let tenantId: string | null = null;
  try { const ctx = await getSessionTenant(); tenantId = ctx.tenantId; } catch {}

  // Verification logic
  let verified = false;
  let verificationMethod: string | null = null;
  let verificationNotes: string | null = null;

  if (verification?.method === "email_domain") {
    // Auto-verify if user's email domain matches the company's known email domain
    const userDomain = user?.email?.split("@")[1]?.toLowerCase();
    const companyEmails = profile.contactEmails ? JSON.parse(profile.contactEmails) as string[] : [];
    const lcsEmail = profile.lcsEmail;
    const allDomains = new Set<string>();
    for (const e of companyEmails) { const d = e.split("@")[1]?.toLowerCase(); if (d) allDomains.add(d); }
    if (lcsEmail) { const d = lcsEmail.split("@")[1]?.toLowerCase(); if (d) allDomains.add(d); }

    if (userDomain && allDomains.has(userDomain)) {
      verified = true;
      verificationMethod = "email_domain";
      verificationNotes = `Verified: ${user?.email} matches company domain`;
    } else {
      verificationMethod = "email_domain";
      verificationNotes = `Pending: ${user?.email} does not match known domains (${[...allDomains].join(", ") || "none on file"})`;
    }
  } else if (verification?.method === "lcs_cert" && verification.lcsCertId) {
    // Verify by LCS certificate ID match
    if (profile.lcsCertId && profile.lcsCertId === verification.lcsCertId) {
      verified = true;
      verificationMethod = "lcs_cert";
      verificationNotes = `Verified: LCS Certificate ${verification.lcsCertId} matches`;
    } else {
      // Check the register directly
      const [regMatch] = await db.select().from(lcsRegister)
        .where(eq(lcsRegister.certId, verification.lcsCertId)).limit(1);
      if (regMatch && regMatch.legalName.toLowerCase() === profile.companyName.toLowerCase()) {
        verified = true;
        verificationMethod = "lcs_cert";
        verificationNotes = `Verified: LCS Certificate ${verification.lcsCertId} matches ${regMatch.legalName}`;
      } else {
        verificationMethod = "lcs_cert";
        verificationNotes = `Pending review: Certificate ${verification.lcsCertId} provided but doesn't match records`;
      }
    }
  } else {
    verificationMethod = "manual";
    verificationNotes = "Pending manual verification by LCA Desk team";
  }

  const [updated] = await db.update(companyProfiles).set({
    claimed: true,
    claimedBy: session.user.id,
    claimedAt: new Date(),
    tenantId,
    verified,
    verifiedAt: verified ? new Date() : null,
    verificationMethod,
    verificationNotes,
    updatedAt: new Date(),
  }).where(eq(companyProfiles.id, profileId)).returning();

  return updated;
}

export async function searchLcsRegister(query: string) {
  if (!query || query.length < 2) return [];
  const results = await db.select({
    certId: lcsRegister.certId,
    legalName: lcsRegister.legalName,
    tradingName: lcsRegister.tradingName,
    status: lcsRegister.status,
    serviceCategories: lcsRegister.serviceCategories,
  }).from(lcsRegister).limit(500);

  const q = query.toLowerCase();
  return results.filter(r =>
    r.legalName.toLowerCase().includes(q) ||
    r.tradingName?.toLowerCase().includes(q) ||
    r.certId?.toLowerCase().includes(q)
  ).slice(0, 20);
}

// ─── LCS JOBS FOR SEEKER ─────────────────────────────────────────

export async function fetchLcsJobs(filters?: { search?: string; category?: string; status?: string }) {
  const results = await db.select().from(lcsEmploymentNotices)
    .orderBy(desc(lcsEmploymentNotices.scrapedAt))
    .limit(200);

  let filtered = results;
  if (filters?.status) filtered = filtered.filter(j => j.status === filters.status);
  if (filters?.category) filtered = filtered.filter(j => j.employmentCategory === filters.category);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(j =>
      j.jobTitle.toLowerCase().includes(q) ||
      j.companyName.toLowerCase().includes(q) ||
      j.description?.toLowerCase().includes(q) ||
      j.aiSummary?.toLowerCase().includes(q)
    );
  }
  return filtered;
}

// ─── COMPLIANCE HEALTH MONITORING ────────────────────────────────

export async function fetchComplianceHealth() {
  const { tenantId } = await getSessionTenant();

  const allEntities = await db.select().from(entities)
    .where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)));

  const allPeriods = await db.select().from(reportingPeriods)
    .where(eq(reportingPeriods.tenantId, tenantId))
    .orderBy(desc(reportingPeriods.periodEnd));

  const allExp = await db.select().from(expenditureRecords)
    .where(eq(expenditureRecords.tenantId, tenantId));
  const allEmp = await db.select().from(employmentRecords)
    .where(eq(employmentRecords.tenantId, tenantId));

  // Current LC rate
  const totalSpend = allExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const guySpend = allExp.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const lcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 1000) / 10 : 0;

  // Employment rates by category
  const empByCategory = (cat: string) => {
    const filtered = allEmp.filter(e => e.employmentCategory === cat);
    const total = filtered.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyanese = filtered.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
    return { total, guyanese, pct: total > 0 ? Math.round((guyanese / total) * 1000) / 10 : 0 };
  };
  const managerial = empByCategory("Managerial");
  const technical = empByCategory("Technical");
  const nonTechnical = empByCategory("Non-Technical");

  // Supplier cert expiry warnings
  const supplierCerts = [...new Set(allExp.filter(e => e.supplierCertificateId).map(e => e.supplierCertificateId))];
  const expiringCerts: Array<{ certId: string; supplierName: string; expiresAt: string; daysLeft: number }> = [];
  for (const certId of supplierCerts) {
    if (!certId) continue;
    const [reg] = await db.select({ expirationDate: lcsRegister.expirationDate, legalName: lcsRegister.legalName })
      .from(lcsRegister).where(eq(lcsRegister.certId, certId)).limit(1);
    if (reg?.expirationDate) {
      const daysLeft = Math.ceil((new Date(reg.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 90) {
        const supplierName = allExp.find(e => e.supplierCertificateId === certId)?.supplierName || reg.legalName;
        expiringCerts.push({ certId, supplierName, expiresAt: reg.expirationDate, daysLeft });
      }
    }
  }
  expiringCerts.sort((a, b) => a.daysLeft - b.daysLeft);

  // Upcoming deadlines
  const now = new Date();
  const upcomingDeadlines = allPeriods
    .filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) > now)
    .map(p => ({
      periodId: p.id,
      entityId: p.entityId,
      entityName: allEntities.find(e => e.id === p.entityId)?.legalName || "Unknown",
      reportType: p.reportType,
      dueDate: p.dueDate,
      daysLeft: Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      status: p.status,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  // Overdue
  const overduePeriods = allPeriods
    .filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) < now)
    .map(p => ({
      periodId: p.id,
      entityName: allEntities.find(e => e.id === p.entityId)?.legalName || "Unknown",
      reportType: p.reportType,
      dueDate: p.dueDate,
      daysOverdue: Math.ceil((now.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
    }));

  // LC rate trend (last 4 periods)
  const periodRates = allPeriods.slice(0, 4).map(p => {
    const periodExp = allExp.filter(e => e.reportingPeriodId === p.id);
    const total = periodExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guy = periodExp.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const label = p.reportType === "half_yearly_h1" ? `H1 ${p.fiscalYear}` : p.reportType === "half_yearly_h2" ? `H2 ${p.fiscalYear}` : `${p.fiscalYear}`;
    return { period: label, rate: total > 0 ? Math.round((guy / total) * 1000) / 10 : 0 };
  }).reverse();

  // Compliance score (0-100)
  const empMin = { managerial: 75, technical: 60, non_technical: 80 };
  const empScore = [
    managerial.pct >= empMin.managerial ? 25 : (managerial.pct / empMin.managerial) * 25,
    technical.pct >= empMin.technical ? 25 : (technical.pct / empMin.technical) * 25,
    nonTechnical.pct >= empMin.non_technical ? 25 : (nonTechnical.pct / empMin.non_technical) * 25,
    lcRate >= 50 ? 25 : (lcRate / 50) * 25,
  ].reduce((s, v) => s + v, 0);
  const complianceScore = Math.round(empScore);

  // New opportunities matching their procurement categories
  const entityCategories = new Set<string>();
  allExp.forEach(e => { if (e.relatedSector) entityCategories.add(e.relatedSector); });

  let matchingOpportunities = 0;
  if (entityCategories.size > 0) {
    const recentOpps = await db.select({ lcaCategory: lcsOpportunities.lcaCategory })
      .from(lcsOpportunities)
      .where(eq(lcsOpportunities.status, "active"))
      .limit(200);
    matchingOpportunities = recentOpps.filter(o =>
      o.lcaCategory && entityCategories.has(o.lcaCategory)
    ).length;
  }

  return {
    complianceScore,
    lcRate,
    lcRateTrend: periodRates,
    employment: {
      managerial, technical, nonTechnical,
      minimums: empMin,
    },
    expiringCerts: expiringCerts.slice(0, 5),
    upcomingDeadlines,
    overduePeriods,
    matchingOpportunities,
    totalEntities: allEntities.length,
    totalEmployees: allEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0),
    totalExpenditure: totalSpend,
  };
}

// ─── PAYMENT LOG (Lightweight Procurement Tracker) ───────────────

export async function addPaymentLog(data: {
  supplierName: string;
  supplierType?: string;
  supplierCertificateId?: string;
  amount: string;
  currency?: string;
  description?: string;
  category?: string;
  paymentDate?: string;
  invoiceRef?: string;
  entityId?: string;
}) {
  const { tenantId } = await getSessionTenant();
  const [entry] = await db.insert(paymentLog).values({
    tenantId,
    entityId: data.entityId || null,
    supplierName: data.supplierName,
    supplierType: data.supplierType || null,
    supplierCertificateId: data.supplierCertificateId || null,
    amount: data.amount,
    currency: data.currency || "GYD",
    description: data.description || null,
    category: data.category || null,
    paymentDate: data.paymentDate || new Date().toISOString().slice(0, 10),
    invoiceRef: data.invoiceRef || null,
  }).returning();
  return entry;
}

export async function fetchPaymentLog() {
  const { tenantId } = await getSessionTenant();
  return db.select().from(paymentLog)
    .where(eq(paymentLog.tenantId, tenantId))
    .orderBy(desc(paymentLog.createdAt))
    .limit(100);
}

export async function fetchPaymentLogStats() {
  const { tenantId } = await getSessionTenant();
  const entries = await db.select().from(paymentLog)
    .where(and(eq(paymentLog.tenantId, tenantId), eq(paymentLog.imported, false)))
    .limit(500);

  const total = entries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const guyanese = entries.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.amount || 0), 0);
  const lcRate = total > 0 ? Math.round((guyanese / total) * 1000) / 10 : 0;

  return {
    unimportedCount: entries.length,
    totalSpend: total,
    guyaneseSpend: guyanese,
    lcRate,
    thisMonth: entries.filter(e => {
      const d = e.paymentDate || e.createdAt?.toISOString().slice(0, 10);
      return d && d.startsWith(new Date().toISOString().slice(0, 7));
    }).length,
  };
}

// ─── STAKEHOLDER MANAGEMENT ─────────────────────────────────────

export async function fetchStakeholders() {
  const { tenant } = await getSessionTenant();
  if (!tenant.stakeholderEmails) return [];
  try { return JSON.parse(tenant.stakeholderEmails as string); } catch { return []; }
}

export async function updateStakeholders(stakeholders: Array<{ email: string; name: string; role: string }>) {
  const { tenantId } = await getSessionTenant();
  await db.update(tenants).set({
    stakeholderEmails: JSON.stringify(stakeholders),
  }).where(eq(tenants.id, tenantId));
  return stakeholders;
}

// ─── TALENT POOL ─────────────────────────────────────────────────

export async function fetchTalentPool(filters?: {
  search?: string;
  category?: string;
  guyaneseOnly?: boolean;
  location?: string;
}) {
  // Check caller's plan + demo status
  let callerIsPro = false;
  let callerIsDemo = false;
  try {
    const session = await auth();
    if (session?.user?.id) {
      const [u] = await db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, session.user.id)).limit(1);
      callerIsDemo = !!u?.isDemo;
    }
    const { plan, trialEndsAt } = await getSessionTenant();
    const effective = getEffectivePlan(plan, trialEndsAt);
    callerIsPro = effective.code === "pro" || effective.code === "enterprise";
  } catch {}

  const profiles = await db
    .select({
      id: jobSeekerProfiles.id,
      userId: jobSeekerProfiles.userId,
      currentJobTitle: jobSeekerProfiles.currentJobTitle,
      employmentCategory: jobSeekerProfiles.employmentCategory,
      yearsExperience: jobSeekerProfiles.yearsExperience,
      isGuyanese: jobSeekerProfiles.isGuyanese,
      nationality: jobSeekerProfiles.nationality,
      skills: jobSeekerProfiles.skills,
      locationPreference: jobSeekerProfiles.locationPreference,
      contractTypePreference: jobSeekerProfiles.contractTypePreference,
      headline: jobSeekerProfiles.headline,
      cvUrl: jobSeekerProfiles.cvUrl,
      resumeContent: jobSeekerProfiles.resumeContent,
      educationLevel: jobSeekerProfiles.educationLevel,
      educationField: jobSeekerProfiles.educationField,
      certifications: jobSeekerProfiles.certifications,
      guyaneseStatus: jobSeekerProfiles.guyaneseStatus,
      lcaAttestationDate: jobSeekerProfiles.lcaAttestationDate,
      userName: users.name,
      userEmail: users.email,
    })
    .from(jobSeekerProfiles)
    .innerJoin(users, eq(jobSeekerProfiles.userId, users.id))
    .where(eq(jobSeekerProfiles.profileVisible, true))
    .limit(200);

  // Filter: demo users only see demo candidates, real users only see real candidates
  const demoFilter = await getDemoFilter();
  const filteredProfiles = profiles.filter(p => demoFilter.includeUser(p.userId));

  // Get badges for all visible users
  const allUserIds = filteredProfiles.map(p => p.userId);
  const allBadges = allUserIds.length > 0
    ? await db.select({
        userId: userCourseProgress.userId,
        badgeLabel: courses.badgeLabel,
      }).from(userCourseProgress)
        .innerJoin(courses, eq(userCourseProgress.courseId, courses.id))
        .where(sql`${userCourseProgress.badgeEarnedAt} IS NOT NULL`)
        .limit(500)
    : [];

  // Strip contact info for non-Pro callers + add badges
  const sanitized = filteredProfiles.map(p => {
    const userBadges = allBadges
      .filter(b => b.userId === p.userId)
      .map(b => b.badgeLabel)
      .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
    return {
      ...p,
      userEmail: callerIsPro ? p.userEmail : null,
      cvUrl: callerIsPro ? p.cvUrl : null,
      resumeContent: callerIsPro ? p.resumeContent : null,
      lcaAttested: !!p.lcaAttestationDate,
      badges: userBadges,
    };
  });

  let filtered = sanitized;

  if (filters?.guyaneseOnly) filtered = filtered.filter(p => p.isGuyanese);
  if (filters?.category) filtered = filtered.filter(p => p.employmentCategory === filters.category);
  if (filters?.location) filtered = filtered.filter(p => p.locationPreference === filters.location || p.locationPreference === "Any");
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.currentJobTitle?.toLowerCase().includes(q) ||
      p.userName?.toLowerCase().includes(q) ||
      p.headline?.toLowerCase().includes(q) ||
      p.skills?.some(s => s.toLowerCase().includes(q)) ||
      p.employmentCategory?.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export async function toggleProfileVisibility(visible: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.update(jobSeekerProfiles).set({
    profileVisible: visible,
    updatedAt: new Date(),
  }).where(eq(jobSeekerProfiles.userId, session.user.id));

  return visible;
}

// ─── LEARNING / TRAINING SYSTEM ──────────────────────────────────

export async function fetchCourses(audience?: "seeker" | "filer" | "all", jurisdictionCode?: string) {
  const allCourses = await db.select().from(courses).where(eq(courses.active, true)).limit(50);

  return allCourses.filter(c => {
    // Audience filter: match audience or "all"
    if (audience && c.audience !== audience && c.audience !== "all") return false;
    // Jurisdiction filter: match jurisdiction or null (universal)
    if (jurisdictionCode && c.jurisdictionCode && c.jurisdictionCode !== jurisdictionCode) return false;
    return true;
  });
}

export async function fetchCourseWithModules(courseSlug: string) {
  const [course] = await db.select().from(courses).where(eq(courses.slug, courseSlug)).limit(1);
  if (!course) return null;

  const modules = await db.select().from(courseModules)
    .where(eq(courseModules.courseId, course.id))
    .orderBy(courseModules.orderIndex);

  // Get user progress if authenticated
  const session = await auth();
  let progress: Array<{ moduleId: string | null; status: string | null; quizScore: number | null; completedAt: Date | null; badgeEarnedAt: Date | null }> = [];
  if (session?.user?.id) {
    progress = await db.select({
      moduleId: userCourseProgress.moduleId,
      status: userCourseProgress.status,
      quizScore: userCourseProgress.quizScore,
      completedAt: userCourseProgress.completedAt,
      badgeEarnedAt: userCourseProgress.badgeEarnedAt,
    }).from(userCourseProgress)
      .where(and(eq(userCourseProgress.userId, session.user.id), eq(userCourseProgress.courseId, course.id)));
  }

  return { course, modules, progress };
}

export async function completeModule(courseId: string, moduleId: string, answers: Record<number, number>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Fetch module with quiz data for server-side validation
  const [mod] = await db.select({
    passingScore: courseModules.passingScore,
    quizQuestions: courseModules.quizQuestions,
    orderIndex: courseModules.orderIndex,
    courseId: courseModules.courseId,
  }).from(courseModules).where(and(eq(courseModules.id, moduleId), eq(courseModules.courseId, courseId))).limit(1);
  if (!mod) throw new Error("Module not found");

  // Validate module order — check previous modules are completed
  if (mod.orderIndex > 1) {
    const prevModules = await db.select({ id: courseModules.id })
      .from(courseModules)
      .where(and(eq(courseModules.courseId, courseId), sql`${courseModules.orderIndex} < ${mod.orderIndex}`));
    const completedPrev = await db.select({ moduleId: userCourseProgress.moduleId })
      .from(userCourseProgress)
      .where(and(eq(userCourseProgress.userId, session.user.id), eq(userCourseProgress.courseId, courseId), eq(userCourseProgress.status, "completed")));
    const allPrevDone = prevModules.every(pm => completedPrev.some(cp => cp.moduleId === pm.id));
    if (!allPrevDone) throw new Error("Complete previous modules first");
  }

  // Server-side quiz scoring — don't trust client score
  let quizScore = 0;
  try {
    const questions = JSON.parse(mod.quizQuestions || "[]");
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("Invalid quiz");
    const correct = questions.filter((q: { correctIndex: number }, i: number) => answers[i] === q.correctIndex).length;
    quizScore = Math.round((correct / questions.length) * 100);
  } catch {
    throw new Error("Quiz validation failed");
  }

  const passed = quizScore >= (mod.passingScore || 80);
  if (!passed) return { passed: false, score: quizScore, required: mod.passingScore || 80 };

  // Upsert progress
  const [existing] = await db.select({ id: userCourseProgress.id })
    .from(userCourseProgress)
    .where(and(
      eq(userCourseProgress.userId, session.user.id),
      eq(userCourseProgress.courseId, courseId),
      eq(userCourseProgress.moduleId, moduleId),
    )).limit(1);

  if (existing) {
    await db.update(userCourseProgress).set({
      status: "completed", quizScore, completedAt: new Date(), updatedAt: new Date(),
    }).where(eq(userCourseProgress.id, existing.id));
  } else {
    await db.insert(userCourseProgress).values({
      userId: session.user.id, courseId, moduleId,
      status: "completed", quizScore, completedAt: new Date(),
    });
  }

  // Check if all modules complete → award badge
  const allModules = await db.select({ id: courseModules.id })
    .from(courseModules).where(eq(courseModules.courseId, courseId));
  const completedModules = await db.select({ moduleId: userCourseProgress.moduleId })
    .from(userCourseProgress)
    .where(and(
      eq(userCourseProgress.userId, session.user.id),
      eq(userCourseProgress.courseId, courseId),
      eq(userCourseProgress.status, "completed"),
    ));

  const allComplete = allModules.every(m => completedModules.some(c => c.moduleId === m.id));
  if (allComplete) {
    // Award badge
    await db.update(userCourseProgress).set({ badgeEarnedAt: new Date() })
      .where(and(eq(userCourseProgress.userId, session.user.id), eq(userCourseProgress.courseId, courseId)));

    // Send badge earned notification
    const [courseData] = await db.select({ title: courses.title, badgeLabel: courses.badgeLabel })
      .from(courses).where(eq(courses.id, courseId)).limit(1);
    if (courseData) {
      const { notifyBadgeEarned } = await import("@/lib/email/unified-notify");
      notifyBadgeEarned({
        userId: session.user.id,
        badgeLabel: courseData.badgeLabel || "Certified",
        courseTitle: courseData.title,
      });
    }
  }

  return { passed: true, score: quizScore, badgeEarned: allComplete };
}

export async function fetchUserBadges(userId?: string) {
  const session = await auth();
  const uid = userId || session?.user?.id;
  if (!uid) return [];

  const badges = await db.select({
    courseId: userCourseProgress.courseId,
    badgeEarnedAt: userCourseProgress.badgeEarnedAt,
    badgeLabel: courses.badgeLabel,
    badgeColor: courses.badgeColor,
    courseTitle: courses.title,
  })
    .from(userCourseProgress)
    .innerJoin(courses, eq(userCourseProgress.courseId, courses.id))
    .where(and(eq(userCourseProgress.userId, uid), sql`${userCourseProgress.badgeEarnedAt} IS NOT NULL`))
    .limit(20);

  // Deduplicate by courseId
  const seen = new Set<string>();
  return badges.filter(b => {
    if (seen.has(b.courseId)) return false;
    seen.add(b.courseId);
    return true;
  });
}

export async function seedLcaCourse() {
  // Delete existing course and modules to allow re-seeding with updated content
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "lca-fundamentals")).limit(1);
  if (existing) {
    await db.delete(courseModules).where(eq(courseModules.courseId, existing.id));
    await db.delete(courses).where(eq(courses.id, existing.id));
  }

  const [course] = await db.insert(courses).values({
    slug: "lca-fundamentals",
    title: "LCA Fundamentals",
    description: "A comprehensive course on Guyana\'s Local Content Act 2021 — the legal framework, employment requirements, supplier certification, worker protections, and the petroleum sector ecosystem.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 5,
    badgeLabel: "LCA Certified",
    badgeColor: "accent",
    estimatedMinutes: 90,
  }).returning();

  const moduleData = [
    {
      title: "Understanding the Local Content Act 2021",
      content: "## What is Local Content?\n\nLocal Content is a global policy framework used by resource-rich nations to ensure their citizens benefit from the extraction of natural resources. At its core, local content requires that foreign companies operating in a country\'s resource sector prioritize local workers, suppliers, and businesses.\n\n### Why Does Local Content Matter?\n\n- **Economic Sovereignty**: Without local content requirements, the wealth from natural resources often flows out of the country to multinational headquarters, leaving host nations with depleted resources and little to show for it\n- **Skills Transfer**: Foreign operators bring advanced technology and expertise — local content policies ensure that knowledge is transferred to the local workforce\n- **Supply Chain Development**: By requiring procurement from local suppliers, these policies build a domestic industrial base that can eventually compete globally\n- **Sustainable Development**: Resource extraction is finite — local content ensures lasting economic capacity is built before resources run out\n\n### Global Context\n\nCountries like Norway, Nigeria, Brazil, Trinidad & Tobago, Ghana, and Angola have all implemented local content frameworks with varying degrees of success. Guyana\'s 2021 Act drew lessons from these models, particularly Nigeria\'s NOGICD Act of 2010, while tailoring requirements to Guyana\'s unique circumstances as a newcomer to the petroleum sector.\n\n## Guyana\'s Journey to the Local Content Act\n\n### The Discovery That Changed Everything\n\nIn May 2015, ExxonMobil announced the Liza-1 discovery in the Stabroek Block — Guyana\'s first commercially viable oil find. With an estimated 11+ billion barrels of recoverable oil equivalent, this discovery transformed Guyana from a small agricultural and mining economy into one of the world\'s fastest-growing petroleum producers.\n\n- **Population**: Approximately 800,000 people\n- **GDP Before Oil**: ~US$3.6 billion (2015)\n- **GDP After Oil**: ~US$15+ billion (2024), making Guyana the fastest-growing economy in the world\n- **First Oil**: December 2019 aboard the Liza Destiny FPSO\n\n### Why Legislation Was Urgently Needed\n\nWithout a legal framework, Guyana\'s citizens risked being spectators to their own resource boom. International contractors were arriving with established global supply chains, and without requirements to hire locally or procure from Guyanese businesses, the economic benefits could have bypassed Guyanese citizens entirely. The urgency was compounded by Guyana\'s small population and limited industrial base — deliberate policy intervention was essential.\n\n## The Legislative Process\n\n### From Discussion to Law\n\nThe Local Content Act 2021 (Act No. 18 of 2021) was passed by the National Assembly on December 29, 2021 and assented to on December 31, 2021. The legislation went through extensive consultation with industry stakeholders, civil society, and international experts.\n\n### Key Milestones\n\n- **2018-2019**: Government begins formal consultations on local content policy\n- **2020**: Draft Local Content Bill introduced for public comment, receiving input from ExxonMobil, the American Chamber of Commerce, and local business associations\n- **December 2021**: Act No. 18 of 2021 passed into law\n- **2022**: Local Content Secretariat formally established and begins operations\n- **2022-2023**: First compliance cycle — companies submit inaugural reports\n\n### Scope of Application\n\nThe Act applies to the entire petroleum sector value chain, from exploration to production to decommissioning. It covers all **Contractors** (production sharing agreement holders), **Sub-Contractors** (companies providing goods and services to contractors), and **Licensees** (petroleum license holders).\n\n## Key Definitions You Must Know\n\nUnderstanding the Act\'s precise definitions is critical for compliance. Courts and regulators interpret these terms strictly.\n\n### Contractor\n\nA person who has entered into a petroleum agreement or petroleum prospecting licence with the Government of Guyana. Currently, this includes operators like ExxonMobil Guyana, Hess Guyana, CNOOC, TotalEnergies, and others.\n\n### Sub-Contractor\n\nAny person who provides goods, services, or executes works for a Contractor or another Sub-Contractor in connection with petroleum operations. This cascading definition means the LCA reaches deep into the supply chain — a catering company feeding workers on an FPSO is a sub-contractor subject to the Act.\n\n### Guyanese Supplier\n\nA person or company that is registered on the LCS Register, maintained by the Local Content Secretariat. Crucially, simply being Guyanese-owned is not sufficient — you must hold a valid LCS Certificate to qualify as a Guyanese supplier for compliance calculations.\n\n### Local Content\n\nThe added value brought to Guyana through the utilisation of Guyanese nationals, Guyanese suppliers, and Guyanese companies in petroleum operations. This includes employment, procurement of goods and services, capacity development, and technology transfer.\n\n## The Five Pillars of the LCA\n\nThe Act is built around five interconnected pillars that together create a comprehensive framework for local participation.\n\n### Pillar 1: Employment\n\nSection 12 requires first consideration for Guyanese nationals across all employment categories. Specific minimum percentages apply to Managerial (75%), Technical (60%), and Non-Technical (80%) positions. Equal pay for equal work is mandated under Section 18.\n\n### Pillar 2: Procurement\n\nContractors must give first preference to Guyanese suppliers registered on the LCS Register. All expenditure must be reported, and the Local Content Rate measures the percentage of total spend going to certified local suppliers.\n\n### Pillar 3: Capacity Development\n\nSection 19 requires investment in training, skills development, scholarships, and technology transfer to build Guyanese capability over time. This includes both formal education programs and on-the-job training.\n\n### Pillar 4: Financial Participation\n\nThe Act encourages Guyanese ownership and participation in petroleum-related businesses, joint ventures, and partnerships. This includes provisions for Guyanese companies to gain equity stakes in service companies operating in the sector.\n\n### Pillar 5: Reporting & Transparency\n\nComprehensive reporting obligations ensure the Secretariat and the public can monitor compliance. Half-yearly reports, annual plans, and auditable records create accountability throughout the system.\n\n## The Local Content Secretariat\n\n### Role and Authority\n\nThe Local Content Secretariat (LCS) operates under the Ministry of Natural Resources and is the primary enforcement body for the Act. It has broad powers including the authority to conduct audits, demand records, and recommend penalties.\n\n### Key Functions\n\n- **Registration**: Maintaining the LCS Register of certified Guyanese suppliers\n- **Compliance Monitoring**: Reviewing Half-Yearly Reports from all Contractors and Sub-Contractors\n- **Audit and Investigation**: Conducting on-site audits and investigating complaints\n- **Capacity Building**: Working with industry to identify skills gaps and training needs\n- **Policy Advisory**: Advising the Minister on amendments, regulations, and implementation matters\n\n### Contact and Submissions\n\nAll compliance reports are submitted to **localcontent@nre.gov.gy**. The Secretariat also maintains the LCS Register at **lcregister.petroleum.gov.gy** where suppliers can apply for certification and contractors can verify supplier status.\n\n## The Compliance Cycle\n\nUnderstanding when and what to report is critical for staying in compliance.\n\n### Reporting Timeline\n\n- **Half-Yearly Reports**: Due within 60 days after the end of each half-year period (January-June and July-December). This means reports are due by end of August and end of February respectively\n- **Annual Local Content Plan**: Submitted at the beginning of each year, outlining the company\'s plans for local procurement, employment, and capacity development\n- **Incident Reports**: Any material change in local content performance must be reported promptly\n\n### What Gets Reported\n\n- Total employment by category with Guyanese vs. non-Guyanese breakdown\n- All expenditure, split between Guyanese suppliers and international suppliers\n- Capacity development activities and investment amounts\n- Succession plans for non-Guyanese positions\n- Justifications for any positions where Guyanese nationals were not hired\n\n### Audit Triggers\n\nThe Secretariat may conduct audits based on report anomalies, complaints from workers or suppliers, routine compliance checks, or at the direction of the Minister. Companies must maintain records for a minimum of 5 years.\n\n## Penalties and Enforcement\n\nThe LCA has significant enforcement teeth, designed to ensure compliance is taken seriously.\n\n### Financial Penalties\n\n- **First offense**: Fines from GY$1,000,000 to GY$10,000,000\n- **Subsequent offenses**: Fines up to GY$50,000,000\n- **Continuing offenses**: Additional daily penalties until compliance is achieved\n\n### Criminal Liability\n\n- **Section 23**: Any person who knowingly provides false or misleading information commits a criminal offense\n- This applies to individuals, not just companies — compliance officers, directors, and managers can be personally liable\n- Conviction can result in fines and imprisonment\n\n### Administrative Actions\n\n- The Secretariat can require corrective action plans\n- Persistent non-compliance can affect a company\'s standing for future contract awards\n- Public reporting of compliance records creates reputational risk\n\n## How the LCA Compares Globally\n\n### Nigeria\'s NOGICD Act (2010)\n\nNigeria\'s Nigerian Oil and Gas Industry Content Development Act was a key reference point for Guyana\'s legislation. However, Guyana\'s Act differs in several important ways:\n- **Simpler structure**: Guyana\'s Act has fewer categories and clearer requirements\n- **Stronger penalties**: Guyana\'s fines are proportionally higher relative to GDP\n- **Digital-first**: Guyana established the LCS Register as a digital platform from day one\n- **Smaller market**: Guyana\'s framework accounts for a smaller industrial base with more targeted interventions\n\n### Trinidad & Tobago\n\nAs a Caribbean neighbour with decades of petroleum experience, Trinidad\'s local content framework provided practical lessons, particularly around the challenge of sustaining local participation as an industry matures and the initial boom subsides.\n\n### Norway\'s Model\n\nNorway\'s approach — often cited as the gold standard — focuses on building world-class local companies that can compete globally. Guyana\'s Act includes similar aspirations through its capacity development provisions.\n\n## Key Sections Every Professional Must Know\n\n### The Sections You\'ll Reference Most\n\n- **Section 12 — Employment**: First consideration for Guyanese nationals, minimum percentages by category\n- **Section 18 — Equal Pay**: Guyanese nationals must receive equal compensation for work of equal value\n- **Section 19 — Capacity Development**: Obligations to train, upskill, and develop Guyanese workers\n- **Section 21 — Reporting**: Requirements for Half-Yearly Reports and record-keeping\n- **Section 23 — Offenses**: Criminal liability for false or misleading information\n- **Section 25 — Penalties**: Fine ranges for non-compliance\n- **Schedule (First Schedule)**: The minimum local content levels for specific goods and services\n\n### Practical Tip\n\nKeep a printed or digital copy of the Act accessible at all times. When in doubt about a compliance question, reference the specific section rather than relying on secondhand interpretations. The full text is available on the Official Gazette of Guyana.\n\n## Real-World Impact Since 2021\n\n### What Has Changed\n\nSince the Act came into force, measurable changes have occurred across the sector:\n\n- **Employment**: Guyanese employment in the petroleum sector has increased significantly, with many companies exceeding minimum requirements\n- **Supplier Growth**: The number of LCS-registered suppliers has grown from a few hundred to over 1,000, covering dozens of service categories\n- **Training Investment**: Millions of dollars have been invested in technical training programs, scholarships, and apprenticeships\n- **Procurement Shift**: A growing share of petroleum sector spending is flowing to Guyanese businesses\n\n### Challenges Remaining\n\n- **Skills Gaps**: Some technical roles still lack sufficient qualified Guyanese candidates\n- **Capacity Constraints**: Small Guyanese companies sometimes struggle to meet the scale requirements of major operators\n- **Verification**: Ensuring all claimed \"local content\" is genuine rather than paper compliance\n- **Evolving Requirements**: As the sector grows, the Act may need amendments to address new challenges\n\n\"The LCA is not just about numbers on a report — it\'s about building an economy that works for all Guyanese, long after the oil stops flowing.\"",
      quiz: [
        { question: "What year was the Local Content Act enacted?", options: ["2019", "2020", "2021", "2022"], correctIndex: 2 },
        { question: "Who oversees LCA compliance?", options: ["EPA", "Ministry of Finance", "Local Content Secretariat", "Bank of Guyana"], correctIndex: 2 },
        { question: "The LCA applies to which sector?", options: ["Mining", "Agriculture", "Petroleum", "All sectors"], correctIndex: 2 },
        { question: "Which of these must comply with the LCA?", options: ["Only Guyanese companies", "Only foreign companies", "Contractors, Sub-Contractors, and Licensees", "Only ExxonMobil"], correctIndex: 2 },
        { question: "What is the maximum fine for a first LCA offense?", options: ["GY$500,000", "GY$1,000,000", "GY$10,000,000", "GY$50,000,000"], correctIndex: 2 },
        { question: "When was Guyana\'s first commercially viable oil discovery announced?", options: ["2010", "2013", "2015", "2018"], correctIndex: 2 },
        { question: "Which of these is NOT one of the five pillars of the LCA?", options: ["Employment", "Procurement", "Environmental Protection", "Reporting & Transparency"], correctIndex: 2 },
      ],
    },
    {
      title: "Employment Categories & Requirements",
      content: "## Why Employment Is the Most Scrutinized Section\n\nEmployment requirements under the Local Content Act are the most closely monitored aspect of compliance, and for good reason. Employment directly impacts Guyanese livelihoods, and the public pays close attention to whether international companies are hiring locally.\n\n### The Stakes Are High\n\n- Employment data is the most visible metric — workers talk, communities notice, and media reports on hiring patterns\n- The Secretariat receives more complaints about employment than any other area\n- Non-compliance in employment is harder to justify than in procurement, where legitimate supply constraints may exist\n- Employment percentages are straightforward to calculate and verify, making audits efficient\n\n### Political and Social Context\n\nIn a country of approximately 800,000 people, every job in the petroleum sector has an outsized impact. When a community sees international workers filling roles that Guyanese could perform, it generates significant public pressure. The LCA\'s employment provisions exist to channel that pressure into measurable, enforceable requirements.\n\n## The Three Employment Categories in Detail\n\n### Managerial — Minimum 75% Guyanese\n\nThis category covers senior leadership and management positions. The 75% minimum means that for every four managerial positions, at least three must be filled by Guyanese nationals.\n\n**Roles that typically fall in this category:**\n- Country Manager / General Manager\n- Operations Manager\n- Finance Director / Controller\n- HSE Manager\n- HR Director\n- Department Heads\n- Project Managers\n- Supply Chain Manager\n\n### Technical — Minimum 60% Guyanese\n\nTechnical roles require specialized knowledge and skills. The 60% threshold reflects the reality that some technical expertise may not yet be available locally, while pushing companies to invest in local talent.\n\n**Roles that typically fall in this category:**\n- Petroleum Engineers\n- Geologists and Geophysicists\n- Drilling Engineers\n- Process Engineers\n- Marine Engineers\n- Electrical and Mechanical Technicians\n- Environmental Scientists\n- IT Systems Engineers\n- Quality Assurance Specialists\n\n### Non-Technical — Minimum 80% Guyanese\n\nNon-technical positions have the highest local content requirement because the skills are most readily available locally. The 80% threshold gives companies a narrow 20% margin for international hires.\n\n**Roles that typically fall in this category:**\n- Administrative Assistants\n- Reception and Office Support\n- Drivers and Transportation\n- Warehouse and Logistics Workers\n- Catering Staff\n- Security Personnel\n- Cleaning and Maintenance\n- Data Entry Clerks\n\n## Understanding ISCO-08 Classification\n\n### What is ISCO-08?\n\nThe International Standard Classification of Occupations (ISCO-08) is a system developed by the International Labour Organization (ILO) that classifies jobs into a hierarchical structure. All employment reported under the LCA must use ISCO-08 codes.\n\n### The Structure\n\nISCO-08 uses a four-level hierarchy:\n- **Major Group** (1 digit): e.g., 2 = Professionals\n- **Sub-Major Group** (2 digits): e.g., 21 = Science and Engineering Professionals\n- **Minor Group** (3 digits): e.g., 214 = Engineering Professionals\n- **Unit Group** (4 digits): e.g., 2145 = Chemical Engineers\n\n### Why ISCO-08 Matters for Compliance\n\n- It provides a **standardised language** for job classification that the Secretariat can verify across companies\n- It prevents companies from reclassifying roles to manipulate their category percentages (e.g., calling a secretary a \"Technical Support Specialist\")\n- It enables **benchmarking** — the Secretariat can compare employment patterns across similar companies\n- International auditors and reviewers can quickly validate classifications\n\n### Common ISCO-08 Codes in Petroleum\n\n- 1120: Managing Directors and Chief Executives (Managerial)\n- 2145: Chemical Engineers (Technical)\n- 3115: Mechanical Engineering Technicians (Technical)\n- 4110: General Office Clerks (Non-Technical)\n- 8342: Earthmoving and Related Plant Operators (Non-Technical)\n\n## Calculating Your Guyanese Employment Percentage\n\n### The Formula\n\nFor each category, the calculation is straightforward:\n\n**Guyanese % = (Number of Guyanese Nationals in Category ÷ Total Employees in Category) × 100**\n\n### Important Rules\n\n- **Full-time equivalents**: Part-time workers are counted proportionally. A half-time employee counts as 0.5\n- **Contractors vs. Employees**: Both direct employees and contracted workers performing regular duties must be included\n- **Rotational workers**: For offshore or rotational positions, count the position, not the individual — if a position is filled by a Guyanese national, it counts regardless of rotation schedule\n- **Dual nationals**: Guyanese citizens with dual nationality count as Guyanese\n- **Permanent residents**: Only Guyanese citizens qualify — permanent residents do not count toward the Guyanese percentage\n\n### Example Calculation\n\nA company has 20 Managerial positions: 16 filled by Guyanese nationals and 4 by expatriates.\n**Guyanese % = (16 ÷ 20) × 100 = 80%**\nThis exceeds the 75% minimum — the company is compliant in this category.\n\n## The First Consideration Requirement\n\n### What Section 12 Actually Requires\n\n\"First consideration\" does not mean companies must hire unqualified Guyanese candidates. It means:\n\n- **Advertise Locally First**: All positions must be advertised in Guyana before international recruitment begins\n- **Evaluate Guyanese Candidates**: Qualified Guyanese applicants must be interviewed and assessed before considering international candidates\n- **Document the Decision**: If a Guyanese candidate is not hired, the company must document why — this documentation can be requested during audits\n\n### What First Consideration Does NOT Mean\n\n- It does not require hiring underqualified candidates\n- It does not prevent hiring international specialists when no qualified Guyanese candidate exists\n- It does not mean Guyanese candidates must be hired regardless of performance or fit\n- It does not prevent companies from setting legitimate qualification requirements\n\n### Practical Steps for Compliance\n\n- Maintain records of all job postings, showing they were advertised locally\n- Keep interview notes and scoring for all candidates, both Guyanese and international\n- If hiring an international candidate, prepare a written justification referencing specific qualifications the Guyanese candidates lacked\n- Develop a succession plan showing how you intend to localize the role over time\n\n## Equal Pay — Section 18 in Practice\n\n### The Legal Requirement\n\nSection 18 states that Guyanese nationals shall receive equal pay for work of equal value compared to non-Guyanese counterparts. This is one of the Act\'s most impactful provisions.\n\n### What \"Work of Equal Value\" Means\n\nTwo roles are considered \"work of equal value\" when they require similar:\n- Skills and qualifications\n- Effort and responsibility\n- Working conditions\n- Decision-making authority\n\n### Scenario: Compliant vs. Non-Compliant\n\n**Non-Compliant**: A company pays its expatriate drilling engineers US$15,000/month and its Guyanese drilling engineers US$8,000/month for the same role, same qualifications, same responsibilities. The difference cannot be justified by a legitimate factor.\n\n**Compliant**: A company pays an expatriate drilling engineer US$15,000/month (who has 20 years of deepwater experience) and a Guyanese drilling engineer US$10,000/month (who has 5 years of experience). The pay difference is justified by the experience differential, not nationality.\n\n### Key Point\n\nLegitimate pay differentials can exist based on experience, qualifications, and performance — but nationality alone can never be the basis for different compensation. If audited, companies must demonstrate that any pay gap has a non-discriminatory justification.\n\n## Common Compliance Mistakes in Employment\n\n### The Mistakes That Get Companies in Trouble\n\n- **Wrong ISCO-08 codes**: Misclassifying roles to improve category percentages — the Secretariat cross-references with industry standards\n- **Phantom positions**: Listing Guyanese nationals in roles they don\'t actually perform\n- **Ignoring contractors**: Not counting contracted workers who perform regular duties\n- **Late advertising**: Posting positions internationally before completing local advertising\n- **Missing documentation**: Failing to keep interview records and hiring justifications\n- **Stale succession plans**: Submitting the same succession plan year after year without progress\n\n### How to Avoid Them\n\n- Assign a dedicated compliance officer to review all employment data before submission\n- Use a standardised ISCO-08 lookup tool for all role classifications\n- Maintain a central hiring database with advertising dates, candidate lists, and decision rationale\n- Review succession plans quarterly and document progress toward localisation targets\n- When in doubt, consult with the Secretariat — they would rather help you get it right than penalize you later\n\n## Succession Planning Requirements\n\n### What the Act Expects\n\nFor every position held by a non-Guyanese national, companies are expected to develop and implement a succession plan showing how the role will be localised over time.\n\n### Elements of a Strong Succession Plan\n\n- **Timeline**: Realistic target date for localising the position (typically 2-5 years)\n- **Identified Successor**: A named Guyanese national being developed for the role\n- **Training Plan**: Specific training, mentoring, and development activities with milestones\n- **Knowledge Transfer**: How the expatriate\'s expertise will be transferred to the successor\n- **Interim Metrics**: How progress will be measured between now and the target date\n\n### What the Secretariat Looks For\n\n- **Credibility**: Is the timeline realistic given the skills required?\n- **Progress**: Are milestones being met? Has training actually occurred?\n- **Investment**: Is the company investing real resources, or is this a paper exercise?\n- **Accountability**: Who is responsible for executing the plan?\n\n## How the Secretariat Verifies Employment Data\n\n### Verification Methods\n\nThe Secretariat has several tools for verifying employment claims:\n\n- **NIS Cross-Reference**: Employment records can be cross-referenced with National Insurance Scheme (NIS) contributions to verify that listed employees actually exist and are being paid\n- **Site Visits**: Secretariat officers can visit work sites unannounced to verify that personnel listed in reports are actually present and performing the roles claimed\n- **Payroll Audits**: Companies can be required to produce payroll records showing compensation by nationality\n- **Employee Interviews**: The Secretariat can interview employees to verify their roles and working conditions\n- **Industry Benchmarking**: Unusual patterns (e.g., a company with 100% Technical compliance when peers achieve 65%) trigger deeper investigation\n\n### Consequences of Discovery\n\nIf the Secretariat discovers discrepancies between reported and actual employment data, consequences range from formal warnings and corrective action requirements to full penalty proceedings under Section 25, and potential criminal referral under Section 23 if false information was knowingly provided.\n\n## What a Compliant Employment Report Looks Like\n\n### The Structure\n\nA well-prepared employment section of the Half-Yearly Report includes:\n\n- **Summary table**: Total headcount by category with Guyanese vs. non-Guyanese breakdown and percentage calculations\n- **Detailed roster**: Every position listed with ISCO-08 code, employee name, nationality, start date, and compensation band\n- **Justification appendix**: For each non-Guyanese employee, a brief justification explaining why a Guyanese national was not hired\n- **Succession plans**: For each expatriate role, the localisation plan and progress update\n- **Training log**: Summary of capacity development activities completed during the period\n\n### Best Practice\n\nSubmit your report early rather than at the deadline. If the Secretariat has questions, you\'ll have time to respond before any formal compliance issues arise. Proactive communication demonstrates good faith and is always viewed favourably.",
      quiz: [
        { question: "What is the minimum Guyanese percentage for Managerial roles?", options: ["60%", "70%", "75%", "80%"], correctIndex: 2 },
        { question: "What classification system is used for employment reporting?", options: ["SOC", "NAICS", "ISCO-08", "ISIC"], correctIndex: 2 },
        { question: "Section 18 guarantees Guyanese nationals:", options: ["Priority hiring", "Equal pay for work of equal value", "Free training", "Management roles"], correctIndex: 1 },
        { question: "Which category requires 80% Guyanese employment?", options: ["Managerial", "Technical", "Non-Technical", "All categories"], correctIndex: 2 },
        { question: "First consideration means:", options: ["Must hire only Guyanese", "Guyanese must be considered before international candidates", "Pay Guyanese more", "Train Guyanese first"], correctIndex: 1 },
        { question: "What is the minimum Guyanese percentage for Technical roles?", options: ["50%", "60%", "70%", "75%"], correctIndex: 1 },
        { question: "Which of these is a legitimate reason for a pay differential?", options: ["Nationality", "Significant difference in experience", "Country of origin", "Employer preference"], correctIndex: 1 },
      ],
    },
    {
      title: "The LCS Register & Supplier Certification",
      content: "## What is the LCS Register?\n\nThe Local Content Services (LCS) Register is Guyana\'s official database of certified Guyanese suppliers qualified to provide goods, works, and services to the petroleum sector. Maintained by the Local Content Secretariat, it serves as the single authoritative source for verifying whether a supplier qualifies as a \"Guyanese supplier\" under the Act.\n\n### Why the Register Exists\n\n- **Verification**: Without the register, contractors could claim local procurement without proof that suppliers are genuinely Guyanese\n- **Transparency**: Creates a public, searchable database that contractors, suppliers, and the public can access\n- **Development**: Identifies the range of local capabilities available, helping match supply with demand\n- **Accountability**: Provides the data infrastructure needed for compliance monitoring and auditing\n\n### Access\n\nThe register is accessible online at **lcregister.petroleum.gov.gy**. Contractors use it to verify supplier credentials before counting expenditure as \"local\" in their compliance reports.\n\n## The Certification Process Step by Step\n\n### Phase 1: Eligibility Check\n\nBefore applying, ensure your business meets the basic criteria:\n- Registered in Guyana (Certificate of Incorporation or Business Registration)\n- Tax compliant (GRA clearance certificate)\n- Guyanese-owned (at least 51% Guyanese ownership for full certification)\n- Active operations in Guyana (not a shell or dormant entity)\n\n### Phase 2: Application Submission\n\nSubmit your application through the Secretariat with the following documents:\n- Completed application form\n- Business registration certificate\n- Tax Identification Number (TIN) and GRA clearance\n- Proof of Guyanese ownership (share register, Articles of Incorporation)\n- Bank references from at least two financial institutions\n- Description of services/goods offered with evidence of capability\n\n### Phase 3: Review and Verification\n\nThe Secretariat reviews your application, which may include:\n- Document verification with issuing authorities\n- Site visit to verify operational capability\n- Reference checks with stated clients\n- Financial assessment to ensure business viability\n\n### Phase 4: Certification Decision\n\nApplications are typically processed within 6-12 weeks. Approved suppliers receive an LCS Certificate with a unique identifier in the format **LCSR-XXXXXXXX**.\n\n## Understanding Your LCS Certificate\n\n### Certificate Details\n\nYour LCS Certificate contains:\n- **Certificate Number**: LCSR-XXXXXXXX format — this is your unique identifier in the system\n- **Company Name**: As registered with the Registrar of Companies\n- **Service Categories**: The specific categories you\'re approved to supply\n- **Validity Period**: Certificates are valid for a defined period and must be renewed\n- **Ownership Classification**: Whether you qualify as majority Guyanese-owned\n\n### Maintaining Your Certification\n\n- Keep your business registration and tax compliance current\n- Report any material changes (ownership, address, services offered) to the Secretariat\n- Apply for renewal before your certificate expires\n- Maintain the operational capabilities that qualified you for certification\n\n### Important\n\nAn expired or revoked LCS Certificate means expenditure to your company no longer counts as \"local\" in compliance calculations. This directly impacts your clients\' compliance scores, so they have a strong incentive to verify your certificate is current before awarding contracts.\n\n## The 40+ Service Categories\n\nThe LCS Register covers a comprehensive range of goods and services needed by the petroleum sector.\n\n### Major Categories Explained\n\n- **Engineering & Design**: Structural, mechanical, electrical, and process engineering services. This is a high-value category where Guyanese companies are increasingly competitive\n- **Construction & Fabrication**: Building, welding, steel fabrication, civil works. Strong local capability exists here\n- **Marine Services**: Vessel support, harbour services, marine logistics. Critical for supporting offshore operations\n- **Transportation & Logistics**: Land transport, freight forwarding, warehousing. One of the largest local content categories by spend\n- **Catering & Accommodation**: Food services, camp management, hospitality. High demand with strong local capability\n- **Environmental Services**: Environmental impact assessments, waste management, remediation. Growing sector\n- **IT & Communications**: Technology services, telecommunications, software development. Emerging category\n- **Training & Education**: Technical training providers, safety certification, professional development\n\n### Emerging Categories\n\nAs the sector matures, new categories are being added to the register, including drone services, data analytics, subsea engineering support, and renewable energy services.\n\n## Calculating Your Local Content Rate\n\n### The Formula\n\n**Local Content Rate (%) = (Total Expenditure with LCS-Certified Suppliers ÷ Total Expenditure) × 100**\n\n### What Counts as \"Expenditure\"\n\n- Direct purchases of goods and materials\n- Service contracts and consulting fees\n- Equipment rental and leasing\n- Subcontractor payments\n- Training and capacity development spend\n- Insurance and financial services (when provided by local companies)\n\n### What Does NOT Count\n\n- Government fees, taxes, and royalties\n- Inter-company transfers (payments between affiliates)\n- International freight and shipping costs for goods not available locally\n- Expenditure with suppliers whose LCS certification has expired\n\n### Example\n\nA contractor spent US$100 million in the reporting period:\n- US$45 million with LCS-certified suppliers\n- US$55 million with international suppliers\n- **Local Content Rate = 45%**\n\n## Supplier Tiers and Joint Ventures\n\n### Tier 1: Direct Suppliers\n\nCompanies that contract directly with an operator (Contractor). These tend to be larger, more established companies providing major services like construction, marine support, or engineering.\n\n### Tier 2: Sub-Suppliers\n\nCompanies that supply Tier 1 contractors. For example, a catering company that provides food services to a construction contractor working on an ExxonMobil project. Tier 2 suppliers are still subject to LCA requirements.\n\n### Tier 3: Indirect Suppliers\n\nFurther down the supply chain — companies providing materials or services to Tier 2 suppliers. While not directly reporting to the Secretariat, their LCS certification status affects the entire chain.\n\n### Joint Ventures\n\nJoint ventures between Guyanese and international companies are treated based on the ownership structure:\n- **51%+ Guyanese-owned**: Qualifies as a Guyanese supplier\n- **Less than 51% Guyanese-owned**: May qualify for partial credit depending on the JV structure\n- The Secretariat examines whether the JV involves genuine capability transfer or is merely a paper arrangement\n\n## Common Questions About LCS Certification\n\n### \"My company is Guyanese-owned but not LCS-registered. Does my clients\' spend with me count as local?\"\n\nNo. Only expenditure with companies holding a valid, current LCS Certificate counts toward local content compliance. Guyanese ownership alone is not sufficient — you must be on the register.\n\n### \"Can a foreign-owned company get LCS certification?\"\n\nCompanies with less than 51% Guyanese ownership may be eligible for a limited certification that recognises their local operations, but they do not receive the same weighting in local content calculations. The specifics depend on the company\'s structure and the Secretariat\'s assessment.\n\n### \"How long does certification take?\"\n\nTypically 6-12 weeks from complete application submission. Incomplete applications or those requiring additional verification take longer.\n\n### \"Can I apply for multiple service categories?\"\n\nYes. You should apply for every category in which you have demonstrated capability. Each category must be supported by evidence of your ability to deliver.\n\n## How Contractors Verify Supplier Status\n\n### Verification is the Contractor\'s Responsibility\n\nBefore counting any expenditure as \"local\" in their compliance reports, contractors must verify that the supplier holds a valid LCS Certificate. The Secretariat can and does challenge claims where the underlying certification was expired or invalid.\n\n### Verification Methods\n\n- **Online Register Search**: Search by company name or LCSR number at lcregister.petroleum.gov.gy\n- **Certificate Copy**: Request a copy of the supplier\'s current LCS Certificate\n- **Secretariat Confirmation**: For large contracts, directly confirm with the Secretariat\n\n### Best Practice for Contractors\n\n- Verify LCS status before awarding any contract\n- Include a clause in contracts requiring suppliers to maintain their LCS certification throughout the contract term\n- Re-verify at each reporting period, not just at contract award\n- Maintain a log of verification dates and methods for audit purposes\n\n## Benefits of Being on the Register\n\n### For Your Business\n\n- **Market Access**: You become visible to every contractor and operator required to meet local content targets — they\'re actively looking for you\n- **Competitive Advantage**: Being LCS-certified differentiates you from unregistered competitors\n- **Contract Eligibility**: Many tender processes now require LCS certification as a pre-qualification criterion\n- **Growth Opportunity**: Access to petroleum sector contracts can transform a small business into a major enterprise\n\n### For the Sector\n\n- **Compliance Simplicity**: Contractors can efficiently identify qualified local suppliers\n- **Quality Assurance**: The certification process provides a baseline quality check\n- **Data for Policy**: The register provides data on local capacity that informs policy decisions\n\n### The Virtuous Cycle\n\nAs more companies register, contractors find it easier to meet local content targets, which increases spending with local suppliers, which creates more business opportunities, which encourages more companies to register. The register is the engine of this cycle.\n\n## How LCS Certification Connects to Procurement\n\n### The Procurement Decision Chain\n\nWhen a contractor needs a service or product, the LCA creates a specific decision chain:\n\n- **Step 1**: Check if the goods or services are available from LCS-certified suppliers\n- **Step 2**: If yes, Guyanese suppliers must receive first preference in the procurement process\n- **Step 3**: If multiple Guyanese suppliers qualify, standard competitive procurement applies\n- **Step 4**: If no qualified Guyanese supplier exists, the contractor may procure internationally but must document the justification\n- **Step 5**: All procurement decisions and their rationale must be recorded for compliance reporting\n\n### What \"First Preference\" Means in Practice\n\nFirst preference means Guyanese suppliers must be given a genuine opportunity to compete. This includes:\n- Including LCS-registered suppliers in tender invitations\n- Not setting unreasonable pre-qualification requirements that exclude local companies\n- Allowing reasonable time for bid preparation\n- Evaluating bids fairly and consistently\n\n\"Getting on the LCS Register is the first step to participating in Guyana\'s petroleum economy. It\'s not just a certificate — it\'s your ticket to the fastest-growing sector in the Caribbean.\"",
      quiz: [
        { question: "What format is the LCS Certificate ID?", options: ["LCS-001", "LCSR-XXXXXXXX", "GY-CERT-001", "LC-2021-001"], correctIndex: 1 },
        { question: "Where is the LCS Register hosted?", options: ["lcadesk.com", "nre.gov.gy", "lcregister.petroleum.gov.gy", "guyana.gov.gy"], correctIndex: 2 },
        { question: "Local Content Rate measures:", options: ["Employee satisfaction", "Percentage of Guyanese employees", "Percentage of spend with LCS-certified suppliers", "Number of suppliers"], correctIndex: 2 },
        { question: "How many service categories does the register cover?", options: ["10+", "20+", "40+", "100+"], correctIndex: 2 },
        { question: "To count as a Guyanese supplier, a company needs:", options: ["A Guyana address", "A valid LCS Certificate", "Guyanese employees", "Government approval"], correctIndex: 1 },
        { question: "What minimum Guyanese ownership is required for full LCS certification?", options: ["25%", "40%", "51%", "75%"], correctIndex: 2 },
        { question: "How long does LCS certification typically take?", options: ["1-2 weeks", "6-12 weeks", "6-12 months", "Over 1 year"], correctIndex: 1 },
      ],
    },
    {
      title: "Rights & Protections for Workers",
      content: "## Overview of Worker Protections\n\nThe Local Content Act 2021 provides a robust framework of rights and protections for workers in Guyana\'s petroleum sector. These protections go beyond standard labour law, recognising the unique dynamics of an industry dominated by multinational corporations.\n\n### Why Special Protections Exist\n\n- The power imbalance between multinational employers and individual Guyanese workers is significant\n- Without specific protections, international norms and compensation structures could disadvantage local workers\n- The petroleum sector offers some of the highest-paying jobs in Guyana — ensuring Guyanese access to these opportunities is a national priority\n- The Act recognises that the petroleum sector is a finite opportunity — protections ensure maximum benefit during the production window\n\n### Scope of Protection\n\nThese rights apply to all workers in the petroleum sector, whether employed directly by operators, by service companies, or by sub-contractors further down the supply chain.\n\n## First Consideration — Section 12 in Detail\n\n### The Legal Text\n\nSection 12 requires that every Contractor, Sub-Contractor, and Licensee shall give first consideration to qualified Guyanese nationals for all positions in petroleum operations.\n\n### What This Means for You as a Worker\n\n- If you\'re qualified for a position in the petroleum sector, you have a legal right to be considered before international candidates\n- \"Qualified\" means you meet the legitimate requirements of the role — it doesn\'t mean you must be the most experienced candidate globally\n- Companies must advertise positions locally before recruiting internationally\n- If you applied for a role and were passed over for an international hire, you can ask the company for their justification\n\n### What This Means for You as an Employer\n\n- You must demonstrate that you\'ve made genuine efforts to recruit locally\n- Job advertisements must appear in Guyanese media before international platforms\n- You must maintain records of all applicants and your evaluation criteria\n- If hiring an international candidate, you need documented justification\n\n## How to Know If First Consideration Was Given\n\n### Red Flags That Suggest Non-Compliance\n\n- A position was never advertised in Guyana but an international hire was made\n- The job requirements were unreasonably narrow, effectively excluding all Guyanese candidates (e.g., requiring 15 years of deepwater experience for an entry-level role)\n- Guyanese applicants were not interviewed despite meeting stated qualifications\n- The company has a pattern of filling positions with nationals from a single country\n- No succession plan exists for expatriate positions\n\n### Green Flags of Genuine Compliance\n\n- Positions are advertised in local newspapers, online job boards, and university career centres\n- The company maintains a database of Guyanese candidates and reaches out when positions open\n- Interview records show Guyanese candidates were evaluated using the same criteria as international applicants\n- The company invests in training Guyanese workers to prepare them for more senior roles\n- Succession plans show measurable progress over time\n\n## Equal Pay — Section 18 Deep Dive\n\n### The Full Scope of Equal Pay\n\nSection 18 guarantees that Guyanese nationals receive equal pay for work of equal value. This covers:\n\n- **Base salary**: The core compensation must be equivalent\n- **Allowances**: Housing, transportation, and other allowances must be comparable\n- **Benefits**: Health insurance, retirement contributions, and other benefits\n- **Bonuses**: Performance-based compensation must use the same criteria and scales\n\n### Understanding \"Work of Equal Value\"\n\nTwo positions are considered \"work of equal value\" when they are substantially similar in:\n- **Skills Required**: Educational qualifications, technical certifications, and competencies\n- **Responsibilities**: Scope of decision-making, budget authority, and people management\n- **Working Conditions**: Location, hours, hazard exposure, and physical demands\n- **Effort**: The physical and mental effort the role requires\n\n### Legitimate Pay Differentials\n\nNot all pay differences are discriminatory. Legitimate reasons for pay variation include:\n- Significantly different levels of experience (e.g., 5 years vs. 20 years)\n- Additional specialized certifications or qualifications\n- Performance-based differences applied consistently to all nationalities\n- Market-rate adjustments documented and applied transparently\n\n### What Is Never Acceptable\n\n- Paying Guyanese workers less simply because \"that\'s the local market rate\" when international counterparts doing the same job earn more\n- Using nationality as a factor in determining compensation bands\n- Providing inferior benefits packages to Guyanese workers in comparable roles\n\n## Capacity Development — Section 19\n\n### What Employers Must Provide\n\nSection 19 creates a positive obligation — employers don\'t just need to avoid discrimination, they must actively invest in developing Guyanese capability.\n\n### Types of Required Investment\n\n- **On-the-Job Training**: Structured programs where Guyanese workers learn from experienced colleagues, including expatriates. This should have documented learning objectives and progress tracking\n- **Formal Education Support**: Scholarships, bursaries, and tuition assistance for Guyanese nationals pursuing relevant qualifications\n- **Technical Certifications**: Sponsoring workers to obtain industry certifications (e.g., NEBOSH, IWCF, API certifications)\n- **Technology Transfer**: Ensuring Guyanese workers gain exposure to the latest technologies and methodologies used in petroleum operations\n\n### Mentoring and Shadowing\n\nOne of the most effective capacity development tools is pairing Guyanese workers with experienced international counterparts:\n- The Guyanese worker shadows the expatriate, learning the role\'s requirements firsthand\n- Knowledge transfer is documented and progress is tracked\n- The goal is eventual full localization of the position\n- This approach benefits both parties — the expatriate shares knowledge while gaining local context\n\n## Your Right to File a Complaint\n\n### When to Consider a Complaint\n\nYou may file a complaint with the Local Content Secretariat if you believe:\n- You were passed over for a position in favour of an international candidate without proper justification\n- You are being paid less than international colleagues in equivalent roles\n- Your employer is not investing in training or development for Guyanese workers\n- Your employer\'s reporting to the Secretariat does not accurately reflect reality\n- You are being retaliated against for raising local content concerns\n\n### How to File\n\n- Contact the Secretariat at **localcontent@nre.gov.gy**\n- Provide specific details: your name, employer, the nature of the concern, and any supporting evidence\n- The Secretariat will acknowledge receipt and initiate an investigation\n- You do not need a lawyer to file a complaint, though you may wish to consult one\n\n### What Happens After You File\n\n- The Secretariat reviews your complaint and determines if it falls within their jurisdiction\n- If warranted, they may contact your employer for information\n- The investigation may include document requests, site visits, or interviews\n- Outcomes can range from no finding to corrective action requirements to formal penalty proceedings\n\n## Whistleblower Protections\n\n### The Importance of Speaking Up\n\nThe Act\'s effectiveness depends on accurate information. Workers who report non-compliance play a critical role in ensuring the system works.\n\n### Your Protections\n\n- Employers cannot terminate, demote, or discipline a worker for filing a complaint with the Secretariat in good faith\n- Retaliation against a worker who reports LCA concerns is itself a compliance violation\n- The Secretariat treats complaints with confidentiality to the extent possible\n\n### Practical Considerations\n\n- Document your concerns in writing before filing — dates, specific incidents, names, and any evidence\n- Keep copies of your employment records, pay stubs, and any relevant communications\n- If possible, raise concerns internally first through your company\'s compliance or HR channels\n- If internal channels are unresponsive or you face retaliation, escalate to the Secretariat\n\n## The Penalty Structure in Detail\n\n### Financial Penalties — Section 25\n\nThe Act provides for significant financial penalties to ensure compliance is taken seriously:\n\n- **First offense for general non-compliance**: GY$1,000,000 to GY$10,000,000\n- **Subsequent offenses**: Fines can increase up to GY$50,000,000\n- **Continuing offenses**: The court can impose daily penalties until compliance is achieved\n- These fines are per violation — a company with multiple compliance failures can face cumulative penalties\n\n### Criminal Liability — Section 23\n\nKnowingly providing false or misleading information to the Secretariat is a criminal offense:\n\n- This applies to individuals who sign or certify reports, not just the company\n- Compliance officers, directors, and managers can be personally prosecuted\n- Conviction can result in fines and imprisonment\n- \"Knowingly\" is the key word — honest errors corrected promptly are treated differently from deliberate falsification\n\n### The Deterrent Effect\n\nThe penalty structure is designed to make non-compliance more expensive than compliance. For a company spending hundreds of millions on petroleum operations, the cost of proper local content programs is far less than the risk of GY$50,000,000 fines and criminal prosecution.\n\n## How Audits Work\n\n### What Triggers an Audit\n\n- **Routine Compliance Review**: The Secretariat conducts regular reviews of Half-Yearly Reports\n- **Complaint Investigation**: A worker or supplier complaint may trigger a targeted audit\n- **Statistical Anomalies**: Unusual patterns in reported data (sudden changes, outlier percentages)\n- **Ministerial Direction**: The Minister can direct the Secretariat to audit any entity\n- **Random Selection**: Periodic random audits ensure all companies maintain readiness\n\n### What to Expect During an Audit\n\n- **Document Request**: The auditor will request employment records, payroll data, procurement records, training logs, and hiring documentation\n- **Site Visit**: Auditors may visit your offices and work sites to verify personnel and operations\n- **Employee Interviews**: Workers may be interviewed confidentially about their roles, compensation, and training\n- **Data Reconciliation**: The auditor will compare your report submissions with actual records\n- **Duration**: A standard audit typically takes 2-4 weeks from initial document request to draft findings\n\n### Your Rights During an Audit\n\n- You have the right to understand what records are being requested and why\n- You can designate a point of contact to coordinate the audit process\n- You can respond to preliminary findings before they become final\n- You can request clarification on any audit methodology or conclusion\n\n## Clearing Up Common Misconceptions\n\n### Misconception: \"The LCA guarantees me a job in the petroleum sector\"\n\n**Reality**: The LCA guarantees first consideration, not a guaranteed job. You must still meet the legitimate qualifications for the role. What the Act prevents is qualified Guyanese being overlooked in favour of international candidates without justification.\n\n### Misconception: \"I must be paid the same as any expatriate in my company\"\n\n**Reality**: Equal pay applies to work of equal value. If an expatriate has significantly more experience or different qualifications, some pay differential may be justified. What the Act prevents is paying Guyanese less solely because of their nationality.\n\n### Misconception: \"The Secretariat will get my job back if I was unfairly passed over\"\n\n**Reality**: The Secretariat enforces compliance with the Act but is not an employment tribunal. They can investigate, require corrective action, and impose penalties — but they cannot directly order a company to hire you. For individual employment disputes, you may also need to engage the Chief Labour Officer or the courts.\n\n### Misconception: \"Only big companies need to comply\"\n\n**Reality**: Every Contractor, Sub-Contractor, and Licensee must comply, regardless of size. A small Guyanese company sub-contracting to a major operator is still subject to the Act.\n\n## How to Advocate for Yourself Effectively\n\n### Know Your Rights\n\n- Familiarize yourself with the specific sections of the Act that protect you\n- Understand your company\'s obligations and how they should be implemented\n- Keep informed about Secretariat announcements and guidance\n\n### Document Everything\n\n- Keep copies of job applications, correspondence with employers, pay stubs, and training records\n- If you observe potential non-compliance, note the date, what you observed, and who was involved\n- Written records are far more powerful than verbal recollections in any investigation\n\n### Use Available Channels\n\n- Start with your company\'s internal compliance mechanisms\n- If internal channels are ineffective, contact the Secretariat\n- Engage with industry associations and professional networks that advocate for local workers\n- Consider whether your concern is better addressed as an individual complaint or as part of a collective advocacy effort\n\n### Stay Professional\n\n- Present your concerns factually and specifically, not emotionally\n- Focus on documented evidence rather than assumptions\n- Be willing to engage constructively — most companies want to comply and may simply need the issue brought to their attention\n- Remember that building relationships with your employer is usually more effective than adversarial approaches\n\n\"Your rights under the LCA are real, enforceable, and important. But rights are only as strong as the people who exercise them. Know the Act, document your experience, and don\'t be afraid to speak up.\"",
      quiz: [
        { question: "What is the maximum fine for LCA non-compliance?", options: ["GY$1M", "GY$10M", "GY$50M", "GY$100M"], correctIndex: 2 },
        { question: "False submissions to the Secretariat are:", options: ["A warning offense", "A civil penalty", "A criminal offense", "Not penalized"], correctIndex: 2 },
        { question: "Section 19 requires employers to invest in:", options: ["Equipment", "Capacity development for Guyanese", "Government programs", "Environmental protection"], correctIndex: 1 },
        { question: "Equal pay is guaranteed by which section?", options: ["Section 12", "Section 18", "Section 19", "Section 23"], correctIndex: 1 },
        { question: "Job postings must be:", options: ["In English only", "Advertised internationally first", "Advertised locally first", "Approved by the Secretariat"], correctIndex: 2 },
        { question: "Who can be personally liable for false LCA reports?", options: ["Only the company", "Only the CEO", "Individuals who sign or certify reports", "No one"], correctIndex: 2 },
        { question: "Where should workers file LCA complaints?", options: ["The police", "The courts", "The Local Content Secretariat", "The Ministry of Labour"], correctIndex: 2 },
      ],
    },
    {
      title: "Guyana\'s Petroleum Sector Overview",
      content: "## Guyana\'s Oil Story\n\n### From Colonial Past to Petroleum Future\n\nGuyana\'s petroleum story is one of the most remarkable economic transformations in modern history. For decades, Guyana\'s economy was built on sugar, rice, gold, and bauxite. The country\'s population of approximately 800,000 made it one of South America\'s smallest economies.\n\nEverything changed in 2015 when ExxonMobil announced a world-class oil discovery offshore.\n\n### The Timeline of Discovery\n\n- **1999**: Guyana awards its first modern petroleum exploration licenses\n- **2008**: CGX Energy drills early exploration wells with limited success\n- **2015**: ExxonMobil announces the Liza-1 discovery — over 1 billion barrels recoverable in a single find\n- **2016-2019**: Rapid succession of additional discoveries — Payara, Snoek, Turbot, Ranger, Pacora, and more\n- **2019**: First oil produced from the Liza Destiny FPSO in December\n- **2020-present**: Multiple FPSOs brought online, production scaling rapidly\n\n### The Scale of the Find\n\nWith over 30 discoveries and estimated recoverable resources exceeding 11 billion barrels of oil equivalent, Guyana\'s Stabroek Block is one of the most significant petroleum discoveries of the 21st century. On a per-capita basis, Guyana\'s oil wealth is among the highest in the world.\n\n## The Stabroek Block\n\n### Geography and Scale\n\nThe Stabroek Block covers approximately 26,800 square kilometres (6.6 million acres) in the Atlantic Ocean, roughly 200 kilometres offshore from Georgetown. To put this in perspective, the block is larger than the entire country of Guyana\'s developed coastal plain.\n\n### The Partnership\n\nThe Stabroek Block is operated under a Petroleum Agreement between the Government of Guyana and a consortium:\n- **ExxonMobil Guyana Limited**: 45% interest, Operator\n- **Hess Guyana Exploration**: 30% interest\n- **CNOOC Petroleum Guyana Limited**: 25% interest\n\n### Other Blocks\n\nWhile Stabroek dominates the headlines, other blocks are also being explored:\n- **Canje Block**: Operated by TotalEnergies\n- **Kaieteur Block**: Operated by ExxonMobil\n- **Corentyne Block**: Multiple operators\n- **Demerara Block**: Frontier exploration\n\n## Current Production and Projected Growth\n\n### Where Guyana Stands Today\n\nAs of 2024-2025, Guyana produces over 600,000 barrels of oil per day, making it one of the top oil producers in the Western Hemisphere on a per-capita basis. Production has grown from zero to this level in just five years — an unprecedented ramp-up.\n\n### Production Growth Trajectory\n\n- **2020**: ~120,000 barrels per day (Liza Phase 1 only)\n- **2022**: ~360,000 barrels per day (Liza Phase 1 + Unity)\n- **2024**: ~600,000+ barrels per day (adding Prosperity)\n- **2025-2026**: Expected to exceed 800,000+ barrels per day (adding Yellowtail)\n- **2027+**: Could exceed 1.2 million barrels per day with additional projects\n\n### What This Means Economically\n\nEach FPSO generates billions of dollars in revenue annually. Guyana\'s GDP has more than quadrupled since first oil, making it the fastest-growing economy in the world for several consecutive years. This growth creates enormous opportunities — but only if Guyanese citizens and companies are positioned to participate.\n\n## The FPSOs — Guyana\'s Offshore Giants\n\n### What is an FPSO?\n\nA Floating Production Storage and Offloading vessel (FPSO) is essentially a floating oil processing factory. It receives crude oil from subsea wells, processes it, stores it in its hull, and offloads it to tanker ships for export. FPSOs are ideal for Guyana\'s deepwater environment where fixed platforms are impractical.\n\n### Liza Destiny (Phase 1)\n\n- **First Oil**: December 2019\n- **Capacity**: ~140,000 barrels per day\n- **Builder**: SBM Offshore\n- **Significance**: Guyana\'s first-ever oil production facility\n\n### Liza Unity (Phase 2)\n\n- **First Oil**: February 2022\n- **Capacity**: ~250,000 barrels per day\n- **Builder**: SBM Offshore\n- **Significance**: Doubled Guyana\'s production capacity\n\n### Prosperity (Payara)\n\n- **First Oil**: November 2023\n- **Capacity**: ~220,000 barrels per day\n- **Builder**: SBM Offshore\n- **Significance**: Third FPSO, bringing production to over 600,000 bpd\n\n### Yellowtail One (Yellowtail)\n\n- **Expected First Oil**: 2025\n- **Capacity**: ~250,000 barrels per day\n- **Builder**: SBM Offshore\n- **Significance**: Will push total production toward 850,000+ bpd\n\n### Future FPSOs\n\nAdditional FPSOs are in planning for the Uaru, Whiptail, and other developments, potentially bringing Guyana\'s total to 8-10 FPSOs by the early 2030s.\n\n## Major Operators and Their Roles\n\n### ExxonMobil Guyana Limited\n\nAs the operator of the Stabroek Block, ExxonMobil makes the day-to-day decisions about drilling, production, and development. They employ hundreds of staff in Guyana and manage the contractor ecosystem.\n\n### Hess Guyana Exploration\n\nHess holds a 30% interest in Stabroek and has been a key partner in the block\'s development. Hess Guyana has established a significant corporate presence in Georgetown and invests in community and education programs.\n\n### CNOOC Petroleum Guyana Limited\n\nChina\'s CNOOC holds a 25% interest and participates in investment decisions and technical oversight. Their presence brings additional international capital and expertise to Guyana\'s petroleum development.\n\n### TotalEnergies\n\nOperating the Canje Block and with interests in other acreage, TotalEnergies represents additional exploration upside for Guyana beyond the Stabroek discoveries.\n\n## The Service Company Ecosystem\n\n### Who Does What\n\nThe petroleum sector involves far more than just the oil companies. A vast ecosystem of service companies provides the specialised skills, equipment, and support needed for operations.\n\n### Major International Service Companies in Guyana\n\n- **Halliburton**: Drilling services, well completions, production enhancement\n- **SLB (Schlumberger)**: Reservoir characterisation, drilling, production technology\n- **Baker Hughes**: Oilfield equipment, digital solutions, chemicals\n- **TechnipFMC**: Subsea systems, surface technologies, project management\n- **Saipem**: Engineering, drilling, offshore construction\n- **SBM Offshore**: FPSO design, construction, and operation\n- **Stena Drilling**: Drilling rig operations\n\n### The Local Service Layer\n\nBetween the major international companies and the petroleum operators, a growing layer of Guyanese service companies provides:\n- Shore base operations (GYSBI)\n- Vessel services and marine logistics\n- Catering, accommodation, and camp management\n- Transportation and freight\n- Environmental services\n- Construction and fabrication\n- Security services\n\n## Supply Chain Opportunities\n\n### Where Guyanese Businesses Can Compete\n\nThe petroleum sector\'s supply chain offers opportunities at every level of complexity and investment:\n\n### Near-Term Opportunities (Available Now)\n\n- Catering and food services for offshore and onshore facilities\n- Transportation and logistics (land, river, and coastal)\n- Accommodation and hospitality for petroleum workers\n- Office services, cleaning, and facility management\n- Environmental monitoring and waste management\n- Basic fabrication and welding services\n\n### Medium-Term Opportunities (Building Capability)\n\n- Equipment maintenance and repair\n- Warehousing and inventory management\n- Safety training and certification\n- Scaffolding and industrial services\n- Marine vessel operation and maintenance\n- Engineering consulting and design\n\n### Long-Term Opportunities (Requires Significant Investment)\n\n- Subsea equipment and services\n- Advanced drilling technology\n- Process engineering and optimisation\n- Specialised marine vessels\n- Digital oilfield solutions\n\n### The Key to Success\n\nSuccessful Guyanese companies in the petroleum supply chain share common traits: they invest in certifications and quality management systems, build relationships with international partners, maintain rigorous safety standards, and continuously develop their workforce capabilities.\n\n## The Natural Resource Fund\n\n### Managing Guyana\'s Oil Wealth\n\nThe Natural Resource Fund (NRF) was established by the Natural Resource Fund Act 2021 to manage Guyana\'s petroleum revenues responsibly and transparently.\n\n### How It Works\n\n- All petroleum revenues flow into the NRF\n- The Fund is managed according to strict investment and withdrawal rules\n- Withdrawals are limited to a percentage of the Fund\'s balance, ensuring intergenerational equity\n- An independent board provides oversight\n- Regular public reporting ensures transparency\n\n### The Fiscal Framework\n\nGuyana\'s petroleum fiscal regime includes:\n- A 2% royalty on production\n- 50% profit oil sharing (after cost recovery)\n- Corporate tax on the operators\' income\n\n### Why It Matters for Local Content\n\nThe NRF ensures that petroleum wealth benefits future generations, not just the current one. Combined with the LCA\'s requirement for local participation, the goal is to build a diversified, resilient economy that doesn\'t depend on oil prices — using today\'s petroleum revenues to invest in education, infrastructure, healthcare, and economic diversification.\n\n## Environmental Considerations and ESG\n\n### Environmental Responsibility\n\nOperating in deepwater environments carries inherent environmental risks. Guyana\'s regulatory framework, including the Environmental Protection Agency (EPA), sets standards for:\n\n- Oil spill prevention and response\n- Marine ecosystem protection\n- Emissions monitoring and reduction\n- Waste management and disposal\n- Decommissioning planning\n\n### ESG in the Petroleum Sector\n\nEnvironmental, Social, and Governance (ESG) considerations are increasingly central to the petroleum sector globally, and Guyana is no exception:\n\n- **Environmental**: Climate impact, biodiversity protection, water quality\n- **Social**: Local content, community engagement, worker rights, indigenous peoples\' rights\n- **Governance**: Transparency, anti-corruption, regulatory compliance\n\n### The Connection to Local Content\n\nLocal content is itself an ESG priority — the \"S\" (Social) pillar specifically addresses whether host communities benefit from resource extraction. Companies that demonstrate strong local content performance enhance their ESG ratings and social license to operate.\n\n## Career Paths in the Petroleum Sector\n\n### For Job Seekers\n\nThe petroleum sector offers diverse career paths for Guyanese nationals at every education level:\n\n### Entry-Level Opportunities\n\n- Logistics and warehouse coordinators\n- Administrative and office support\n- HSE technicians and safety officers\n- Catering and hospitality staff\n- Data entry and document control\n\n### Mid-Career Technical Roles\n\n- Petroleum engineering technicians\n- Geoscience data analysts\n- Mechanical and electrical technicians\n- Environmental monitoring specialists\n- IT and systems support\n\n### Senior and Specialised Roles\n\n- Petroleum engineers\n- Geologists and geophysicists\n- Operations managers\n- HSE managers\n- Commercial and contracts managers\n- Project engineers\n\n### How to Prepare\n\n- Pursue relevant qualifications — University of Guyana, GOAL, and the Board of Industrial Training all offer petroleum-related programs\n- Obtain industry certifications (NEBOSH, BOSIET, IWCF, OPITO)\n- Gain experience through internships and entry-level positions\n- Build your network within the petroleum community\n- Register your skills on job platforms used by petroleum companies\n\n## Upcoming Developments\n\n### Gas-to-Energy Project\n\nOne of Guyana\'s most transformative infrastructure projects, the Gas-to-Energy initiative will pipe natural gas from the Stabroek Block to shore, where it will fuel a power plant providing affordable, reliable electricity. This project is expected to dramatically reduce electricity costs and create hundreds of construction and operation jobs.\n\n### New Exploration Blocks\n\nAdditional offshore blocks are being offered for licensing, potentially opening new frontiers beyond the proven Stabroek Block. Each new exploration program creates demand for local services and employment.\n\n### Future FPSOs\n\nWith the Uaru and Whiptail developments in planning, Guyana could have 8-10 FPSOs operating by the early 2030s, each requiring thousands of support jobs and billions of dollars in supply chain expenditure.\n\n### Onshore Infrastructure\n\nMajor infrastructure investments are underway including the new Demerara Harbour Bridge, upgraded roads, the Gas-to-Energy pipeline, and new port facilities — all driven by petroleum sector growth and all creating opportunities for local companies.\n\n## Your Role in Guyana\'s Transformation\n\n### This is Your Moment\n\nGuyana\'s petroleum sector is not just an economic opportunity — it\'s a generational transformation. Within a single decade, Guyana has gone from a small developing economy to one of the world\'s most exciting petroleum provinces.\n\n### How You Can Participate\n\n- **As a Worker**: Build your skills, pursue certifications, and ensure you know your rights under the LCA. The sector needs qualified Guyanese nationals at every level\n- **As a Business Owner**: Get LCS-certified, invest in your capabilities, build relationships with international companies, and position yourself in the supply chain\n- **As a Compliance Professional**: Help companies navigate the LCA effectively — there is enormous demand for people who understand both the legal requirements and practical implementation\n- **As a Citizen**: Stay informed about petroleum sector developments, hold companies and government accountable, and participate in the public discourse about how Guyana\'s resource wealth should be managed\n\n### The Long View\n\nOil is finite. The 11+ billion barrels in Guyana\'s offshore reservoirs will eventually be produced. What matters most is not the oil itself, but what Guyana builds with the opportunity it creates. The Local Content Act is a critical tool in ensuring that when the oil stops flowing, Guyana has a diversified economy, a skilled workforce, and strong institutions that endure.\n\n\"Guyana\'s petroleum story is still being written. Every Guyanese national, every local business, every compliance professional has a role in making sure it\'s a story of shared prosperity, not missed opportunity.\"",
      quiz: [
        { question: "Who operates the Stabroek Block?", options: ["Halliburton", "ExxonMobil Guyana Limited", "TotalEnergies", "Petrobras"], correctIndex: 1 },
        { question: "When was Guyana\'s first oil produced?", options: ["2017", "2018", "2019", "2020"], correctIndex: 2 },
        { question: "What does FPSO stand for?", options: ["First Petroleum Supply Operation", "Floating Production Storage and Offloading", "Federal Petroleum Safety Office", "Fixed Platform Shore Operations"], correctIndex: 1 },
        { question: "GYSBI provides:", options: ["Drilling services", "Shore base operations", "Legal services", "Banking services"], correctIndex: 1 },
        { question: "Guyana\'s estimated recoverable oil resources are:", options: ["1 billion barrels", "5 billion barrels", "11+ billion barrels", "50 billion barrels"], correctIndex: 2 },
        { question: "What is the name of Guyana\'s first FPSO?", options: ["Liza Unity", "Prosperity", "Liza Destiny", "Yellowtail One"], correctIndex: 2 },
        { question: "The Natural Resource Fund was established to:", options: ["Fund the military", "Manage petroleum revenues responsibly", "Pay for ExxonMobil\'s costs", "Fund political campaigns"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < moduleData.length; i++) {
    const m = moduleData[i];
    await db.insert(courseModules).values({
      courseId: course.id,
      orderIndex: i + 1,
      title: m.title,
      content: m.content,
      quizQuestions: JSON.stringify(m.quiz),
    });
  }

  return course.id;
}

export async function seedPlatformCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "mastering-lca-desk")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "mastering-lca-desk",
    title: "Mastering LCA Desk",
    description: "Learn how to use every feature of LCA Desk — from filing your first report to managing your entire compliance workflow. Required for new team members.",
    audience: "filer",
    jurisdictionCode: null, // Platform course — applies to all jurisdictions
    moduleCount: 8,
    badgeLabel: "Platform Certified",
    badgeColor: "gold",
    estimatedMinutes: 45,
  }).returning();

  const moduleData = [
    {
      title: "Getting Started: Dashboard & Navigation",
      content: `## Your Dashboard\n\nWhen you log in, the dashboard shows your **Compliance Health Score** — a 0-100 score based on your Local Content Rate and employment percentages.\n\n## Key Dashboard Elements\n- **Compliance Health Widget** — Your LC rate, employment breakdown vs LCA minimums, supplier cert expiry warnings\n- **Upcoming Deadlines** — Filing dates with countdown\n- **Recent Activity** — What your team has done recently\n- **Entity Cards** — Each company you file for\n\n## Sidebar Navigation\nThe sidebar is organized into four sections:\n- **Compliance** — Entities, Log Payment, Reports, Calendar\n- **Workforce** — Employees, Jobs, Talent Pool\n- **Market** — Opportunities, Companies, Suppliers\n- **Resources** — Training, LCA Expert, Support, Settings\n\n## First Steps\n1. Add your first entity (company)\n2. Create a reporting period\n3. Start entering expenditure data`,
      quiz: [
        { question: "What does the Compliance Health Score measure?", options: ["Revenue", "LC rate + employment percentages", "Number of employees", "Number of reports filed"], correctIndex: 1 },
        { question: "Where do you add a new company to file for?", options: ["Settings", "Entities", "Reports", "Calendar"], correctIndex: 1 },
        { question: "How many sidebar sections are there?", options: ["2", "3", "4", "5"], correctIndex: 2 },
        { question: "What's the first thing a new user should do?", options: ["Run a report", "Add an entity", "Change settings", "Export data"], correctIndex: 1 },
        { question: "The Calendar section shows:", options: ["Holidays", "Filing deadlines with countdown", "Team birthdays", "Meeting schedule"], correctIndex: 1 },
      ],
    },
    {
      title: "Entities & Reporting Periods",
      content: `## What is an Entity?\n\nAn entity represents a company or subsidiary that has LCA filing obligations. Each entity files its own reports.\n\n## Creating an Entity\nGo to **Entities** in the sidebar → click **Add Entity**. Fill in:\n- Legal name (must match LCS registration)\n- Company type (Contractor, Sub-Contractor, Licensee)\n- Contact information\n- LCS Certificate ID (if applicable)\n\n## Starting a Report\nFrom the entity detail page, click **Start New Report**. Select:\n- **Report type**: H1 Half-Yearly, H2 Half-Yearly, Annual Plan, or Performance Report\n- **Fiscal year**: The year being reported on\n- Dates auto-fill based on LCA filing calendar\n\n## Reporting Periods\n- H1 (Jan–Jun) — due July 30\n- H2 (Jul–Dec) — due January 30 of next year\n- When you submit one period, the next is auto-created\n\n## Filing Workflow\nEach period follows these steps:\n1. Company Info (auto-filled from entity)\n2. Expenditure records\n3. Employment records\n4. Capacity Development records\n5. AI Narrative drafts\n6. Review & Compliance Check\n7. Export & Submit`,
      quiz: [
        { question: "An entity represents:", options: ["A user account", "A company with filing obligations", "A report", "A supplier"], correctIndex: 1 },
        { question: "H1 reports cover which months?", options: ["Jan–Mar", "Jan–Jun", "Jul–Dec", "Jan–Dec"], correctIndex: 1 },
        { question: "When is the H2 report due?", options: ["December 31", "January 30 of next year", "July 30", "March 31"], correctIndex: 1 },
        { question: "How many steps are in the filing workflow?", options: ["3", "5", "7", "10"], correctIndex: 2 },
        { question: "After submitting H1, what happens?", options: ["Nothing", "Account is locked", "H2 is auto-created", "You must call the Secretariat"], correctIndex: 2 },
      ],
    },
    {
      title: "Expenditure & Supplier Management",
      content: `## Recording Expenditure\n\nThe expenditure sub-report tracks all procurement spending. Each record includes:\n- Type of item procured (Goods or Services)\n- Related LCA sector category\n- Supplier name and LCS Certificate ID\n- Actual payment amount\n- Payment method and bank location\n\n## Supplier Auto-Suggest\nWhen typing a supplier name, LCA Desk searches the **787+ LCS-registered companies** and auto-fills the certificate ID. This saves time and ensures accuracy.\n\n## Local Content Rate\nYour LC Rate = (Guyanese supplier spend ÷ Total spend) × 100%\n\nA supplier counts as "Guyanese" if they have a valid LCS Certificate ID.\n\n## Log Payment (Between Filings)\nUse **Log Payment** in the sidebar to record supplier payments as they happen throughout the quarter. These entries show your running LC rate and can be imported into the formal filing period.\n\n## CSV Import\nHave data in a spreadsheet? Click **Import CSV** on the expenditure page to bulk-upload records.\n\n## Supplier Directory\nBrowse the **Suppliers** page to find LCS-registered companies by name or category.`,
      quiz: [
        { question: "How many LCS-registered companies are in the auto-suggest?", options: ["100+", "500+", "787+", "1000+"], correctIndex: 2 },
        { question: "A supplier counts as Guyanese if they have:", options: ["A Guyana address", "A valid LCS Certificate ID", "Guyanese employees", "Been in business 5+ years"], correctIndex: 1 },
        { question: "What is the Log Payment feature for?", options: ["Paying bills", "Recording payments between filing periods", "Invoicing customers", "Payroll"], correctIndex: 1 },
        { question: "LC Rate formula is:", options: ["Employees ÷ Total × 100", "Guyanese spend ÷ Total spend × 100", "Reports filed ÷ Due × 100", "Suppliers ÷ Total × 100"], correctIndex: 1 },
        { question: "CSV Import is used to:", options: ["Export data", "Bulk-upload records from a spreadsheet", "Create reports", "Send emails"], correctIndex: 1 },
      ],
    },
    {
      title: "Employment & Workforce Compliance",
      content: `## Recording Employment Data\n\nThe employment sub-report tracks your workforce by category. Each record includes:\n- Job title\n- Employment category (Managerial, Technical, Non-Technical)\n- ISCO-08 classification code\n- Total employees in this role\n- Number of Guyanese employed\n- Remuneration data\n\n## LCA Employment Minimums\n- **Managerial**: 75% Guyanese\n- **Technical**: 60% Guyanese\n- **Non-Technical**: 80% Guyanese\n\nThe sidebar shows pass/fail indicators for each category.\n\n## Jobs Board\nPost positions through **Jobs** in the sidebar. Each posting:\n- Auto-generates a Guyanese First Consideration statement (Section 12)\n- Links to an entity for employment reporting\n- Tracks applications with status pipeline\n\n## Talent Pool\nSearch the **Talent Pool** for Guyanese candidates who've opted in. Filter by skills, category, experience. Contact info requires Pro plan.\n\n## Hire → Employee Flow\nWhen you hire an applicant:\n1. Click "Hire" on their application\n2. Select the entity to assign them to\n3. An employee record is auto-created with Guyanese status pre-filled\n4. The record appears in your next employment filing`,
      quiz: [
        { question: "What is the Guyanese minimum for Technical roles?", options: ["50%", "60%", "75%", "80%"], correctIndex: 1 },
        { question: "When you hire an applicant, what happens?", options: ["Nothing automatically", "Employee record is auto-created", "You must manually add them", "An email is sent to the Secretariat"], correctIndex: 1 },
        { question: "The Jobs board auto-generates:", options: ["A job description", "A Guyanese First Consideration statement", "An employment contract", "A salary offer"], correctIndex: 1 },
        { question: "ISCO-08 is:", options: ["A safety certification", "An occupation classification system", "A tax code", "A company registration number"], correctIndex: 1 },
        { question: "Talent Pool contact info requires:", options: ["Lite plan", "Pro plan", "Enterprise plan", "No plan needed"], correctIndex: 1 },
      ],
    },
    {
      title: "AI Features: Narrative Drafting & Expert Chat",
      content: `## AI Narrative Drafting\n\nThe LCA requires written narratives for each sub-report. LCA Desk generates these using AI:\n\n1. Go to the **Narrative** step in your filing workflow\n2. Click **Generate** for each section (Expenditure, Employment, Capacity)\n3. The AI analyzes your actual data and writes a compliant narrative\n4. Edit as needed, then save\n\nAll three narratives must be completed before the filing can be submitted.\n\n## LCA Expert Chat\n\nThe **LCA Expert** in the sidebar is an AI assistant that knows:\n- The complete Local Content Act 2021\n- Your actual compliance data (LC rate, employment percentages, deadlines)\n- LCS guidelines and templates\n\nAsk it things like:\n- "Am I on track for H2?"\n- "Which employment categories am I below minimum?"\n- "When is my next filing due?"\n- "What is Section 12 of the LCA?"\n\nIt gives personalized answers using your real numbers.\n\n## AI Compliance Scan\nOn the **Review** page, the AI scans your entire filing for compliance issues before submission.`,
      quiz: [
        { question: "How many narrative sections must be completed?", options: ["1", "2", "3", "5"], correctIndex: 2 },
        { question: "The LCA Expert knows your:", options: ["Only the Act text", "Actual compliance data and the Act", "Nothing about your data", "Only deadlines"], correctIndex: 1 },
        { question: "AI narratives are generated from:", options: ["Template text", "Your actual filing data", "Previous reports", "Manual input only"], correctIndex: 1 },
        { question: "The AI Compliance Scan runs on which page?", options: ["Dashboard", "Entities", "Review", "Settings"], correctIndex: 2 },
        { question: "Which AI model powers narrative drafting?", options: ["GPT-4", "Claude (Anthropic)", "Gemini", "Llama"], correctIndex: 1 },
      ],
    },
    {
      title: "Review, Export & Submission",
      content: `## Review & Validation\n\nBefore exporting, the **Review** page runs compliance checks:\n- Are all sections populated?\n- Do employment percentages meet LCA minimums?\n- Are supplier certificate IDs valid?\n- Are narratives complete?\n\n## Export Files\nTwo files are generated for the Secretariat:\n1. **Excel Report** — Matches the official LCS Template v4.1\n2. **PDF Narrative** — Comparative Analysis Report with signature block\n\n## Submission Workflow\nLCA Desk uses a formal workflow:\n1. **Draft** → data entry in progress\n2. **In Review** → "Send for Review" marks it for internal review\n3. **Approved** → "Approve" confirms it's ready\n4. **Submitted** → Attest and submit (locks the report)\n\n## Attestation\nBefore submitting, you must check the attestation box:\n> "I certify that the information contained in this report is true, accurate, and complete... penalties of up to GY$50,000,000."\n\n## After Submission\n- Report is **locked** (read-only)\n- A **data snapshot** is saved\n- A **submission receipt** PDF is downloadable\n- The **next period** is auto-created\n- A **confirmation email** is sent\n- All changes are logged in the **audit trail**`,
      quiz: [
        { question: "How many files are submitted to the Secretariat?", options: ["1", "2", "3", "4"], correctIndex: 1 },
        { question: "After submission, the report is:", options: ["Editable", "Locked (read-only)", "Deleted", "Sent automatically"], correctIndex: 1 },
        { question: "The attestation references penalties of up to:", options: ["GY$1M", "GY$10M", "GY$50M", "GY$100M"], correctIndex: 2 },
        { question: "What happens to the next filing period?", options: ["Nothing", "You must create it manually", "It's auto-created", "It's assigned to a different user"], correctIndex: 2 },
        { question: "The audit trail records:", options: ["Only submissions", "All changes to all records", "Only login events", "Nothing"], correctIndex: 1 },
      ],
    },
    {
      title: "Reports, Calendar & Notifications",
      content: `## Compliance Reports\n\nThe **Reports** page shows analytics across all your entities:\n- LC Rate trend over time\n- Employment by category vs LCA minimums\n- Top suppliers by spend (with LCS badges)\n- Expenditure by sector\n- Filing compliance (on-time vs late vs overdue)\n- Capacity development investment\n- Hiring pipeline (posted → applied → hired)\n- Entity compliance scorecard\n\n## Calendar\nThe **Calendar** shows all filing deadlines. You can:\n- Export to Outlook/Google Calendar (ICS download)\n- Deadlines include 14-day and 7-day reminders\n\n## Notifications\nLCA Desk sends notifications via:\n- **In-app** — bell icon in the top bar\n- **Email** — automated via Resend\n\nNotification types:\n- Deadline reminders (30, 14, 7, 3, 1 days)\n- Application received / status changed\n- Report submitted confirmation\n- Supplier cert expiry warnings\n\n## Weekly Digest\nEvery Monday, a digest email summarizes:\n- Your LC rate and employment %\n- Upcoming deadlines\n- New opportunities matching your categories\n- Expiring supplier certs\n\nManage preferences in **Settings → Notifications**.`,
      quiz: [
        { question: "The weekly digest is sent on:", options: ["Friday", "Monday", "Daily", "Monthly"], correctIndex: 1 },
        { question: "Calendar deadlines can be exported as:", options: ["PDF", "CSV", "ICS (calendar file)", "Excel"], correctIndex: 2 },
        { question: "Deadline reminders are sent at:", options: ["Only on due date", "30, 14, 7, 3, 1 days before", "Weekly only", "Never"], correctIndex: 1 },
        { question: "The Reports page shows:", options: ["Only financial data", "Analytics across all entities", "Only deadlines", "Tax information"], correctIndex: 1 },
        { question: "Notification preferences are managed in:", options: ["Dashboard", "Calendar", "Settings → Notifications", "Support"], correctIndex: 2 },
      ],
    },
    {
      title: "Opportunities, Companies & Market Intelligence",
      content: `## Opportunities Feed\n\nThe **Opportunities** page shows 190+ procurement notices scraped from the LCS Register. Each notice includes:\n- AI-generated summary (scope, requirements, deadlines)\n- Company logo and contact info\n- Embedded PDF viewer for original documents\n- Save/bookmark functionality (Pro plan)\n\nFilter by: type, status, company, notice type, AI analyzed. Sort by: newest, oldest, deadline, company.\n\n## Company Directory\n**Companies** shows 700+ profiles auto-generated from:\n- LCS procurement notices\n- Employment postings\n- LCS Register (certified suppliers)\n\nEach profile aggregates opportunities, jobs, contact info, and categories. Companies can **claim their profile** to manage it.\n\n## Market Intelligence\nClick **Market Intelligence** on the Opportunities page for:\n- Top contractors by activity\n- Notice type distribution\n- Monthly activity trends\n- Procurement categories\n\n## Contractor Profiles\nClick any company to see:\n- All their procurement notices and job postings\n- Contact info (Pro plan)\n- LCS registration details\n- Service categories`,
      quiz: [
        { question: "How many procurement notices are in the feed?", options: ["50+", "100+", "190+", "500+"], correctIndex: 2 },
        { question: "Company profiles are generated from:", options: ["User submissions only", "LCS Register + opportunities + jobs", "Government data only", "Manual entry"], correctIndex: 1 },
        { question: "Companies can do what with their profile?", options: ["Delete it", "Claim it", "Hide it", "Sell it"], correctIndex: 1 },
        { question: "Saving opportunities requires:", options: ["Free account", "Pro plan", "Enterprise plan", "No account"], correctIndex: 1 },
        { question: "How many company profiles are in the directory?", options: ["100+", "300+", "500+", "700+"], correctIndex: 3 },
      ],
    },
  ];

  for (let i = 0; i < moduleData.length; i++) {
    const m = moduleData[i];
    await db.insert(courseModules).values({
      courseId: course.id,
      orderIndex: i + 1,
      title: m.title,
      content: m.content,
      quizQuestions: JSON.stringify(m.quiz),
    });
  }

  return course.id;
}

export async function seedSupplierCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "supplier-success")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "supplier-success",
    title: "Supplier Success on LCA Desk",
    description: "Learn how to maximize your visibility, respond to opportunities, and grow your business through Guyana's petroleum sector supply chain.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 5,
    badgeLabel: "Supplier Certified",
    badgeColor: "success",
    estimatedMinutes: 25,
  }).returning();

  const supplierModules = [
    { title: "Your Verified Company Profile", content: "## The Verified Companies Directory\n\nLCA Desk maintains a directory of **796+ LCS-registered companies** scraped from the official register. If your company is registered, you already have a profile.\n\n## Claiming Your Profile\n1. Find your company in **Verified Companies**\n2. Click **Claim This Business**\n3. Verify via email domain, LCS certificate, or manual review\n4. Update contact info and showcase capabilities\n\n## LCS Verification\nCompanies with a valid LCS Certificate show a green **\"LCS Verified\"** badge — telling contractors that procurement from you counts toward their Local Content Rate.\n\n## Getting Registered\nNot registered yet? Use **LCS Certificate as a Service** at /register-lcs — guided registration starting at $49.",
      quiz: [
        { question: "How many LCS-registered companies are in the directory?", options: ["100+", "400+", "796+", "1000+"], correctIndex: 2 },
        { question: "What does 'LCS Verified' mean?", options: ["Paid for ads", "Has valid LCS Certificate", "Government-owned", "Has filed reports"], correctIndex: 1 },
        { question: "How can you claim your profile?", options: ["Pay a fee", "Email domain, LCS cert, or manual review", "Call Secretariat", "Submit a report"], correctIndex: 1 },
        { question: "The directory is sourced from:", options: ["User submissions", "Official LCS Register", "Google", "Company websites"], correctIndex: 1 },
        { question: "LCS registration starts at:", options: ["$29", "$49", "$99", "$199"], correctIndex: 1 },
      ],
    },
    { title: "Browsing & Responding to Opportunities", content: "## The Opportunity Feed\n\n**190+ procurement notices** scraped from the LCS website with AI summaries.\n\n## Finding Opportunities\n- Search by company or keyword\n- Filter by notice type (EOI, RFQ, RFP, RFI)\n- Sort by newest, deadline, or company\n\n## Expressing Interest\n1. Click **Respond** on any opportunity\n2. Enter your contact email\n3. Add an optional cover note\n4. Submit\n\n## Free vs Pro\n- **Free**: 3 responses/month\n- **Supplier Pro ($99/mo)**: Unlimited\n\n## Response Pipeline\nInterested → Contacted → Shortlisted → Awarded",
      quiz: [
        { question: "How many procurement notices are available?", options: ["50+", "100+", "190+", "500+"], correctIndex: 2 },
        { question: "Free plan allows how many responses/month?", options: ["1", "3", "5", "Unlimited"], correctIndex: 1 },
        { question: "Supplier Pro costs:", options: ["$49/mo", "$99/mo", "$199/mo", "$399/mo"], correctIndex: 1 },
        { question: "First pipeline status after responding:", options: ["Pending", "Interested", "Applied", "Submitted"], correctIndex: 1 },
        { question: "Response tracking requires:", options: ["Free plan", "Supplier Pro", "Enterprise", "No plan"], correctIndex: 1 },
      ],
    },
    { title: "Building Your Supplier Profile", content: "## Essential Information\n- **Legal Name** — must match LCS registration\n- **Contact Email & Phone**\n- **Service Categories** — 18+ categories\n- **Employee Count & Year Established**\n- **Guyanese Ownership** — required for compliance\n\n## Capability Statement (Pro)\nPro members add a detailed description visible to all contractors.\n\n## Why Complete Profiles Win\nComplete profiles with multiple categories, contact info, capability statement, and verified LCS certificate rank higher in search.",
      quiz: [
        { question: "Legal name should match:", options: ["Trading name", "LCS registration", "Email domain", "Bank account"], correctIndex: 1 },
        { question: "Service categories available:", options: ["5+", "10+", "18+", "50+"], correctIndex: 2 },
        { question: "Capability Statements require:", options: ["Free", "Supplier Pro", "Enterprise", "Manual approval"], correctIndex: 1 },
        { question: "What ranks profiles higher?", options: ["Paying more", "Complete info + LCS verification", "More employees", "Being older"], correctIndex: 1 },
        { question: "Guyanese ownership is required for:", options: ["Tax", "LCA compliance", "Banking", "Insurance"], correctIndex: 1 },
      ],
    },
    { title: "Analytics & Growth (Pro)", content: "## Profile Views\nSee how many contractors viewed your profile.\n\n## Response Pipeline\n- Opportunities responded to\n- Breakdown by status\n- **Award Rate** — % leading to contracts\n- Monthly activity chart\n\n## Priority Placement\nPro suppliers appear higher in search results.\n\n## Direct Contact Visibility\nPro makes your email and phone visible to all contractors.",
      quiz: [
        { question: "Analytics is available on:", options: ["Free", "Supplier Pro", "All plans", "Enterprise only"], correctIndex: 1 },
        { question: "Award Rate measures:", options: ["Views", "Responses leading to contracts", "Revenue", "Hires"], correctIndex: 1 },
        { question: "Pro suppliers get:", options: ["Lower pricing", "Priority placement", "Government endorsement", "Free ads"], correctIndex: 1 },
        { question: "High views, few responses suggests:", options: ["Need more staff", "Should respond to more opportunities", "Bad profile", "Change industries"], correctIndex: 1 },
        { question: "Direct contact means:", options: ["Secretariat contacts you", "Contractors see your email/phone", "Auto calls", "Auto email"], correctIndex: 1 },
      ],
    },
    { title: "From Supplier to Filer", content: "## When Do Suppliers File?\nMost suppliers do NOT file. But some grow into sub-contractors.\n\n## Upgrading\n1. Dashboard → **Start Filing**\n2. Company info and LCS cert pre-fill\n3. **30-day Professional trial**\n4. Role becomes **supplier + filer**\n\n## What Stays\n- Supplier profile stays active\n- Opportunity responses preserved\n- Analytics continue",
      quiz: [
        { question: "Do most suppliers file?", options: ["Yes", "No", "Only large ones", "Only international"], correctIndex: 1 },
        { question: "Upgrading gives:", options: ["New account", "30-day Professional trial", "Enterprise", "Secretariat access"], correctIndex: 1 },
        { question: "After upgrading, supplier profile:", options: ["Deleted", "Stays active", "Locked", "Hidden"], correctIndex: 1 },
        { question: "Filing triggered by:", options: ["100+ employees", "Winning operator contract", "Being LCS registered", "Pro account"], correctIndex: 1 },
        { question: "Dual-role user accesses:", options: ["Only filing", "Only supplier", "Both portals", "Must choose"], correctIndex: 2 },
      ],
    },
  ];

  for (let i = 0; i < supplierModules.length; i++) {
    const m = supplierModules[i];
    await db.insert(courseModules).values({
      courseId: course.id, orderIndex: i + 1,
      title: m.title, content: m.content,
      quizQuestions: JSON.stringify(m.quiz),
    });
  }

  return course.id;
}

// ─── COURSE: FILING YOUR FIRST REPORT ───────────────────────────

export async function seedFirstReportCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "first-report")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "first-report",
    title: "Filing Your First Report",
    description: "Step-by-step guide to completing and submitting your first Local Content Half-Yearly Report. The course that gets you from signup to submission.",
    audience: "filer",
    jurisdictionCode: "GY",
    moduleCount: 4,
    badgeLabel: "First Filer",
    badgeColor: "accent",
    estimatedMinutes: 20,
  }).returning();

  const mods = [
    { title: "Setting Up Your Entity", content: "## Your First Entity\n\nAn entity represents a company that files LCA reports. After signup, your first entity is auto-created.\n\n## What You Need\n- Legal name (must match your LCS registration)\n- Company type: Contractor, Sub-Contractor, or Licensee\n- LCS Certificate ID (format: LCSR-XXXXXXXX)\n- Contact name and email\n\n## Company Types Explained\n- **Contractor**: Direct agreement with the Government (e.g., ExxonMobil)\n- **Sub-Contractor**: Agreement with a Contractor (e.g., Halliburton)\n- **Licensee**: Holder of a petroleum licence\n\n## Starting a Report\nFrom your entity page, click **Start New Report**. Select H1 (Jan-Jun) or H2 (Jul-Dec). Dates and deadlines auto-fill from the Secretariat schedule.",
      quiz: [
        { question: "What format is the LCS Certificate ID?", options: ["LCS-001", "LCSR-XXXXXXXX", "GY-CERT-001", "LC-2021"], correctIndex: 1 },
        { question: "An entity represents:", options: ["A user account", "A company with filing obligations", "A report", "A billing account"], correctIndex: 1 },
        { question: "H1 covers which months?", options: ["Jan-Mar", "Jan-Jun", "Jul-Dec", "Full year"], correctIndex: 1 },
        { question: "Company type 'Sub-Contractor' means:", options: ["Works for the government directly", "Has agreement with a Contractor", "Is a Guyanese company", "Has no filing obligation"], correctIndex: 1 },
        { question: "After starting a report, deadlines:", options: ["Must be entered manually", "Auto-fill from the Secretariat schedule", "Don't exist", "Are sent by email"], correctIndex: 1 },
      ],
    },
    { title: "Entering Expenditure Data", content: "## The Expenditure Sub-Report\n\nThis is where you record every payment made during the reporting period.\n\n## For Each Payment, Record:\n- Type of item (Goods or Services)\n- Related sector (from the LCA First Schedule)\n- Supplier name (auto-suggest from 796+ LCS register)\n- Supplier Type (Guyanese or Non-Guyanese)\n- Supplier Certificate ID (for Guyanese suppliers)\n- Actual payment amount\n- Currency and payment method\n\n## Speed Tips\n- **Click cells to edit inline** — no modal needed for quick fixes\n- **Paste from Excel** — copy rows from a spreadsheet, paste into the table\n- **Save & Add Another** — batch entry without closing the form\n- **Import Excel** — upload the official Secretariat template directly\n\n## Local Content Rate\nYour LC Rate = Guyanese supplier spend ÷ Total spend × 100%\n\nThe sidebar shows this in real-time as you enter data.",
      quiz: [
        { question: "How many LCS-registered suppliers are in the auto-suggest?", options: ["100+", "400+", "796+", "1000+"], correctIndex: 2 },
        { question: "LC Rate formula:", options: ["Employees ÷ Total × 100", "Guyanese spend ÷ Total spend × 100", "Reports filed ÷ Due × 100", "Suppliers ÷ Total × 100"], correctIndex: 1 },
        { question: "To bulk-add records from a spreadsheet:", options: ["Email them to support", "Copy rows and paste into the table", "Use the Log Payment feature", "Print and scan them"], correctIndex: 1 },
        { question: "A supplier counts as Guyanese if:", options: ["They have a Guyana address", "They have an LCS Certificate or are marked as Guyanese", "They employ Guyanese people", "They were founded in Guyana"], correctIndex: 1 },
        { question: "The Related Sector dropdown contains:", options: ["5 options", "20 options", "40+ options from the First Schedule", "Unlimited custom entries"], correctIndex: 2 },
      ],
    },
    { title: "Employment & Capacity Data", content: "## Employment Sub-Report\n\nRecord every position in your workforce.\n\n## For Each Position:\n- Job title and ISCO-08 classification\n- Employment category: Managerial, Technical, or Non-Technical\n- Total employees and number of Guyanese employed\n- Total remuneration and Guyanese remuneration\n\n## LCA Employment Minimums\n- **Managerial**: 75% Guyanese\n- **Technical**: 60% Guyanese\n- **Non-Technical**: 80% Guyanese\n\n## Capacity Development Sub-Report\n\nRecord all training activities:\n- Activity name and category\n- Participant type (Guyanese Internal, External, Mixed, etc.)\n- Number of participants (Guyanese and total)\n- Duration in days\n- Cost and expenditure\n\n## Why This Matters\nThe Secretariat cross-references your employment data with your expenditure to verify first consideration compliance.",
      quiz: [
        { question: "Minimum Guyanese % for Technical roles:", options: ["50%", "60%", "75%", "80%"], correctIndex: 1 },
        { question: "ISCO-08 is:", options: ["A safety standard", "An occupation classification system", "A tax code", "A company registration"], correctIndex: 1 },
        { question: "Capacity Development includes:", options: ["Only classroom training", "All training, scholarships, and mentoring", "Only safety courses", "Only Guyanese participants"], correctIndex: 1 },
        { question: "Remuneration means:", options: ["Only base salary", "Total compensation including bonuses and overtime", "Only Guyanese pay", "Equipment costs"], correctIndex: 1 },
        { question: "The Secretariat cross-references employment with:", options: ["Tax records", "Expenditure data", "Bank statements", "Immigration records"], correctIndex: 1 },
      ],
    },
    { title: "Review, Export & Submit", content: "## The Final Steps\n\n### 1. AI Narrative Drafting\nClick **Generate** for each section. The AI writes your Comparative Analysis Report using your actual data and LCA terminology. Edit as needed.\n\n### 2. Review & Compliance Check\nThe Review page runs validation:\n- All sections populated?\n- Employment meets minimums?\n- Certificate IDs valid?\n- Narratives complete?\n\n### 3. Export Three Files\n- **Excel Report** — Secretariat Version 4.1 format\n- **Narrative PDF** — Comparative Analysis Report\n- **Notice of Submission** — Required cover letter\n\n### 4. Submit\nChoose platform submission (instant) or email.\n\n### 5. Attestation\nCheck the attestation box confirming accuracy. This locks the report permanently.\n\n## After Submission\n- Report is locked (read-only)\n- Data snapshot saved\n- Receipt PDF available\n- Next period auto-created\n- Confirmation email sent",
      quiz: [
        { question: "How many files are submitted to the Secretariat?", options: ["1", "2", "3", "4"], correctIndex: 2 },
        { question: "After attestation, the report is:", options: ["Editable for 24 hours", "Locked permanently", "Sent for review", "Deleted"], correctIndex: 1 },
        { question: "AI Narrative Drafting uses:", options: ["Generic templates", "Your actual filing data", "Last year's report", "Manual input only"], correctIndex: 1 },
        { question: "The Notice of Submission is:", options: ["Optional", "Required by the Secretariat", "Generated by the Secretariat", "Only for large companies"], correctIndex: 1 },
        { question: "After submitting H1, what happens?", options: ["Nothing", "H2 is auto-created", "Account is locked", "You must call the Secretariat"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: UNDERSTANDING THE FIRST SCHEDULE ───────────────────

export async function seedFirstScheduleCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "first-schedule")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "first-schedule",
    title: "Understanding the First Schedule",
    description: "Deep dive into the 40+ reserved sector categories in the LCA First Schedule. Know exactly what counts as local content in your operations.",
    audience: "filer",
    jurisdictionCode: "GY",
    moduleCount: 3,
    badgeLabel: "Sector Expert",
    badgeColor: "gold",
    estimatedMinutes: 25,
  }).returning();

  const mods = [
    { title: "What is the First Schedule?", content: "## The First Schedule of the LCA\n\nThe First Schedule of the Local Content Act lists all sector categories where minimum local content levels apply.\n\n## Why It Matters\nEvery expenditure you record must be classified into one of these sectors. The Secretariat uses this to measure whether contractors are giving first consideration to Guyanese suppliers.\n\n## Key Categories Include:\n- Rental of Office Space\n- Accommodation Services\n- Equipment Rental\n- Surveying\n- Construction Work (Onshore)\n- Structural Fabrication\n- Waste Management (Hazardous & Non-Hazardous)\n- Storage Services (Warehousing)\n- Catering and Food Services\n- Transportation (Trucking, Ground, Marine)\n- Security Services\n- ICT and Network Services\n- And 30+ more...\n\n## The 'Other' Category\nIf your procurement doesn't fit any listed category, use 'Other'. But the Secretariat may ask you to justify why a specific category wasn't used.",
      quiz: [
        { question: "The First Schedule lists:", options: ["Employment rules", "40+ reserved sector categories", "Penalty amounts", "Filing deadlines"], correctIndex: 1 },
        { question: "Every expenditure must be classified into:", options: ["Any category you choose", "A First Schedule sector category", "The cheapest category", "Multiple categories"], correctIndex: 1 },
        { question: "The 'Other' category should be used:", options: ["For all international suppliers", "When no specific category fits", "For the largest payments", "Never"], correctIndex: 1 },
        { question: "Storage Services falls under:", options: ["Transportation", "Warehousing (its own category)", "Equipment Rental", "Admin Support"], correctIndex: 1 },
        { question: "The Secretariat uses sector classification to:", options: ["Calculate taxes", "Measure first consideration compliance", "Set prices", "Hire staff"], correctIndex: 1 },
      ],
    },
    { title: "High-Impact Sectors", content: "## Sectors Where Local Content Matters Most\n\n### Catering and Food Services\nOne of the highest-adoption sectors. Most contractors use Guyanese catering companies for onshore and some offshore operations.\n\n### Transportation Services\nGround transportation, trucking, and marine logistics have strong Guyanese participation. Companies like G-Boats Inc. and local trucking firms dominate.\n\n### Engineering and Machining\nGrowing sector with companies like Raghunath Engineering Solutions, ProTech Engineering. Structural fabrication is increasingly localized.\n\n### Environmental Services\nEnvironmental Impact Assessments, waste management, and remediation are required for all petroleum activities. Several Guyanese firms now provide these.\n\n### Security Services\nAll onshore facilities require security. This is nearly 100% localized.\n\n### ICT and Network Services\nTelecommunications, network installation, and IT support for offices and operations.\n\n## Sectors Still Dominated by International Firms\n- Drilling and Well Services (highly specialized)\n- Subsea Services (requires deep-water equipment)\n- ROV Services (remote operated vehicles)\n- FPSO Operations (floating production)",
      quiz: [
        { question: "Which sector has the highest local adoption?", options: ["Drilling", "Catering and Food Services", "Subsea Services", "ROV Services"], correctIndex: 1 },
        { question: "Security services are approximately:", options: ["10% local", "50% local", "Nearly 100% local", "0% local"], correctIndex: 2 },
        { question: "Drilling services are dominated by:", options: ["Guyanese firms", "International firms", "Government agencies", "No one"], correctIndex: 1 },
        { question: "Environmental services are:", options: ["Optional", "Required for all petroleum activities", "Only for onshore", "Only for international firms"], correctIndex: 1 },
        { question: "Structural fabrication is:", options: ["Declining locally", "Increasingly localized", "Banned for local firms", "Only done offshore"], correctIndex: 1 },
      ],
    },
    { title: "Classifying Your Expenditure", content: "## How to Choose the Right Sector\n\n### Step 1: Read the Description\nEach sector has a specific definition. 'Storage Services (Warehousing)' is different from 'Laydown Yard Facilities'.\n\n### Step 2: Match the Primary Activity\nClassify by the primary service provided, not the supplier's general business. A logistics company providing trucking should be classified under 'Transportation Services: Trucking', not 'Cargo Management'.\n\n### Step 3: When in Doubt\nAsk: 'What am I paying for?' The answer points to the correct sector.\n\n## Common Mistakes\n- Classifying all SLB payments as 'Engineering' when some are 'Borehole Testing'\n- Using 'Other' when 'Admin Support & Facilities Management' fits\n- Mixing up 'Construction Work (Onshore)' with 'Structural Fabrication'\n- Classifying meals as 'Food Supply' when it's 'Catering Services'\n\n## The LCA Expert Can Help\nAsk the AI: 'Which sector category should I use for [description]?' It knows all 40+ categories and their definitions.",
      quiz: [
        { question: "Classify by:", options: ["The supplier's company type", "The primary service provided", "The largest payment", "Alphabetical order"], correctIndex: 1 },
        { question: "A logistics company providing trucking is classified as:", options: ["Cargo Management", "Transportation Services: Trucking", "Engineering", "Other"], correctIndex: 1 },
        { question: "Meals provided to staff should be classified as:", options: ["Food Supply", "Catering Services", "Admin Support", "Other"], correctIndex: 1 },
        { question: "When unsure about classification, you should:", options: ["Use 'Other' always", "Ask the LCA Expert AI", "Skip the record", "Call the Secretariat"], correctIndex: 1 },
        { question: "'Storage Services' is different from:", options: ["Warehousing", "Laydown Yard Facilities", "Equipment Rental", "Security Services"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: PREPARING FOR A SECRETARIAT AUDIT ──────────────────

export async function seedAuditPrepCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "audit-prep")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "audit-prep",
    title: "Preparing for a Secretariat Audit",
    description: "What the Secretariat looks for, common rejection reasons, and how to self-audit your submission before filing. Reduce your risk of amendment requests.",
    audience: "filer",
    jurisdictionCode: "GY",
    moduleCount: 3,
    badgeLabel: "Audit Ready",
    badgeColor: "gold",
    estimatedMinutes: 20,
  }).returning();

  const mods = [
    { title: "What the Secretariat Reviews", content: "## The Review Process\n\nWhen you submit a Half-Yearly Report, the Secretariat reviews:\n\n### 1. Completeness\n- All three sub-reports present (Expenditure, Employment, Capacity)\n- All columns filled for every record\n- Narratives included for each section\n- Notice of Submission attached\n\n### 2. Accuracy\n- Do expenditure amounts match bank records?\n- Are Guyanese supplier Certificate IDs valid and current?\n- Do employment headcounts match actual payroll?\n- Are ISCO-08 classifications correct?\n\n### 3. Compliance\n- Local Content Rate vs sector benchmarks\n- Employment percentages vs LCA minimums (75/60/80)\n- First consideration evidence in narratives\n- Sole source justifications where applicable\n\n### 4. Consistency\n- Do numbers match between sub-reports?\n- Does the narrative reference actual data?\n- Are period dates correct?\n- Is the company type consistent with LCS registration?",
      quiz: [
        { question: "The Secretariat reviews how many aspects?", options: ["2", "3", "4", "5"], correctIndex: 2 },
        { question: "ISCO-08 classifications are checked for:", options: ["Completeness only", "Accuracy", "Whether they exist", "Formatting"], correctIndex: 1 },
        { question: "First consideration evidence is found in:", options: ["The Excel report", "The narratives", "The Notice of Submission", "Separate documentation"], correctIndex: 1 },
        { question: "Consistency means:", options: ["All numbers are high", "Numbers match between sub-reports", "Everything is formatted correctly", "All suppliers are Guyanese"], correctIndex: 1 },
        { question: "Employment percentages are checked against:", options: ["Industry averages", "LCA minimums (75/60/80)", "Previous reports", "International standards"], correctIndex: 1 },
      ],
    },
    { title: "Common Rejection Reasons", content: "## Top 10 Amendment Request Triggers\n\n### 1. Missing Supplier Certificate IDs\nGuyanese suppliers without valid LCSR- numbers. The Secretariat can't verify local content claims.\n\n### 2. Employment Below Minimums\nManagerial <75%, Technical <60%, or Non-Technical <80% without justification.\n\n### 3. Vague Narratives\n'We gave first consideration to local suppliers' without specific examples, numbers, or sector references.\n\n### 4. Misclassified Sectors\nUsing 'Other' when a specific First Schedule category applies.\n\n### 5. Missing Capacity Development\nNo training records for a company with 100+ employees raises flags.\n\n### 6. Inconsistent Headcounts\nEmployment sub-report says 50 employees but narrative mentions 75.\n\n### 7. No Sole Source Justification\nNon-Guyanese procurement without a Sole Source Code or explanation.\n\n### 8. Expired LCS Certificates\nUsing Certificate IDs that expired during the reporting period.\n\n### 9. Missing Remuneration Data\nV4 requires remuneration data for all positions — total and Guyanese-only.\n\n### 10. Late Filing\nH1 due July 30, H2 due January 30. Late submissions trigger penalties.",
      quiz: [
        { question: "The #1 rejection trigger is:", options: ["Late filing", "Missing Supplier Certificate IDs", "Low LC rate", "Bad formatting"], correctIndex: 1 },
        { question: "If Technical employment is 55%, you need:", options: ["Nothing", "Justification for being below 60% minimum", "To fire non-Guyanese staff", "To stop filing"], correctIndex: 1 },
        { question: "An expired LCS Certificate:", options: ["Still counts as Guyanese", "Does NOT count for that period", "Never expires", "Can be renewed retroactively"], correctIndex: 1 },
        { question: "Capacity Development records are expected when:", options: ["Always", "Only for large companies", "Company has significant workforce", "Never"], correctIndex: 2 },
        { question: "V4 requires remuneration data that is:", options: ["Optional", "Total and Guyanese-only breakdown", "Only for managers", "Only in GYD"], correctIndex: 1 },
      ],
    },
    { title: "Self-Audit Checklist", content: "## Before You Submit: The Self-Audit\n\nRun through this checklist before clicking 'Attest & Submit':\n\n### Expenditure\n- [ ] Every Guyanese supplier has a valid LCSR- Certificate ID\n- [ ] Supplier Type (Guyanese/Non-Guyanese) set for all records\n- [ ] Non-Guyanese suppliers without Sole Source Code are justified\n- [ ] Sector categories match actual procurement (not all 'Other')\n- [ ] Payment amounts match actual bank records\n- [ ] Currency is correct (GYD vs USD)\n\n### Employment\n- [ ] All three categories (Managerial/Technical/Non-Technical) represented\n- [ ] Guyanese percentages meet or exceed minimums\n- [ ] ISCO-08 classifications assigned\n- [ ] Remuneration data filled for all positions\n- [ ] Headcounts match actual payroll\n\n### Capacity Development\n- [ ] All training activities recorded\n- [ ] Participant types correctly categorized\n- [ ] Guyanese participant counts accurate\n- [ ] Training expenditure documented\n\n### Narratives\n- [ ] All three sections drafted (Expenditure, Employment, Capacity)\n- [ ] Specific examples and numbers referenced\n- [ ] First consideration explained concretely\n- [ ] Sole source situations justified\n\n### Export\n- [ ] All three files generated (Excel, Narrative PDF, Notice of Submission)\n- [ ] Notice of Submission has correct period and company name\n\n## Use the AI Compliance Scan\nThe Review page runs an automated check. Fix all flagged issues before submitting.",
      quiz: [
        { question: "Before submitting, you should:", options: ["Just click submit", "Run through the self-audit checklist", "Call the Secretariat", "Wait for an email"], correctIndex: 1 },
        { question: "The AI Compliance Scan runs on:", options: ["The Dashboard", "The Review page", "After submission", "The Settings page"], correctIndex: 1 },
        { question: "How many files should be generated before submission?", options: ["1", "2", "3", "4"], correctIndex: 2 },
        { question: "Narratives should include:", options: ["Generic statements", "Specific examples and numbers", "Only legal references", "Minimal text"], correctIndex: 1 },
        { question: "If headcounts don't match payroll:", options: ["Submit anyway", "Fix before submitting", "The Secretariat won't notice", "It doesn't matter"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: WINNING PETROLEUM CONTRACTS ─────────────────────────

export async function seedWinningContractsCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "winning-contracts")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "winning-contracts",
    title: "Winning Petroleum Contracts",
    description: "How to write capability statements, respond to EOIs/RFQs, and position your company to win contracts from petroleum operators in Guyana.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 4,
    badgeLabel: "Contract Winner",
    badgeColor: "gold",
    estimatedMinutes: 25,
  }).returning();

  const mods = [
    { title: "Understanding the Procurement Cycle", content: "## How Contractors Procure\n\nPetroleum operators follow a structured procurement process:\n\n### 1. Expression of Interest (EOI)\nThe contractor announces they need a service. You express interest and provide basic capability info. This is your first impression.\n\n### 2. Request for Qualification (RFQ)\nContractor shortlists companies and asks for detailed qualifications — safety records, experience, certifications, financial capacity.\n\n### 3. Request for Proposal (RFP)\nFormal bid. You submit a technical proposal and commercial offer. Price matters, but so does capability and local content.\n\n### 4. Evaluation & Award\nContractor evaluates proposals on technical merit, price, HSE record, and local content contribution. First consideration must go to Guyanese companies.\n\n### 5. Contract Execution\nNegotiation, contract signing, mobilization.\n\n## Where to Find Opportunities\n- LCA Desk Opportunities feed (190+ notices)\n- LCS website (lcsguyana.com)\n- Direct contractor portals (ExxonMobil, SLB, etc.)\n- Industry networking events",
      quiz: [
        { question: "The first step in procurement is usually:", options: ["RFP", "Contract signing", "Expression of Interest (EOI)", "Invoice"], correctIndex: 2 },
        { question: "RFQ stands for:", options: ["Request for Quality", "Request for Qualification", "Report for Quarterly", "Required for Quotation"], correctIndex: 1 },
        { question: "First consideration in evaluation goes to:", options: ["The cheapest bid", "International firms", "Guyanese companies", "The largest company"], correctIndex: 2 },
        { question: "LCA Desk has how many procurement notices?", options: ["50+", "100+", "190+", "500+"], correctIndex: 2 },
        { question: "The procurement cycle ends with:", options: ["EOI submission", "Contract execution", "RFP submission", "Evaluation"], correctIndex: 1 },
      ],
    },
    { title: "Writing a Capability Statement", content: "## Your Capability Statement\n\nThis is the single most important document for winning work. It tells contractors what you can do.\n\n## What to Include\n\n### Company Overview (1 paragraph)\nWho you are, when established, employee count, Guyanese ownership %.\n\n### Services Offered (bullet list)\nSpecific services mapped to LCA First Schedule categories. Don't be vague — \"Engineering services\" loses to \"Structural fabrication, pipe welding, and CNC machining.\"\n\n### Key Projects (3-5 examples)\nProject name, client, scope, value, duration. Show you've done similar work.\n\n### Certifications & Compliance\n- LCS Certificate ID\n- ISO certifications\n- Safety certifications (BOSIET, H2S, etc.)\n- Insurance coverage\n\n### Equipment & Capacity\nMajor equipment owned, workshop/yard facilities, vehicle fleet.\n\n### Contact Information\nKey personnel, email, phone, address.\n\n## Common Mistakes\n- Too vague (\"We do everything\")\n- No specific examples\n- Missing LCS Certificate\n- Poor formatting / spelling errors\n- Not updated for 2+ years",
      quiz: [
        { question: "A capability statement should include:", options: ["Only pricing", "Company overview, services, projects, certifications", "Just a logo", "Employee salaries"], correctIndex: 1 },
        { question: "'Engineering services' is:", options: ["A strong service description", "Too vague — be specific", "Perfect for all bids", "What the Secretariat recommends"], correctIndex: 1 },
        { question: "Key projects should show:", options: ["Revenue only", "Client, scope, value, and duration", "Employee names", "Profit margins"], correctIndex: 1 },
        { question: "Updating your capability statement should happen:", options: ["Never", "Every 5 years", "At least annually", "Only when bidding"], correctIndex: 2 },
        { question: "The LCS Certificate should be:", options: ["Hidden", "Prominently displayed", "Only mentioned if asked", "Excluded from bids"], correctIndex: 1 },
      ],
    },
    { title: "Responding to Opportunities on LCA Desk", content: "## Using LCA Desk to Respond\n\n### Step 1: Browse Opportunities\nFilter by notice type (EOI, RFQ, RFP, RFI), sector category, and company. Save interesting ones for later.\n\n### Step 2: Express Interest\nClick **Respond** on any opportunity. Add your contact email and a cover note.\n\n### Cover Note Best Practices\n- Lead with your most relevant experience\n- Reference the specific service requested\n- Mention your LCS Certificate ID\n- Keep it under 200 words\n- End with a call to action (\"We welcome the opportunity to discuss...\")\n\n### Step 3: Track Your Pipeline\nSupplier Pro ($99/mo) unlocks:\n- Full response tracking (Interested → Contacted → Shortlisted → Awarded)\n- Analytics (award rate, profile views)\n- Priority placement in the directory\n\n### Step 4: Follow Up\nIf contacted, respond within 24 hours. Prepare your capability statement in advance.\n\n## Response Limits\n- Free plan: 3 responses per month\n- Supplier Pro: Unlimited responses",
      quiz: [
        { question: "Free plan allows how many responses?", options: ["1/month", "3/month", "5/month", "Unlimited"], correctIndex: 1 },
        { question: "A cover note should be:", options: ["500+ words", "Under 200 words with relevant experience", "A full proposal", "Just your name"], correctIndex: 1 },
        { question: "Response tracking requires:", options: ["Free plan", "Supplier Pro", "Enterprise", "Government approval"], correctIndex: 1 },
        { question: "When contacted by a contractor, respond within:", options: ["1 week", "24 hours", "1 month", "No rush"], correctIndex: 1 },
        { question: "Your cover note should reference:", options: ["Your competitor's weaknesses", "The specific service requested", "Your personal opinions", "Political connections"], correctIndex: 1 },
      ],
    },
    { title: "Positioning for First Consideration", content: "## First Consideration Advantage\n\nUnder the LCA, contractors must give first consideration to Guyanese companies. Here's how to make that work for you.\n\n## What 'First Consideration' Actually Means\n- Guyanese companies must be evaluated BEFORE international companies\n- If a Guyanese company can meet the requirements, they should be selected\n- Contractors must document why they chose a non-Guyanese supplier\n\n## How to Maximize Your Advantage\n\n### 1. Get LCS Certified\nWithout a valid LCS Certificate, you don't count as a Guyanese supplier in the contractor's LC rate. Get certified or renew before expiry.\n\n### 2. Match Your Services to the First Schedule\nMap your capabilities to specific First Schedule categories. Contractors classify every purchase — if your services match a category, you're a natural fit.\n\n### 3. Build Relationships Before the RFP\nAttend industry events, register on contractor portals, respond to EOIs even if you don't win. Visibility matters.\n\n### 4. Demonstrate Capacity\nContractors worry about local firms' ability to deliver at scale. Show evidence: equipment, workforce, past project values.\n\n### 5. Partner for Scale\nIf a contract is too large, consider joint ventures with other Guyanese firms. A consortium of 3 local companies beats one international firm in LC rate calculations.",
      quiz: [
        { question: "First consideration means:", options: ["Guyanese companies are always cheapest", "Guyanese companies must be evaluated first", "International firms are excluded", "The government decides the winner"], correctIndex: 1 },
        { question: "Without an LCS Certificate, you:", options: ["Can still bid", "Don't count in the contractor's LC rate", "Are automatically rejected", "Must apply every year"], correctIndex: 1 },
        { question: "Contractors must document:", options: ["All purchases over $100", "Why they chose a non-Guyanese supplier", "Employee satisfaction", "Equipment maintenance"], correctIndex: 1 },
        { question: "Joint ventures help by:", options: ["Reducing costs", "Increasing combined capacity for larger contracts", "Avoiding LCA compliance", "Reducing paperwork"], correctIndex: 1 },
        { question: "Responding to EOIs you won't win is:", options: ["A waste of time", "Good for visibility and relationship building", "Not allowed", "Only for large companies"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: GETTING LCS CERTIFIED ──────────────────────────────

export async function seedLcsCertCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "lcs-certification")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "lcs-certification",
    title: "Getting LCS Certified",
    description: "Everything you need to know about the LCS registration process — requirements, documents, and how to get certified through LCA Desk.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 3,
    badgeLabel: "Cert Ready",
    badgeColor: "success",
    estimatedMinutes: 15,
  }).returning();

  const mods = [
    { title: "Why LCS Certification Matters", content: "## The Business Case\n\nAn LCS Certificate is your ticket to the petroleum supply chain.\n\n## What It Does\n- Proves you're a registered Guyanese company\n- Allows contractors to count payments to you as local content\n- Gets you listed in the official LCS Register (796+ companies)\n- Shows up as 'LCS Verified' on LCA Desk (green badge)\n\n## Who Needs It\n- Any Guyanese-owned company wanting to supply the petroleum sector\n- Individuals seeking employment who want to prove Guyanese status\n- Companies that want to be listed in the supplier directory\n\n## The Certificate Format\nLCSR-XXXXXXXX (8 hexadecimal characters after the prefix)\n\n## Expiration\nCertificates have an expiration date. If yours expires, contractors can no longer count procurement from you as local content. You effectively become invisible to the compliance system.\n\n## Cost of NOT Having One\nA Guyanese company without LCS certification is treated the same as an international company in LC rate calculations. You lose your competitive advantage.",
      quiz: [
        { question: "LCS Certificate format:", options: ["LCS-001", "LCSR-XXXXXXXX", "GY-CERT-001", "LC-2021-001"], correctIndex: 1 },
        { question: "Without LCS certification, a Guyanese company:", options: ["Can still count as local content", "Is treated the same as an international company", "Cannot operate in Guyana", "Must pay a fine"], correctIndex: 1 },
        { question: "The LCS Register contains:", options: ["100+", "400+", "796+", "1000+"], correctIndex: 2 },
        { question: "If your certificate expires:", options: ["Nothing changes", "Contractors can't count your procurement as local", "You're automatically renewed", "You must close your business"], correctIndex: 1 },
        { question: "LCS Verified on LCA Desk shows as:", options: ["A red badge", "A green badge", "A yellow badge", "No badge"], correctIndex: 1 },
      ],
    },
    { title: "Registration Requirements", content: "## What You Need\n\n### For Businesses\n- Business Registration Certificate\n- TIN Certificate (Tax Identification Number)\n- Director/Owner National ID\n- Proof of Business Address\n- NIB Certificate of Good Standing (recommended)\n- GRA Tax Clearance (recommended)\n- Company Profile / Portfolio\n\n### For Individuals\n- National ID or Passport\n- TIN Certificate\n- Proof of Address\n- CV / Resume\n- Professional Certifications\n\n### Guyanese Ownership Requirement\nTo qualify as a 'Guyanese company', the business must be majority-owned (51%+) by Guyanese nationals. The Secretariat may verify ownership structure.\n\n## Common Application Errors\n- Expired TIN certificate\n- Business registration not matching the name on application\n- Missing proof of address (utility bill or bank statement)\n- National ID expired or unclear scan\n- No service categories selected",
      quiz: [
        { question: "Minimum Guyanese ownership for certification:", options: ["25%", "50%", "51%+", "100%"], correctIndex: 2 },
        { question: "TIN stands for:", options: ["Total Income Number", "Tax Identification Number", "Trade Information Notice", "Territorial ID Number"], correctIndex: 1 },
        { question: "Proof of address can be:", options: ["A verbal statement", "Utility bill or bank statement", "A text message", "Social media profile"], correctIndex: 1 },
        { question: "Most common application error:", options: ["Wrong font size", "Expired TIN certificate", "Too many pages", "Wrong email address"], correctIndex: 1 },
        { question: "Business name on application must match:", options: ["Your trading name", "Business Registration Certificate", "Your personal name", "Your bank account name"], correctIndex: 1 },
      ],
    },
    { title: "Applying Through LCA Desk", content: "## LCS Certificate as a Service\n\nLCA Desk offers guided registration at three tiers:\n\n### Self-Service ($49)\n- Step-by-step application wizard\n- Document checklist\n- Auto-filled forms\n- Submit-ready package\n\n### Managed ($99) — Most Popular\n- Everything in Self-Service\n- Document review and error checking\n- Resubmission handling if issues found\n- Email support\n\n### Concierge ($199)\n- Everything in Managed\n- Dedicated support agent\n- Expedited processing\n- Renewal management for 1 year\n\n## The Process\n1. Go to /register-lcs on LCA Desk\n2. Choose Individual or Business\n3. Select your service tier\n4. Fill in your details\n5. Upload required documents\n6. Pay and submit\n7. We review and submit to the Secretariat\n8. You receive your LCSR- Certificate ID\n\n## After Certification\n- Your profile appears in the Verified Companies directory\n- Contractors can find you by service category\n- You're visible to all filers on the platform\n- Set up expiry alerts so you never lose coverage",
      quiz: [
        { question: "Self-Service tier costs:", options: ["$29", "$49", "$99", "$199"], correctIndex: 1 },
        { question: "Most popular tier is:", options: ["Self-Service", "Managed", "Concierge", "Free"], correctIndex: 1 },
        { question: "After certification, your profile appears in:", options: ["Google", "Verified Companies directory", "Government gazette", "Social media"], correctIndex: 1 },
        { question: "Concierge includes:", options: ["Only document review", "Renewal management for 1 year", "Lifetime certification", "Government lobbying"], correctIndex: 1 },
        { question: "The application process has how many steps?", options: ["3", "5", "8", "12"], correctIndex: 2 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: PETROLEUM SECTOR CAREER GUIDE ──────────────────────

export async function seedCareerGuideCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "career-guide")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "career-guide",
    title: "Petroleum Sector Career Guide",
    description: "ISCO-08 classifications, key certifications, salary expectations, and career paths in Guyana's petroleum sector.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 3,
    badgeLabel: "Career Ready",
    badgeColor: "accent",
    estimatedMinutes: 20,
  }).returning();

  const mods = [
    { title: "Career Paths in Petroleum", content: "## The Petroleum Workforce\n\nGuyana's petroleum sector employs thousands across three LCA categories:\n\n### Managerial (75% Guyanese minimum)\n- Operations Manager\n- Project Manager\n- HSE Manager\n- Finance Director\n- Supply Chain Manager\n\n### Technical (60% Guyanese minimum)\n- Drilling Engineer\n- Mechanical Engineer\n- Geologist\n- HSE Officer\n- Electrical Technician\n- Marine Pilot\n- ROV Operator\n\n### Non-Technical (80% Guyanese minimum)\n- Admin Assistant\n- Logistics Coordinator\n- Crane Operator\n- Catering Staff\n- Security Officer\n- Warehouse Manager\n\n## ISCO-08 Classification\nEvery position in the petroleum sector is classified using ISCO-08 codes. Understanding your classification helps you:\n- Find matching jobs on LCA Desk\n- Ensure employers categorize you correctly\n- Understand which employment minimum applies to you",
      quiz: [
        { question: "Managerial roles require minimum Guyanese employment of:", options: ["60%", "70%", "75%", "80%"], correctIndex: 2 },
        { question: "A Drilling Engineer falls under:", options: ["Managerial", "Technical", "Non-Technical", "Unclassified"], correctIndex: 1 },
        { question: "ISCO-08 is:", options: ["A safety course", "International occupation classification", "A tax system", "A company type"], correctIndex: 1 },
        { question: "Admin Assistant falls under:", options: ["Managerial", "Technical", "Non-Technical", "None"], correctIndex: 2 },
        { question: "Non-Technical minimum Guyanese employment:", options: ["60%", "70%", "75%", "80%"], correctIndex: 3 },
      ],
    },
    { title: "Essential Certifications", content: "## Certifications That Get You Hired\n\n### Safety Certifications (Most Critical)\n- **BOSIET** (Basic Offshore Safety Induction & Emergency Training) — Required for ALL offshore work\n- **HUET** (Helicopter Underwater Escape Training) — Required for helicopter transport offshore\n- **H2S Alive** — Hydrogen sulfide awareness, required for most field positions\n- **STCW** (Standards of Training, Certification & Watchkeeping) — For marine roles\n\n### Technical Certifications\n- **NEBOSH** (National Examination Board in OSH) — HSE roles\n- **IOSH** (Institution of Occupational Safety and Health) — General safety\n- **API certifications** — For inspection, welding, pipeline work\n- **ASME certifications** — Pressure vessel and piping\n\n### Professional Certifications\n- **PMP** (Project Management Professional)\n- **CPA/ACCA** — Finance and accounting roles\n- **ISO Lead Auditor** — Quality management roles\n\n## Where to Get Certified\nMany certifications are available in Georgetown through:\n- Guyana Fire & Safety Training Centre\n- OGIFS (Oil & Gas Industry Fire & Safety)\n- International providers with local centres\n\n## Cost Range\n- BOSIET: $500-$1,000\n- H2S Alive: $200-$400\n- NEBOSH: $1,500-$3,000\n- PMP: $400-$600",
      quiz: [
        { question: "BOSIET is required for:", options: ["Only managers", "All offshore work", "Only drilling", "Optional"], correctIndex: 1 },
        { question: "H2S stands for:", options: ["Health & Safety Standard", "Hydrogen Sulfide", "High Security System", "Human Safety"], correctIndex: 1 },
        { question: "NEBOSH is relevant for:", options: ["Drilling roles", "HSE roles", "Catering roles", "Admin roles"], correctIndex: 1 },
        { question: "BOSIET costs approximately:", options: ["$100-$200", "$500-$1,000", "$2,000-$5,000", "$10,000+"], correctIndex: 1 },
        { question: "HUET training is for:", options: ["Helicopter escape", "Fire fighting", "First aid", "Diving"], correctIndex: 0 },
      ],
    },
    { title: "Building Your Profile on LCA Desk", content: "## Making Yourself Discoverable\n\n### Complete Your Profile\nA complete profile is visible to contractors in the Talent Pool. Include:\n- Current job title and employment category\n- Skills (be specific: 'FPSO maintenance' not just 'maintenance')\n- Certifications with dates\n- Education level and field\n- Years of experience\n- Location preference\n- Contract type preference\n\n### Opt Into the Talent Pool\nToggle **Profile Visible** in your settings. This lets contractors search for you by skills, category, and certifications.\n\n### Earn Badges\nCompleted courses show as badges on your profile:\n- LCA Certified (blue)\n- Career Ready (blue)\n- Supplier Certified (green)\n\nBadges signal to employers that you understand the regulatory environment.\n\n### Use the Resume Builder\nThe AI-powered resume builder creates petroleum-sector-ready CVs:\n- Extract skills from existing documents\n- Generate from scratch using your profile data\n- Enhance existing resumes with industry keywords\n- Export as PDF\n\n### Set Up Job Alerts\nEnable alerts in Settings to get notified when new jobs matching your category are posted.",
      quiz: [
        { question: "To be found by contractors, you need:", options: ["A paid subscription", "Profile Visible enabled in settings", "A referral", "Government approval"], correctIndex: 1 },
        { question: "Skills should be:", options: ["Vague and general", "Specific like 'FPSO maintenance'", "Only one word", "Not listed"], correctIndex: 1 },
        { question: "Badges appear on:", options: ["Your email signature", "Your Talent Pool profile", "Your bank account", "Government records"], correctIndex: 1 },
        { question: "The Resume Builder can:", options: ["Only format text", "Extract skills, generate, and enhance resumes", "Only print", "Send applications for you"], correctIndex: 1 },
        { question: "Job alerts notify you when:", options: ["Any job is posted anywhere", "Jobs matching your category are posted", "Your application is viewed", "Your profile is viewed"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: INTERVIEW PREP FOR OIL & GAS ───────────────────────

export async function seedInterviewPrepCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "interview-prep")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "interview-prep",
    title: "Interview Prep for Oil & Gas",
    description: "Common interview questions, HSE scenarios, technical assessments, and what petroleum contractors look for when hiring in Guyana.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 3,
    badgeLabel: "Interview Ready",
    badgeColor: "accent",
    estimatedMinutes: 20,
  }).returning();

  const mods = [
    { title: "What Contractors Look For", content: "## The Hiring Mindset\n\nPetroleum contractors evaluate candidates on:\n\n### 1. Safety Culture (Non-Negotiable)\nEvery answer should demonstrate safety awareness. 'Stop Work Authority' — you must be willing to stop unsafe work regardless of schedule pressure.\n\n### 2. Technical Competence\nCan you do the job? Specific experience with relevant equipment, software, or processes matters more than generic qualifications.\n\n### 3. Certifications\nValid BOSIET, H2S, and role-specific certs are table stakes. Expired = not valid.\n\n### 4. Cultural Fit\nCan you work in a multi-national team? 28-day rotation schedule? Remote locations? This is assessed through behavioral questions.\n\n### 5. Local Content Compliance\nContractors want Guyanese nationals. Under the LCA, they must give first consideration to qualified Guyanese. Your nationality is an advantage — own it.\n\n## Common Interview Formats\n- Phone screen (15-30 min)\n- Technical assessment (written or practical)\n- Panel interview (2-3 interviewers)\n- HSE scenario walkthrough\n- Medical and fitness assessment",
      quiz: [
        { question: "The most important trait for petroleum hiring:", options: ["Speed", "Safety culture", "Social skills", "Salary flexibility"], correctIndex: 1 },
        { question: "Stop Work Authority means:", options: ["Managers can stop work", "Anyone can stop unsafe work", "Work stops at 5pm", "The government can stop operations"], correctIndex: 1 },
        { question: "An expired BOSIET certificate is:", options: ["Still valid for 6 months", "Not valid", "Valid if you passed originally", "Transferable"], correctIndex: 1 },
        { question: "Under the LCA, Guyanese nationality is:", options: ["Irrelevant", "A competitive advantage", "A requirement for all roles", "Only relevant for managers"], correctIndex: 1 },
        { question: "A typical interview process includes:", options: ["Just a phone call", "Phone screen, technical assessment, panel interview", "Only a written test", "A single meeting"], correctIndex: 1 },
      ],
    },
    { title: "Common Interview Questions", content: "## Technical Questions\n\n**For Engineers:**\n- Describe your experience with [specific equipment/process]\n- Walk me through a time you solved a technical problem under pressure\n- What standards do you follow for [welding/inspection/design]?\n\n**For HSE Roles:**\n- Describe your approach to a Job Safety Analysis (JSA)\n- How would you handle discovering a colleague not wearing PPE?\n- What's your experience with incident investigation?\n\n**For Operations/Logistics:**\n- How do you prioritize competing demands?\n- Describe your experience managing supply chains in remote locations\n- How do you handle equipment breakdowns during critical operations?\n\n## Behavioral Questions (STAR Method)\nUse Situation, Task, Action, Result:\n\n- 'Tell me about a time you identified a safety hazard'\n- 'Describe a situation where you had to work with a difficult team member'\n- 'Give an example of when you went above and beyond'\n\n## Questions to Ask the Interviewer\n- What does a typical rotation schedule look like?\n- What safety certifications does the team hold?\n- How does the company support local content development?\n- What career progression looks like in this role?",
      quiz: [
        { question: "STAR stands for:", options: ["Safety, Training, Assessment, Review", "Situation, Task, Action, Result", "Standard, Technical, Applied, Reported", "Start, Think, Act, Reflect"], correctIndex: 1 },
        { question: "When asked about PPE non-compliance, you should:", options: ["Ignore it", "Report it and address it directly", "Wait for a manager", "Document it only"], correctIndex: 1 },
        { question: "Asking about rotation schedule shows:", options: ["You're lazy", "You understand the working environment", "You want more time off", "Nothing useful"], correctIndex: 1 },
        { question: "Technical questions test:", options: ["Memorization", "Specific experience with relevant processes", "Speed of thinking", "Personality"], correctIndex: 1 },
        { question: "A JSA is:", options: ["Job Safety Analysis", "Joint Service Agreement", "Junior Staff Assessment", "Jurisdiction Safety Act"], correctIndex: 0 },
      ],
    },
    { title: "After the Interview", content: "## Follow-Up Best Practices\n\n### Within 24 Hours\nSend a brief thank-you email. Reference something specific from the conversation.\n\n### If You Don't Hear Back\nWait 5-7 business days, then follow up once. Be professional, not pushy.\n\n### If You're Offered the Role\n- Review the contract carefully\n- Check rotation schedule, leave policy, medical coverage\n- Verify certifications required before start date\n- Ask about onboarding timeline\n\n### If You're Not Selected\n- Ask for feedback (many companies will provide it)\n- Stay in their database for future opportunities\n- Keep your LCA Desk profile updated\n- Apply to similar roles — persistence pays off\n\n## Red Flags in Offers\n- No written contract before start date\n- Vague terms on payment schedule\n- No mention of insurance or medical coverage\n- Required to pay for your own certifications that should be employer-provided\n- Salary significantly below market rate for the role\n\n## Salary Expectations (Guyana, 2026)\n- Entry-level technical: $80,000-$150,000 GYD/month\n- Mid-level engineer: $200,000-$500,000 GYD/month\n- Senior/Managerial: $500,000-$1,500,000 GYD/month\n- Offshore premium: 30-50% above onshore rates",
      quiz: [
        { question: "Thank-you email should be sent within:", options: ["1 hour", "24 hours", "1 week", "Never"], correctIndex: 1 },
        { question: "If not selected, you should:", options: ["Give up", "Ask for feedback and keep applying", "Complain publicly", "Reapply immediately"], correctIndex: 1 },
        { question: "A red flag in a job offer is:", options: ["Written contract", "Vague payment terms", "Medical coverage", "Onboarding plan"], correctIndex: 1 },
        { question: "Offshore premium is typically:", options: ["5-10% above onshore", "30-50% above onshore", "Same as onshore", "Less than onshore"], correctIndex: 1 },
        { question: "Before accepting an offer, verify:", options: ["Your friend's opinion", "Certifications required before start date", "The CEO's background", "Company stock price"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

// ─── COURSE: ESG & LOCAL CONTENT ────────────────────────────────

export async function seedEsgCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "esg-local-content")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "esg-local-content",
    title: "ESG & Local Content",
    description: "How local content compliance connects to Environmental, Social, and Governance reporting. Relevant to international companies reporting ESG metrics.",
    audience: "all",
    jurisdictionCode: null, // Universal — relevant to all jurisdictions
    moduleCount: 3,
    badgeLabel: "ESG Informed",
    badgeColor: "gold",
    estimatedMinutes: 20,
  }).returning();

  const mods = [
    { title: "What is ESG?", content: "## Environmental, Social, and Governance\n\nESG is a framework used by investors, regulators, and stakeholders to evaluate a company's impact beyond financial returns.\n\n### Environmental\n- Carbon emissions and climate impact\n- Waste management and pollution prevention\n- Biodiversity and ecosystem protection\n- Water usage and treatment\n\n### Social\n- **Local content and community benefit** ← This is where LCA compliance fits\n- Worker health and safety\n- Diversity and inclusion\n- Human rights in supply chains\n- Community engagement\n\n### Governance\n- Board diversity and independence\n- Executive compensation transparency\n- Anti-corruption and bribery policies\n- Regulatory compliance\n\n## Why It Matters\nMajor petroleum companies (ExxonMobil, Hess, TotalEnergies) all publish annual ESG reports. Local content performance in Guyana is a key metric in the 'Social' pillar.\n\n## The Connection\nEvery dollar spent with a Guyanese supplier, every Guyanese national employed, and every training program delivered — these are all ESG data points that international companies report to their shareholders.",
      quiz: [
        { question: "ESG stands for:", options: ["Energy, Safety, Growth", "Environmental, Social, Governance", "Equity, Standards, Guidelines", "Economics, Systems, Goals"], correctIndex: 1 },
        { question: "Local content falls under which ESG pillar?", options: ["Environmental", "Social", "Governance", "None"], correctIndex: 1 },
        { question: "Who reads ESG reports?", options: ["Only the government", "Investors, regulators, and stakeholders", "Only employees", "No one"], correctIndex: 1 },
        { question: "Guyanese supplier spend is:", options: ["Irrelevant to ESG", "An ESG data point for the Social pillar", "Only relevant to Guyana", "A tax metric"], correctIndex: 1 },
        { question: "Major petroleum companies publish ESG reports:", options: ["Never", "Every 5 years", "Annually", "Only when required"], correctIndex: 2 },
      ],
    },
    { title: "Local Content as ESG Performance", content: "## Measuring Social Impact Through Local Content\n\n### Key Metrics That Map to ESG\n\n**Local Procurement (Social - Community Benefit)**\n- Total spend with Guyanese suppliers\n- Local Content Rate (%)\n- Number of Guyanese suppliers engaged\n- Supplier development programs\n\n**Local Employment (Social - Workforce)**\n- Guyanese employment by category\n- Compliance with employment minimums (75/60/80)\n- Remuneration data (equal pay compliance)\n- Workforce development and training\n\n**Capacity Development (Social - Education & Training)**\n- Training hours delivered\n- Guyanese participants trained\n- Scholarships and educational support\n- Technology transfer programs\n\n## How LCA Desk Data Feeds ESG Reporting\nEvery report filed through LCA Desk generates structured data that maps directly to ESG frameworks:\n- GRI (Global Reporting Initiative) Standard 204: Procurement Practices\n- GRI Standard 401: Employment\n- GRI Standard 404: Training and Education\n- SASB Oil & Gas standards\n\n## For Compliance Officers\nYour half-yearly filing isn't just a regulatory requirement — it's producing the data your company's ESG team needs. Make it accurate.",
      quiz: [
        { question: "LC Rate maps to which ESG metric?", options: ["Environmental impact", "Local procurement / community benefit", "Carbon emissions", "Board diversity"], correctIndex: 1 },
        { question: "GRI Standard 204 covers:", options: ["Climate change", "Procurement Practices", "Water usage", "Executive pay"], correctIndex: 1 },
        { question: "Training data feeds into ESG through:", options: ["Environmental pillar", "Governance pillar", "Social pillar (education & training)", "Financial reporting"], correctIndex: 2 },
        { question: "LCA Desk filing data is useful for:", options: ["Only the Secretariat", "Both regulatory compliance and ESG reporting", "Only tax purposes", "Only internal use"], correctIndex: 1 },
        { question: "Equal pay compliance falls under:", options: ["Environmental", "Social - Workforce", "Governance", "Not ESG-related"], correctIndex: 1 },
      ],
    },
    { title: "Future of Local Content & ESG", content: "## Emerging Trends\n\n### Mandatory ESG Reporting\nThe EU's Corporate Sustainability Reporting Directive (CSRD) and the SEC's climate disclosure rules are making ESG reporting mandatory. Companies operating in Guyana will need structured local content data.\n\n### Carbon & Local Content Intersection\nUsing local suppliers reduces transportation emissions. A Guyanese catering company serving an onshore facility has a smaller carbon footprint than flying food from Houston. This creates a dual ESG benefit: local content + reduced emissions.\n\n### Supply Chain Due Diligence\nInternational regulations increasingly require companies to audit their entire supply chain for ESG compliance. Your LCS certification and compliance data become proof of responsible sourcing.\n\n### Digital Verification\nPlatforms like LCA Desk provide auditable, timestamped compliance data. This is more valuable to ESG auditors than self-reported spreadsheets.\n\n### Multi-Jurisdiction Expansion\nAs other countries (Nigeria, Suriname, Namibia) develop local content legislation, ESG frameworks will incorporate local content metrics globally. What you learn filing in Guyana applies everywhere.\n\n## Your Competitive Edge\nCompanies and suppliers who understand the ESG-local content connection will win more contracts. International operators want partners who can help them report strong ESG numbers — and that's exactly what LCS-certified Guyanese companies provide.",
      quiz: [
        { question: "CSRD is:", options: ["A Guyana regulation", "EU Corporate Sustainability Reporting Directive", "A US tax code", "A safety standard"], correctIndex: 1 },
        { question: "Using local suppliers reduces:", options: ["Only costs", "Transportation emissions (dual ESG benefit)", "Quality", "Employment"], correctIndex: 1 },
        { question: "LCA Desk data is valuable to ESG auditors because:", options: ["It's free", "It's auditable and timestamped", "It looks nice", "It's optional"], correctIndex: 1 },
        { question: "Local content legislation is expanding to:", options: ["Only Guyana", "Nigeria, Suriname, Namibia, and others", "Only the US", "No other countries"], correctIndex: 1 },
        { question: "LCS-certified companies help operators:", options: ["Avoid taxes", "Report strong ESG numbers", "Reduce headcount", "Delay filings"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
  return course.id;
}

export async function seedAffiliateSalesCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "affiliate-sales")).limit(1);
  if (existing) return existing.id;
  const [course] = await db.insert(courses).values({
    slug: "affiliate-sales", title: "How to Sell LCA Desk", audience: "all",
    description: "Learn the compliance pain points, buyer personas, and objection handling techniques to effectively refer businesses to LCA Desk.",
    moduleCount: 4, badgeLabel: "Sales Certified", badgeColor: "gold", estimatedMinutes: 25,
  }).returning();
  await db.insert(courseModules).values([
    { courseId: course.id, orderIndex: 0, title: "Understanding the Market", content: "## The Compliance Pain\n\nEvery contractor and sub-contractor in the petroleum sector must file Half-Yearly Reports. This is mandatory under the Local Content Act 2021.\n\n### Pain Points to Highlight\n- Reports take 20-40 hours per filing period manually\n- Excel templates are confusing and error-prone\n- Missing deadlines = fines up to GY$50M\n- Employment minimums are hard to track\n- Secretariat submissions require multiple documents\n\n### Who Needs LCA Desk\n- **Contractors**: ExxonMobil partners, CNOOC, Hess, SBM Offshore\n- **Sub-contractors**: Engineering firms, catering, logistics, marine services\n- **Consultants**: Firms that file on behalf of multiple companies\n- **New entrants**: Companies just starting petroleum sector operations\n\n### Your Value Proposition\n\"LCA Desk reduces compliance reporting from 20+ hours to under 2 hours, with AI-powered narrative drafting and direct Secretariat submission.\"" },
    { courseId: course.id, orderIndex: 1, title: "Buyer Personas", content: "## Who You're Talking To\n\n### The Compliance Officer\n- Spends days on reports\n- Frustrated with Excel templates\n- Worried about missing deadlines\n- **Pitch**: Time savings, automation, deadline reminders\n\n### The CEO/GM\n- Cares about penalties and reputation\n- Wants compliance without headcount\n- **Pitch**: Risk reduction, cost savings, audit readiness\n\n### The Consultant\n- Manages multiple companies' reports\n- Needs to scale without hiring\n- **Pitch**: Multi-entity management, bulk pricing, professional tools\n\n### The New Market Entrant\n- Doesn't understand the Act requirements\n- Needs guidance, not just tools\n- **Pitch**: Built-in training, AI expert, template guidance" },
    { courseId: course.id, orderIndex: 2, title: "Objection Handling", content: "## Common Objections & Responses\n\n### \"We already use Excel\"\n\"Excel works, but LCA Desk automates the calculations, generates the narrative report with AI, and tracks your deadlines. Most companies save 20+ hours per period.\"\n\n### \"It's too expensive\"\n\"At $199/month, it's less than the hourly cost of one compliance officer spending 2 days on a report. Plus, the penalty for a late filing is GY$1M minimum.\"\n\n### \"We'll build our own\"\n\"LCA Desk has been purpose-built for the Local Content Act with 4 jurisdictions, AI narrative drafting, and direct Secretariat submission. Building this in-house would take 6-12 months and cost 10x more.\"\n\n### \"We don't need it yet\"\n\"The next Half-Yearly deadline is coming. Companies that start now have time to enter data properly. Last-minute filings are where errors happen.\"" },
    { courseId: course.id, orderIndex: 3, title: "Closing Techniques", content: "## Getting the Sign-Up\n\n### The Trial Close\n\"Why not start the 30-day free trial? You can enter your real data and see if it saves you time. No credit card required to start.\"\n\n### The Deadline Close\nCheck the compliance calendar and say: \"Your next H1 report is due [date]. If you start now, you'll have time to set up properly.\"\n\n### The Referral Link\nAlways share your personal referral link. When they sign up through it:\n- They get attributed to you\n- When they subscribe, you earn your commission\n- The more companies you refer, the more you earn\n\n### Follow Up\n- Send the referral link in a follow-up email\n- Check back after 7 days if they haven't signed up\n- Offer to help them set up their first entity" },
  ]);
  return course.id;
}

export async function seedAffiliateMarketingCourse() {
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "affiliate-marketing")).limit(1);
  if (existing) return existing.id;
  const [course] = await db.insert(courses).values({
    slug: "affiliate-marketing", title: "Affiliate Marketing Playbook", audience: "all",
    description: "Strategies for promoting LCA Desk through social media, email outreach, events, and industry networking.",
    moduleCount: 3, badgeLabel: "Marketing Pro", badgeColor: "gold", estimatedMinutes: 20,
  }).returning();
  await db.insert(courseModules).values([
    { courseId: course.id, orderIndex: 0, title: "Social Media Strategy", content: "## Building Your Online Presence\n\n### LinkedIn (Primary Channel)\nLinkedIn is where your buyers are. Post about:\n- Compliance deadlines approaching\n- Local content statistics and trends\n- Pain points of manual reporting\n- Success stories from LCA Desk users\n\n### Posting Cadence\n- 2-3 posts per week\n- Mix: 1 educational, 1 promotional, 1 engagement\n- Use the pre-written posts from Marketing Assets\n- Always include your referral link\n\n### Hashtags\n#LocalContent #Guyana #PetroleumSector #Compliance #LCADesk #OilAndGas" },
    { courseId: course.id, orderIndex: 1, title: "Email Outreach", content: "## Direct Outreach That Works\n\n### Finding Prospects\n- LinkedIn search: \"compliance officer\" + \"Guyana\"\n- Company directories from the LCS Register\n- Industry events attendee lists\n- Chamber of Commerce membership lists\n\n### Email Structure\n1. Personal hook (mention their company/role)\n2. Pain point (compliance reporting takes too long)\n3. Solution (LCA Desk automates it)\n4. Social proof (companies already using it)\n5. CTA (your referral link for a free trial)\n\n### Use the templates in Marketing Assets — they're proven to convert." },
    { courseId: course.id, orderIndex: 2, title: "Events & Networking", content: "## In-Person Promotion\n\n### Industry Events\n- Guyana Energy Conference\n- LCS stakeholder meetings\n- Chamber of Commerce events\n- Oil & Gas networking mixers\n\n### Your Elevator Pitch\n\"I help petroleum companies cut their compliance reporting time by 90%. LCA Desk automates Half-Yearly Reports — expenditure, employment, capacity development — and even drafts the narrative with AI. Most companies save 20+ hours per filing period.\"\n\n### Business Cards\nInclude your referral link on your business card or a QR code that links to your signup page.\n\n### Follow-Up\nAfter every conversation, send your referral link within 24 hours with a personalized note." },
  ]);
  return course.id;
}

// ─── JURISDICTION HELPERS ────────────────────────────────────────

export async function getEntityJurisdictionCode(entityId: string): Promise<string> {
  const [entity] = await db.select({ jurisdictionId: entities.jurisdictionId })
    .from(entities).where(eq(entities.id, entityId)).limit(1);
  if (!entity?.jurisdictionId) return "GY"; // fallback
  const [jurisdiction] = await db.select({ code: jurisdictions.code })
    .from(jurisdictions).where(eq(jurisdictions.id, entity.jurisdictionId)).limit(1);
  return jurisdiction?.code || "GY";
}

export async function getTenantJurisdictionCode(tenantId: string): Promise<string> {
  const [tenant] = await db.select({ jurisdictionId: tenants.jurisdictionId })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant?.jurisdictionId) return "GY";
  const [jurisdiction] = await db.select({ code: jurisdictions.code })
    .from(jurisdictions).where(eq(jurisdictions.id, tenant.jurisdictionId)).limit(1);
  return jurisdiction?.code || "GY";
}

export async function fetchJurisdictions() {
  return db.select({ id: jurisdictions.id, code: jurisdictions.code, name: jurisdictions.name })
    .from(jurisdictions).where(eq(jurisdictions.active, true)).orderBy(jurisdictions.name);
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────

export async function fetchAdminStats() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.isSuperAdmin) throw new Error("Not authorized");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Users
  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, userRole: users.userRole, createdAt: users.createdAt, isDemo: users.isDemo }).from(users).orderBy(desc(users.createdAt)).limit(500);
  const recentSignups = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > sevenDaysAgo);
  const filers = allUsers.filter(u => u.userRole?.includes("filer"));
  const seekers = allUsers.filter(u => u.userRole?.includes("job_seeker"));
  const suppliers = allUsers.filter(u => u.userRole?.includes("supplier"));

  // Tenants
  const allTenants = await db.select({
    id: tenants.id, name: tenants.name, slug: tenants.slug, plan: tenants.plan, trialEndsAt: tenants.trialEndsAt, isDemo: tenants.isDemo,
    stripeSubscriptionId: tenants.stripeSubscriptionId, createdAt: tenants.createdAt,
    jurisdictionCode: jurisdictions.code, jurisdictionName: jurisdictions.name,
  }).from(tenants)
    .leftJoin(jurisdictions, eq(tenants.jurisdictionId, jurisdictions.id))
    .orderBy(desc(tenants.createdAt)).limit(200);
  const paying = allTenants.filter(t => t.stripeSubscriptionId);
  const trialing = allTenants.filter(t => t.trialEndsAt && new Date(t.trialEndsAt) > now && !t.stripeSubscriptionId);
  const expired = allTenants.filter(t => t.trialEndsAt && new Date(t.trialEndsAt) <= now && !t.stripeSubscriptionId);

  // Entities
  const entityCount = (await db.select({ id: entities.id }).from(entities).limit(1000)).length;

  // Reporting periods
  const allPeriods = await db.select({ id: reportingPeriods.id, status: reportingPeriods.status, createdAt: reportingPeriods.createdAt })
    .from(reportingPeriods).limit(1000);
  const submitted = allPeriods.filter(p => p.status === "submitted" || p.status === "acknowledged");

  // Job postings & applications
  const jobCount = (await db.select({ id: jobPostings.id }).from(jobPostings).limit(500)).length;
  const appCount = (await db.select({ id: jobApplications.id }).from(jobApplications).limit(1000)).length;

  // LCS data
  const registerCount = (await db.select({ id: lcsRegister.id }).from(lcsRegister).limit(2000)).length;
  const oppCount = (await db.select({ id: lcsOpportunities.id }).from(lcsOpportunities).limit(500)).length;
  const lcsJobCount = (await db.select({ id: lcsEmploymentNotices.id }).from(lcsEmploymentNotices).limit(200)).length;
  const profileCount = (await db.select({ id: companyProfiles.id }).from(companyProfiles).limit(2000)).length;

  // Support tickets
  const openTickets = (await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.status, "open")).limit(100)).length;

  // Referrals
  let referralStats = { total: 0, signedUp: 0, qualified: 0, rewarded: 0 };
  try {
    const allReferrals = await db.select({ status: referrals.status }).from(referrals).limit(500);
    referralStats = {
      total: allReferrals.length,
      signedUp: allReferrals.filter(r => r.status !== "pending").length,
      qualified: allReferrals.filter(r => r.status === "qualified" || r.status === "rewarded").length,
      rewarded: allReferrals.filter(r => r.status === "rewarded").length,
    };
  } catch {} // table may not exist yet

  // Recent audit log
  const recentAudit = await db.select({
    id: auditLogs.id, userName: auditLogs.userName, action: auditLogs.action,
    entityType: auditLogs.entityType, createdAt: auditLogs.createdAt,
  }).from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20);

  // Signup trend (last 30 days)
  const signupsByDay: Record<string, number> = {};
  for (const u of allUsers) {
    if (u.createdAt && new Date(u.createdAt) > thirtyDaysAgo) {
      const day = new Date(u.createdAt).toISOString().slice(0, 10);
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    }
  }

  return {
    users: {
      total: allUsers.length,
      recent7d: recentSignups.length,
      filers: filers.length,
      seekers: seekers.length,
      suppliers: suppliers.length,
      latest: allUsers.slice(0, 10),
    },
    tenants: {
      total: allTenants.length,
      paying: paying.length,
      trialing: trialing.length,
      expired: expired.length,
      list: allTenants.slice(0, 15),
    },
    content: {
      entities: entityCount,
      periods: allPeriods.length,
      submitted: submitted.length,
      jobs: jobCount,
      applications: appCount,
    },
    scraped: {
      register: registerCount,
      opportunities: oppCount,
      lcsJobs: lcsJobCount,
      companyProfiles: profileCount,
    },
    support: { openTickets },
    referralStats,
    signupsByDay,
    recentAudit,
  };
}

export async function fetchAllTickets() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.isSuperAdmin) throw new Error("Not authorized");

  return db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      description: supportTickets.description,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(50);
}

export async function adminReplyToTicket(ticketId: string, message: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.isSuperAdmin) throw new Error("Not authorized");

  const [reply] = await db.insert(ticketReplies).values({
    ticketId, userId: session.user.id, message, isAdmin: true,
  }).returning();

  // Update ticket status to in_progress
  await db.update(supportTickets).set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));

  return reply;
}

export async function adminUpdateTicketStatus(ticketId: string, status: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.isSuperAdmin) throw new Error("Not authorized");

  await db.update(supportTickets).set({
    status,
    resolvedAt: status === "resolved" ? new Date() : undefined,
    resolvedBy: status === "resolved" ? session.user.id : undefined,
    updatedAt: new Date(),
  }).where(eq(supportTickets.id, ticketId));
}

// ─── SECRETARIAT PORTAL ──────────────────────────────────────────

async function getSecretariatContext() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const membership = await db.select({
    id: secretariatMembers.id,
    officeId: secretariatMembers.officeId,
    role: secretariatMembers.role,
  }).from(secretariatMembers).where(eq(secretariatMembers.userId, session.user.id)).limit(1);
  if (!membership[0]) throw new Error("Not a secretariat member");
  return { userId: session.user.id, officeId: membership[0].officeId, role: membership[0].role };
}

/** Returns demo filter info — demo users see demo data, real users see real data */
async function getDemoFilter() {
  try {
    const session = await auth();
    let callerIsDemo = false;
    if (session?.user?.id) {
      const [u] = await db.select({ isDemo: users.isDemo }).from(users).where(eq(users.id, session.user.id)).limit(1);
      callerIsDemo = !!u?.isDemo;
    }
    const demoTenantRows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.isDemo, true));
    const demoUserRows = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true));
    const tenantIds = new Set(demoTenantRows.map(t => t.id));
    const userIds = new Set(demoUserRows.map(u => u.id));
    return {
      tenantIds,
      userIds,
      callerIsDemo,
      includeTenant: (id: string) => callerIsDemo ? tenantIds.has(id) : !tenantIds.has(id),
      includeUser: (id: string) => callerIsDemo ? userIds.has(id) : !userIds.has(id),
    };
  } catch {
    // Fallback if isDemo column doesn't exist yet (migration pending)
    return {
      tenantIds: new Set<string>(),
      userIds: new Set<string>(),
      callerIsDemo: false,
      includeTenant: () => true,
      includeUser: () => true,
    };
  }
}

export async function fetchSecretariatOfficeSettings() {
  const { officeId } = await getSecretariatContext();
  const office = await db.select().from(secretariatOffices).where(eq(secretariatOffices.id, officeId)).limit(1);
  if (!office[0]) throw new Error("Office not found");
  return office[0];
}

export async function updateSecretariatOfficeSettings(data: {
  name?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  website?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  submissionEmail?: string;
}) {
  const { officeId, role } = await getSecretariatContext();
  if (role !== "admin") throw new Error("Only admins can update office settings");
  await db.update(secretariatOffices).set(data).where(eq(secretariatOffices.id, officeId));
  return { success: true };
}

export async function fetchSecretariatDashboard() {
  const { officeId } = await getSecretariatContext();
  const demo = await getDemoFilter();

  // Get all submissions (exclude demo tenants)
  const allSubmissions = await db.select({
    periodId: reportingPeriods.id,
    entityId: reportingPeriods.entityId,
    reportType: reportingPeriods.reportType,
    periodStart: reportingPeriods.periodStart,
    periodEnd: reportingPeriods.periodEnd,
    fiscalYear: reportingPeriods.fiscalYear,
    status: reportingPeriods.status,
    submittedAt: reportingPeriods.submittedAt,
    entityName: entities.legalName,
    companyType: entities.companyType,
    tenantName: tenants.name,
    tenantId: reportingPeriods.tenantId,
  })
    .from(reportingPeriods)
    .innerJoin(entities, eq(reportingPeriods.entityId, entities.id))
    .innerJoin(tenants, eq(reportingPeriods.tenantId, tenants.id))
    .where(eq(reportingPeriods.status, "submitted"))
    .orderBy(desc(reportingPeriods.submittedAt))
    .limit(100);

  // Filter out demo tenants
  const submissions = allSubmissions.filter(s => demo.includeTenant(s.tenantId));

  // Get submission methods from logs
  const subLogs = await db.select({
    periodId: submissionLogs.reportingPeriodId,
    method: submissionLogs.submissionMethod,
  }).from(submissionLogs).limit(200);

  // Get acknowledgment status for each
  const acks = await db.select()
    .from(submissionAcknowledgments)
    .where(eq(submissionAcknowledgments.officeId, officeId))
    .limit(200);

  const enriched = submissions.map(s => {
    const ack = acks.find(a => a.reportingPeriodId === s.periodId);
    const log = subLogs.find(l => l.periodId === s.periodId);
    return {
      ...s,
      submissionMethod: log?.method || "email",
      acknowledgment: ack ? {
        status: ack.status,
        referenceNumber: ack.referenceNumber,
        notes: ack.notes,
        acknowledgedAt: ack.acknowledgedAt,
      } : null,
    };
  });

  // Stats
  const total = submissions.length;
  const acknowledged = acks.filter(a => a.status !== "received").length;
  const pending = total - acknowledged;

  // Get office members
  const members = await db.select({
    id: secretariatMembers.id,
    role: secretariatMembers.role,
    userName: users.name,
    userEmail: users.email,
  }).from(secretariatMembers)
    .innerJoin(users, eq(secretariatMembers.userId, users.id))
    .where(eq(secretariatMembers.officeId, officeId));

  return { submissions: enriched, stats: { total, acknowledged, pending }, members, officeId };
}

export async function acknowledgeSubmission(periodId: string, data: {
  status: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const { officeId, userId } = await getSecretariatContext();

  const [existing] = await db.select({ id: submissionAcknowledgments.id })
    .from(submissionAcknowledgments)
    .where(and(eq(submissionAcknowledgments.reportingPeriodId, periodId), eq(submissionAcknowledgments.officeId, officeId)))
    .limit(1);

  if (existing) {
    await db.update(submissionAcknowledgments).set({
      status: data.status,
      referenceNumber: data.referenceNumber || undefined,
      notes: data.notes || undefined,
      acknowledgedBy: userId,
      updatedAt: new Date(),
    }).where(eq(submissionAcknowledgments.id, existing.id));
  } else {
    await db.insert(submissionAcknowledgments).values({
      reportingPeriodId: periodId,
      officeId,
      acknowledgedBy: userId,
      status: data.status,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes || null,
    });
  }

  // Update reporting period status if approved
  if (data.status === "approved") {
    await db.update(reportingPeriods).set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
      secretariatRef: data.referenceNumber || null,
      updatedAt: new Date(),
    }).where(eq(reportingPeriods.id, periodId));
  }
}

export async function addSecretariatMember(officeId: string, email: string, role: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const ctx = await getSecretariatContext();
  if (ctx.role !== "admin") throw new Error("Only secretariat admins can add members");
  if (officeId !== ctx.officeId) throw new Error("Cannot modify another office");

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (user) {
    // Check for existing membership
    const existingMember = await db.select({ id: secretariatMembers.id }).from(secretariatMembers)
      .where(and(eq(secretariatMembers.officeId, officeId), eq(secretariatMembers.userId, user.id)))
      .limit(1);
    if (existingMember.length > 0) throw new Error("This user is already a member.");

    // User exists — add directly
    const [userData] = await db.select({ userRole: users.userRole }).from(users).where(eq(users.id, user.id)).limit(1);
    const currentRole = userData?.userRole || "";
    if (!currentRole.includes("secretariat")) {
      const newRole = currentRole ? `${currentRole},secretariat` : "secretariat";
      await db.update(users).set({ userRole: newRole }).where(eq(users.id, user.id));
    }

    await db.insert(secretariatMembers).values({ officeId, userId: user.id, role });

    // Notify the new member
    unifiedNotifyTeamInvite({
      userId: user.id,
      tenantId: officeId,
      inviterName: session.user.name || "A secretariat admin",
      companyName: "Local Content Secretariat",
    }).catch(() => {});

    return { added: true };
  }

  // User doesn't exist — check for existing pending invite
  const existingInvite = await db.select({ id: teamInvites.id }).from(teamInvites)
    .where(and(eq(teamInvites.email, email), eq(teamInvites.secretariatOfficeId, officeId), eq(teamInvites.status, "pending")))
    .limit(1);
  if (existingInvite.length > 0) throw new Error("An invitation has already been sent to this email.");

  const { randomUUID } = await import("crypto");
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await db.insert(teamInvites).values({
    email,
    token,
    secretariatOfficeId: officeId,
    role,
    invitedBy: session.user.id,
    inviterName: session.user.name || "A secretariat admin",
    expiresAt,
  });

  // Send invite email
  try {
    const { sendEmail } = await import("@/lib/email/client");
    const baseUrl = process.env.NEXTAUTH_URL || "https://app.lcadesk.com";
    const signupUrl = `${baseUrl}/auth/signup?invite=${token}&email=${encodeURIComponent(email)}&role=secretariat`;
    await sendEmail({
      to: email,
      subject: "You're invited to the Local Content Secretariat on LCA Desk",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0F172A">${session.user.name || "An admin"} invited you to the Secretariat Portal</h2>
        <p style="color:#475569">You've been invited to join the <strong>Local Content Secretariat</strong> team on LCA Desk — the regulatory compliance platform.</p>
        <p style="color:#475569">Click below to create your account and get started:</p>
        <a href="${signupUrl}" style="display:inline-block;padding:12px 24px;background:#047857;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0">Accept Invitation</a>
        <p style="color:#94A3B8;font-size:13px">This invitation expires in 14 days.</p>
      </div>`,
    });
  } catch {}

  return { invited: true, email };
}

export async function fetchSubmissionDetail(periodId: string) {
  await getSecretariatContext();
  const demo = await getDemoFilter();

  const [period] = await db.select().from(reportingPeriods)
    .where(eq(reportingPeriods.id, periodId)).limit(1);
  if (!period) throw new Error("Submission not found");

  // Demo boundary: prevent cross-demo/real data access
  if (!demo.includeTenant(period.tenantId)) throw new Error("Submission not found");

  const [entity] = await db.select().from(entities)
    .where(eq(entities.id, period.entityId)).limit(1);
  const [tenant] = await db.select().from(tenants)
    .where(eq(tenants.id, period.tenantId)).limit(1);

  // Get actual records (live data)
  const expenditures = await db.select().from(expenditureRecords)
    .where(eq(expenditureRecords.reportingPeriodId, periodId));
  const employment = await db.select().from(employmentRecords)
    .where(eq(employmentRecords.reportingPeriodId, periodId));
  const capacity = await db.select().from(capacityDevelopmentRecords)
    .where(eq(capacityDevelopmentRecords.reportingPeriodId, periodId));

  // Calculate metrics
  const totalSpend = expenditures.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const guySpend = expenditures.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const lcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 1000) / 10 : 0;

  const totalEmp = employment.reduce((s, e) => s + (e.totalEmployees || 0), 0);
  const guyEmp = employment.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
  const empPct = totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 1000) / 10 : 0;

  const byCategory = (cat: string) => {
    const filtered = employment.filter(e => e.employmentCategory === cat);
    const total = filtered.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const gy = filtered.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);
    return { total, guyanese: gy, pct: total > 0 ? Math.round((gy / total) * 1000) / 10 : 0 };
  };

  // Supplier breakdown
  const guySuppliers = new Set(expenditures.filter(e => !!e.supplierCertificateId).map(e => e.supplierName)).size;
  const intlSuppliers = new Set(expenditures.filter(e => !e.supplierCertificateId).map(e => e.supplierName)).size;

  // Previous submissions for this entity
  const history = await db.select({
    id: reportingPeriods.id,
    reportType: reportingPeriods.reportType,
    fiscalYear: reportingPeriods.fiscalYear,
    status: reportingPeriods.status,
    submittedAt: reportingPeriods.submittedAt,
  }).from(reportingPeriods)
    .where(and(eq(reportingPeriods.entityId, period.entityId), eq(reportingPeriods.status, "submitted")))
    .orderBy(desc(reportingPeriods.submittedAt))
    .limit(10);

  // Attestation info
  let attester = null;
  if (period.attestedBy) {
    const [u] = await db.select({ name: users.name, email: users.email })
      .from(users).where(eq(users.id, period.attestedBy)).limit(1);
    attester = u;
  }

  // Snapshot data (frozen at submission time)
  let snapshot = null;
  if (period.snapshotData) {
    try { snapshot = JSON.parse(period.snapshotData as string); } catch {}
  }

  // Submission method and file info
  const [subLog] = await db.select({
    method: submissionLogs.submissionMethod,
    fileName: submissionLogs.uploadedFileName,
    fileKey: submissionLogs.uploadedFileKey,
  })
    .from(submissionLogs)
    .where(eq(submissionLogs.reportingPeriodId, periodId))
    .orderBy(desc(submissionLogs.createdAt))
    .limit(1);

  return {
    period: {
      id: period.id,
      reportType: period.reportType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      fiscalYear: period.fiscalYear,
      status: period.status,
      submittedAt: period.submittedAt,
      attestation: period.attestation,
      attestedAt: period.attestedAt,
    },
    submissionMethod: subLog?.method || "email",
    uploadedFile: subLog?.fileKey ? { key: subLog.fileKey, name: subLog.fileName } : null,
    entity: { name: entity?.legalName, type: entity?.companyType, id: entity?.id },
    tenant: { name: tenant?.name },
    attester,
    metrics: {
      lcRate,
      totalExpenditure: totalSpend,
      guyaneseExpenditure: guySpend,
      totalEmployees: totalEmp,
      guyaneseEmployees: guyEmp,
      employmentPct: empPct,
      managerial: byCategory("Managerial"),
      technical: byCategory("Technical"),
      nonTechnical: byCategory("Non-Technical"),
      guyaneseSuppliers: guySuppliers,
      internationalSuppliers: intlSuppliers,
      expenditureRecords: expenditures.length,
      employmentRecords: employment.length,
      capacityRecords: capacity.length,
    },
    records: {
      expenditures: expenditures.map(e => ({
        supplier: e.supplierName, amount: Number(e.actualPayment || 0),
        sector: e.relatedSector, certId: e.supplierCertificateId,
      })),
      employment: employment.map(e => ({
        title: e.jobTitle, category: e.employmentCategory,
        total: e.totalEmployees, guyanese: e.guyanaeseEmployed,
      })),
    },
    history,
    snapshotRecordCounts: snapshot?.recordCounts || null,
  };
}

export async function fetchSecretariatAnalytics() {
  await getSecretariatContext();
  const demo = await getDemoFilter();

  // All submitted periods with data (exclude demo tenants)
  const allSubmitted = await db.select({
    id: reportingPeriods.id,
    entityId: reportingPeriods.entityId,
    tenantId: reportingPeriods.tenantId,
  }).from(reportingPeriods)
    .where(eq(reportingPeriods.status, "submitted"))
    .limit(500);

  // Filter out demo tenant data
  const realSubmitted = allSubmitted.filter(s => demo.includeTenant(s.tenantId));

  // Only use real (non-demo) period IDs for record lookups
  const realPeriodIds = new Set(realSubmitted.map(s => s.id));

  const allExp = await db.select().from(expenditureRecords).limit(5000);
  const allEmp = await db.select().from(employmentRecords).limit(5000);
  const allCap = await db.select().from(capacityDevelopmentRecords).limit(5000);

  // Filter records to only real (non-demo) periods
  const realExp = allExp.filter(e => realPeriodIds.has(e.reportingPeriodId));
  const realEmp = allEmp.filter(e => realPeriodIds.has(e.reportingPeriodId));
  const realCap = allCap.filter(c => realPeriodIds.has(c.reportingPeriodId));

  // Aggregate LC rate across all filers
  const totalSpend = realExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const guySpend = realExp.filter(e => !!e.supplierCertificateId || e.supplierType === "Guyanese").reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const overallLcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 1000) / 10 : 0;

  // Aggregate employment
  const totalEmp = realEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
  const guyEmp = realEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);

  // Capacity development
  const totalTrainingParticipants = realCap.reduce((s, c) => s + (c.totalParticipants || 0), 0);
  const totalTrainingDays = realCap.reduce((s, c) => s + (c.durationDays || 0), 0);
  const totalCapacitySpend = realCap.reduce((s, c) => s + Number(c.expenditureOnCapacity || 0), 0);

  // Unique filers
  const uniqueTenants = new Set(realSubmitted.map(p => p.tenantId)).size;
  const uniqueEntities = new Set(realSubmitted.map(p => p.entityId)).size;

  // Staff hours saved estimate:
  // Manual review of a half-yearly report: ~4 hours (data entry check, cross-reference, calculations)
  // LCA Desk automated review: ~15 minutes
  // Net saving: ~3.75 hours per submission
  const hoursPerSubmission = 3.75;
  const staffHoursSaved = Math.round(realSubmitted.length * hoursPerSubmission);

  // Guyanese supplier count (unique companies)
  const guyaneseSupplierNames = new Set(realExp.filter(e => !!e.supplierCertificateId || e.supplierType === "Guyanese").map(e => e.supplierName));

  return {
    totalSubmissions: realSubmitted.length,
    uniqueFilers: uniqueTenants,
    uniqueEntities: uniqueEntities,
    overallLcRate,
    totalExpenditure: totalSpend,
    guyaneseExpenditure: guySpend,
    totalEmployees: totalEmp,
    guyaneseEmployees: guyEmp,
    employmentPct: totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 1000) / 10 : 0,
    // KPIs
    localSpend: guySpend,
    jobsCreated: guyEmp,
    staffHoursSaved,
    economicImpact: totalSpend,
    // Supporting metrics
    guyaneseSupplierCount: guyaneseSupplierNames.size,
    totalTrainingParticipants,
    totalTrainingDays,
    totalCapacitySpend,
  };
}

// ─── SECRETARIAT: MISSING FILERS ─────────────────────────────────

export async function fetchFilingCompliance(fiscalYear: number, reportType: string) {
  await getSecretariatContext();
  const demo = await getDemoFilter();
  const { calculateDeadlines: calcDeadlines } = await import("@/lib/compliance/deadlines");

  // Get ALL entities that should file (exclude demo tenants)
  const allEntitiesRaw = await db.select({
    id: entities.id,
    legalName: entities.legalName,
    companyType: entities.companyType,
    tenantName: tenants.name,
    tenantId: entities.tenantId,
  }).from(entities)
    .innerJoin(tenants, eq(entities.tenantId, tenants.id))
    .where(eq(entities.active, true))
    .limit(500);

  const allEntities = allEntitiesRaw.filter(e => demo.includeTenant(e.tenantId));

  // Get all periods for this report type + year
  const periods = await db.select({
    id: reportingPeriods.id,
    entityId: reportingPeriods.entityId,
    status: reportingPeriods.status,
    submittedAt: reportingPeriods.submittedAt,
    dueDate: reportingPeriods.dueDate,
  }).from(reportingPeriods)
    .where(and(eq(reportingPeriods.reportType, reportType), eq(reportingPeriods.fiscalYear, fiscalYear)))
    .limit(500);

  const now = new Date();
  const filingStatus = allEntities.map(entity => {
    const period = periods.find(p => p.entityId === entity.id);
    let status: "submitted" | "in_progress" | "not_started" | "overdue" = "not_started";
    if (period) {
      if (period.status === "submitted" || period.status === "acknowledged") status = "submitted";
      else if (period.dueDate && new Date(period.dueDate) < now) status = "overdue";
      else status = "in_progress";
    } else {
      // No period created — check if deadline has passed
      const deadlines = calcDeadlines("GY", fiscalYear);
      const deadline = deadlines.find((d: { type: string }) => d.type === reportType);
      if (deadline && deadline.due_date < now) status = "overdue";
    }

    return {
      entityId: entity.id,
      entityName: entity.legalName,
      companyType: entity.companyType,
      tenantName: entity.tenantName,
      status,
      periodId: period?.id || null,
      submittedAt: period?.submittedAt || null,
    };
  });

  const submitted = filingStatus.filter(f => f.status === "submitted").length;
  const overdue = filingStatus.filter(f => f.status === "overdue").length;
  const inProgress = filingStatus.filter(f => f.status === "in_progress").length;
  const notStarted = filingStatus.filter(f => f.status === "not_started").length;

  return {
    filingStatus: filingStatus.sort((a, b) => {
      const order = { overdue: 0, not_started: 1, in_progress: 2, submitted: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    }),
    stats: { total: filingStatus.length, submitted, overdue, inProgress, notStarted },
  };
}

export async function fetchEntityFilingProfile(entityId: string) {
  await getSecretariatContext();
  const demo = await getDemoFilter();

  const [entity] = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  if (!entity) throw new Error("Entity not found");
  if (!demo.includeTenant(entity.tenantId)) throw new Error("Entity not found");

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, entity.tenantId)).limit(1);

  // Get all reporting periods for this entity
  const allPeriods = await db.select({
    id: reportingPeriods.id,
    reportType: reportingPeriods.reportType,
    fiscalYear: reportingPeriods.fiscalYear,
    status: reportingPeriods.status,
    submittedAt: reportingPeriods.submittedAt,
    periodStart: reportingPeriods.periodStart,
    periodEnd: reportingPeriods.periodEnd,
    dueDate: reportingPeriods.dueDate,
  }).from(reportingPeriods)
    .where(eq(reportingPeriods.entityId, entityId))
    .orderBy(desc(reportingPeriods.fiscalYear), desc(reportingPeriods.periodEnd))
    .limit(20);

  // Quick LC rate from most recent submitted period
  let latestLcRate: number | null = null;
  const submitted = allPeriods.find(p => p.status === "submitted" || p.status === "acknowledged");
  if (submitted) {
    const exps = await db.select().from(expenditureRecords).where(eq(expenditureRecords.reportingPeriodId, submitted.id));
    const total = exps.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guy = exps.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    latestLcRate = total > 0 ? Math.round((guy / total) * 1000) / 10 : 0;
  }

  return {
    entity: {
      id: entity.id,
      legalName: entity.legalName,
      tradingName: entity.tradingName,
      companyType: entity.companyType,
      lcsCertificateId: entity.lcsCertificateId,
      lcsCertificateExpiry: entity.lcsCertificateExpiry,
      guyanaeseOwnershipPct: entity.guyanaeseOwnershipPct,
      registrationNumber: entity.registrationNumber,
      contactName: entity.contactName,
      contactEmail: entity.contactEmail,
      contactPhone: entity.contactPhone,
      website: entity.website,
      numberOfEmployees: entity.numberOfEmployees,
    },
    tenant: { name: tenant?.name || "Unknown" },
    filingHistory: allPeriods.map(p => ({
      id: p.id,
      reportType: p.reportType,
      fiscalYear: p.fiscalYear,
      status: p.status,
      submittedAt: p.submittedAt,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      dueDate: p.dueDate,
    })),
    latestLcRate,
    totalFilings: allPeriods.length,
    submittedFilings: allPeriods.filter(p => p.status === "submitted" || p.status === "acknowledged").length,
  };
}

// ─── SECRETARIAT: PERIOD COMPARISON ──────────────────────────────

export async function fetchPeriodComparison(entityId: string) {
  await getSecretariatContext();
  const demo = await getDemoFilter();

  // Verify entity belongs to the right demo/real boundary
  const [entity] = await db.select({ tenantId: entities.tenantId }).from(entities).where(eq(entities.id, entityId)).limit(1);
  if (entity && !demo.includeTenant(entity.tenantId)) throw new Error("Not found");

  const periods = await db.select().from(reportingPeriods)
    .where(eq(reportingPeriods.entityId, entityId))
    .orderBy(desc(reportingPeriods.periodEnd))
    .limit(6);

  const comparisons = [];
  for (const period of periods) {
    const exps = await db.select().from(expenditureRecords).where(eq(expenditureRecords.reportingPeriodId, period.id));
    const emps = await db.select().from(employmentRecords).where(eq(employmentRecords.reportingPeriodId, period.id));

    const totalSpend = exps.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const guySpend = exps.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
    const totalEmp = emps.reduce((s, e) => s + (e.totalEmployees || 0), 0);
    const guyEmp = emps.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);

    const label = period.reportType === "half_yearly_h1" ? `H1 ${period.fiscalYear}` :
      period.reportType === "half_yearly_h2" ? `H2 ${period.fiscalYear}` : `${period.fiscalYear}`;

    comparisons.push({
      periodId: period.id,
      label,
      status: period.status,
      lcRate: totalSpend > 0 ? Math.round((guySpend / totalSpend) * 1000) / 10 : 0,
      totalExpenditure: totalSpend,
      guyaneseExpenditure: guySpend,
      totalEmployees: totalEmp,
      guyaneseEmployees: guyEmp,
      employmentPct: totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 1000) / 10 : 0,
      expenditureRecords: exps.length,
      employmentRecords: emps.length,
    });
  }

  return comparisons;
}

// ─── SECRETARIAT: AMENDMENT REQUESTS ─────────────────────────────

export async function createAmendmentRequest(data: {
  periodId: string;
  items: Array<{ section: string; description: string; severity: "critical" | "major" | "minor" }>;
  summary: string;
  responseDeadline: string;
}) {
  const { officeId, userId } = await getSecretariatContext();

  const [request] = await db.insert(amendmentRequests).values({
    reportingPeriodId: data.periodId,
    officeId,
    requestedBy: userId,
    items: JSON.stringify(data.items),
    summary: data.summary,
    responseDeadline: data.responseDeadline,
    status: "pending",
  }).returning();

  // Update submission status
  await acknowledgeSubmission(data.periodId, {
    status: "amendment_required",
    notes: `Amendment requested: ${data.summary}`,
  });

  // Notify the filer
  const [period] = await db.select({ tenantId: reportingPeriods.tenantId, entityId: reportingPeriods.entityId })
    .from(reportingPeriods).where(eq(reportingPeriods.id, data.periodId)).limit(1);
  if (period) {
    const members = await db.select({ userId: tenantMembers.userId })
      .from(tenantMembers).where(eq(tenantMembers.tenantId, period.tenantId));
    const { sendEmail } = await import("@/lib/email/client");
    const [entity] = await db.select({ legalName: entities.legalName }).from(entities).where(eq(entities.id, period.entityId)).limit(1);

    for (const member of members) {
      const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, member.userId)).limit(1);
      if (user?.email) {
        sendEmail({
          to: user.email,
          subject: `Amendment Required: ${entity?.legalName || "Your Report"} — Action Needed by ${data.responseDeadline}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;"><div style="background:#047857;padding:24px 32px;border-radius:12px 12px 0 0;"><img src="https://app.lcadesk.com/logo-white-lca.png" alt="LCA Desk" width="120"/></div><div style="background:#fff;padding:32px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;"><h2 style="margin:0 0 8px;color:#0F172A;">Amendment Required</h2><p style="color:#475569;font-size:14px;">The Local Content Secretariat has reviewed your submission for <strong>${entity?.legalName}</strong> and requires the following amendments:</p><div style="background:#FEF2F2;border:1px solid #FCA5A520;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#DC2626;">Required Changes:</p><p style="margin:0;font-size:13px;color:#475569;">${data.summary}</p><ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#475569;">${data.items.map(i => `<li><strong>[${i.severity}]</strong> ${i.section}: ${i.description}</li>`).join("")}</ul></div><p style="color:#475569;font-size:14px;"><strong>Response Deadline: ${data.responseDeadline}</strong></p><a href="https://app.lcadesk.com/dashboard" style="display:inline-block;background:#047857;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open Dashboard</a></div></div>`,
        }).catch(() => {});
      }
    }
  }

  return request;
}

export async function fetchAmendmentRequests(periodId: string) {
  await getSecretariatContext();
  return db.select().from(amendmentRequests)
    .where(eq(amendmentRequests.reportingPeriodId, periodId))
    .orderBy(desc(amendmentRequests.createdAt))
    .limit(10);
}

// ─── SECRETARIAT: MARKET INTELLIGENCE ───────────────────────────

export async function fetchSecretariatMarketIntel() {
  await getSecretariatContext();
  const demo = await getDemoFilter();

  // Opportunities data (public scraped data — not demo-filtered)
  const opportunities = await db.select().from(lcsOpportunities)
    .orderBy(desc(lcsOpportunities.postedDate)).limit(500);

  // Employment notices
  const empNotices = await db.select().from(lcsEmploymentNotices)
    .orderBy(desc(lcsEmploymentNotices.postedDate)).limit(500);

  // Saved opportunities (engagement metric)
  const saves = await db.select({
    opportunityId: savedOpportunities.opportunityId,
  }).from(savedOpportunities).limit(2000);

  // Job seeker stats (exclude demo seekers)
  const allSeekers = await db.select({
    id: jobSeekerProfiles.id,
    userId: jobSeekerProfiles.userId,
    employmentCategory: jobSeekerProfiles.employmentCategory,
    isGuyanese: jobSeekerProfiles.isGuyanese,
    educationLevel: jobSeekerProfiles.educationLevel,
    profileVisible: jobSeekerProfiles.profileVisible,
    yearsExperience: jobSeekerProfiles.yearsExperience,
    locationPreference: jobSeekerProfiles.locationPreference,
  }).from(jobSeekerProfiles).limit(1000);
  const seekers = allSeekers.filter(s => demo.includeUser(s.userId));

  // Job applications
  const applications = await db.select({
    id: jobApplications.id,
    isGuyanese: jobApplications.isGuyanese,
    status: jobApplications.status,
    employmentCategory: jobApplications.employmentCategory,
  }).from(jobApplications).limit(2000);

  // ── Opportunity analytics ──
  const now = new Date();
  const activeOpps = opportunities.filter(o => o.status === "active");
  const expiredOpps = opportunities.filter(o => o.deadline && new Date(o.deadline) < now);

  const oppByType: Record<string, number> = {};
  const oppByCompany: Record<string, number> = {};
  const oppByMonth: Record<string, number> = {};
  const oppByCategory: Record<string, number> = {};

  for (const opp of opportunities) {
    oppByType[opp.noticeType || "Unknown"] = (oppByType[opp.noticeType || "Unknown"] || 0) + 1;
    oppByCompany[opp.contractorName] = (oppByCompany[opp.contractorName] || 0) + 1;
    if (opp.postedDate) {
      const month = opp.postedDate.slice(0, 7); // YYYY-MM
      oppByMonth[month] = (oppByMonth[month] || 0) + 1;
    }
    if (opp.lcaCategory) {
      oppByCategory[opp.lcaCategory] = (oppByCategory[opp.lcaCategory] || 0) + 1;
    }
  }

  // Save counts per opportunity
  const saveCounts: Record<string, number> = {};
  for (const s of saves) {
    if (s.opportunityId) saveCounts[s.opportunityId] = (saveCounts[s.opportunityId] || 0) + 1;
  }
  const mostSaved = Object.entries(saveCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => {
      const opp = opportunities.find(o => o.id === id);
      return { id, title: opp?.title || "", company: opp?.contractorName || "", saves: count };
    });

  // ── Employment notice analytics ──
  const jobsByCompany: Record<string, number> = {};
  const jobsByCategory: Record<string, number> = {};
  const jobsByMonth: Record<string, number> = {};

  for (const job of empNotices) {
    jobsByCompany[job.companyName] = (jobsByCompany[job.companyName] || 0) + 1;
    if (job.employmentCategory) {
      jobsByCategory[job.employmentCategory] = (jobsByCategory[job.employmentCategory] || 0) + 1;
    }
    if (job.postedDate) {
      const month = job.postedDate.slice(0, 7);
      jobsByMonth[month] = (jobsByMonth[month] || 0) + 1;
    }
  }

  // ── Job seeker analytics ──
  const seekersByCategory: Record<string, number> = {};
  const seekersByEducation: Record<string, number> = {};
  for (const s of seekers) {
    if (s.employmentCategory) seekersByCategory[s.employmentCategory] = (seekersByCategory[s.employmentCategory] || 0) + 1;
    if (s.educationLevel) seekersByEducation[s.educationLevel] = (seekersByEducation[s.educationLevel] || 0) + 1;
  }

  const topOppCompanies = Object.entries(oppByCompany).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topJobCompanies = Object.entries(jobsByCompany).sort((a, b) => b[1] - a[1]).slice(0, 15);

  return {
    opportunities: {
      total: opportunities.length,
      active: activeOpps.length,
      expired: expiredOpps.length,
      pinned: opportunities.filter(o => o.pinned).length,
      withAiSummary: opportunities.filter(o => !!o.aiSummary).length,
      byType: oppByType,
      byMonth: Object.entries(oppByMonth).sort((a, b) => a[0].localeCompare(b[0])),
      byCategory: oppByCategory,
      topCompanies: topOppCompanies,
      mostSaved,
      totalSaves: saves.length,
    },
    jobs: {
      total: empNotices.length,
      open: empNotices.filter(j => j.status === "open").length,
      closed: empNotices.filter(j => j.status === "closed").length,
      pinned: empNotices.filter(j => j.pinned).length,
      byCategory: jobsByCategory,
      byMonth: Object.entries(jobsByMonth).sort((a, b) => a[0].localeCompare(b[0])),
      topCompanies: topJobCompanies,
    },
    seekers: {
      total: seekers.length,
      guyanese: seekers.filter(s => s.isGuyanese).length,
      inTalentPool: seekers.filter(s => s.profileVisible).length,
      byCategory: seekersByCategory,
      byEducation: seekersByEducation,
      avgExperience: seekers.length > 0 ? Math.round(seekers.reduce((s, sk) => s + (sk.yearsExperience || 0), 0) / seekers.length) : 0,
    },
    applications: {
      total: applications.length,
      guyanese: applications.filter(a => a.isGuyanese).length,
      byStatus: applications.reduce((acc, a) => { acc[a.status || "unknown"] = (acc[a.status || "unknown"] || 0) + 1; return acc; }, {} as Record<string, number>),
      byCategory: applications.reduce((acc, a) => { if (a.employmentCategory) acc[a.employmentCategory] = (acc[a.employmentCategory] || 0) + 1; return acc; }, {} as Record<string, number>),
    },
    // Raw lists for moderation tab
    recentOpportunities: opportunities.slice(0, 30).map(o => ({
      id: o.id, title: o.title, company: o.contractorName, type: o.noticeType,
      status: o.status, pinned: o.pinned, deadline: o.deadline, postedDate: o.postedDate,
      note: o.secretariatNote, saves: saveCounts[o.id] || 0,
    })),
    recentJobs: empNotices.slice(0, 30).map(j => ({
      id: j.id, title: j.jobTitle, company: j.companyName, category: j.employmentCategory,
      status: j.status, pinned: j.pinned, closingDate: j.closingDate, postedDate: j.postedDate,
      note: j.secretariatNote,
    })),
  };
}

// ─── SECRETARIAT: MODERATION ACTIONS ────────────────────────────

export async function moderateOpportunity(id: string, data: {
  status?: string;
  pinned?: boolean;
  note?: string;
}) {
  const { userId } = await getSecretariatContext();
  await db.update(lcsOpportunities).set({
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
    ...(data.note !== undefined ? { secretariatNote: data.note } : {}),
    moderatedBy: userId,
    moderatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(lcsOpportunities.id, id));
}

export async function moderateEmploymentNotice(id: string, data: {
  status?: string;
  pinned?: boolean;
  note?: string;
}) {
  const { userId } = await getSecretariatContext();
  await db.update(lcsEmploymentNotices).set({
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
    ...(data.note !== undefined ? { secretariatNote: data.note } : {}),
    moderatedBy: userId,
    moderatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(lcsEmploymentNotices.id, id));
}

// ─── SUPPLIER PORTAL ────────────────────────────────────────────

async function getSupplierContext() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const [profile] = await db.select().from(supplierProfiles)
    .where(eq(supplierProfiles.userId, session.user.id)).limit(1);
  if (!profile) throw new Error("No supplier profile found");
  return { userId: session.user.id, profile };
}

function requireSupplierPro(tier: string | null) {
  if (tier !== "pro") throw new Error("This feature requires the Supplier Pro plan. Upgrade in Settings.");
}

export async function fetchSupplierDashboard() {
  const { profile } = await getSupplierContext();

  // Responses
  const responses = await db.select().from(supplierResponses)
    .where(eq(supplierResponses.supplierId, profile.id))
    .orderBy(desc(supplierResponses.createdAt)).limit(50);

  // Matching opportunities (by service category)
  const categories = profile.serviceCategories || [];
  const allOpps = await db.select().from(lcsOpportunities)
    .where(eq(lcsOpportunities.status, "active"))
    .orderBy(desc(lcsOpportunities.postedDate)).limit(100);

  const matchingOpps = categories.length > 0
    ? allOpps.filter(o => categories.some(c => o.lcaCategory?.toLowerCase().includes(c.toLowerCase()) || o.title?.toLowerCase().includes(c.toLowerCase())))
    : [];

  const respondedIds = new Set(responses.map(r => r.opportunityId));

  return {
    profile: {
      id: profile.id,
      legalName: profile.legalName,
      tradingName: profile.tradingName,
      lcsCertId: profile.lcsCertId,
      lcsVerified: profile.lcsVerified,
      lcsExpirationDate: profile.lcsExpirationDate,
      tier: profile.tier || "lite",
      serviceCategories: profile.serviceCategories || [],
      profileViews: profile.profileViews || 0,
      responsesThisMonth: profile.responsesThisMonth || 0,
      capabilityStatement: profile.capabilityStatement,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      employeeCount: profile.employeeCount,
      yearEstablished: profile.yearEstablished,
      isGuyaneseOwned: profile.isGuyaneseOwned,
      logoUrl: profile.logoUrl,
    },
    stats: {
      totalResponses: responses.length,
      interested: responses.filter(r => r.status === "interested").length,
      contacted: responses.filter(r => r.status === "contacted").length,
      shortlisted: responses.filter(r => r.status === "shortlisted").length,
      awarded: responses.filter(r => r.status === "awarded").length,
    },
    matchingOpportunities: matchingOpps.slice(0, 5).map(o => ({
      id: o.id, title: o.title, company: o.contractorName, deadline: o.deadline,
      type: o.noticeType, responded: respondedIds.has(o.id),
    })),
    recentResponses: responses.slice(0, 5).map(r => {
      const opp = allOpps.find(o => o.id === r.opportunityId);
      return { id: r.id, status: r.status, createdAt: r.createdAt, opportunityTitle: opp?.title || "", company: opp?.contractorName || "" };
    }),
  };
}

export async function fetchSupplierOpportunities() {
  await getSupplierContext();
  const opps = await db.select().from(lcsOpportunities)
    .where(eq(lcsOpportunities.status, "active"))
    .orderBy(desc(lcsOpportunities.postedDate)).limit(200);
  return opps.map(o => ({
    id: o.id, title: o.title, company: o.contractorName, type: o.noticeType,
    category: o.lcaCategory, deadline: o.deadline, postedDate: o.postedDate,
    pinned: o.pinned, aiSummary: o.aiSummary,
  }));
}

export async function respondToOpportunity(opportunityId: string, data: { coverNote?: string; contactEmail?: string; contactPhone?: string }) {
  const { profile } = await getSupplierContext();

  // Check response limit for free tier
  if (profile.tier !== "pro") {
    const now = new Date();
    const resetAt = profile.responsesResetAt ? new Date(profile.responsesResetAt) : null;
    const needsReset = !resetAt || resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear();

    if (needsReset) {
      await db.update(supplierProfiles).set({ responsesThisMonth: 0, responsesResetAt: now }).where(eq(supplierProfiles.id, profile.id));
    } else if ((profile.responsesThisMonth || 0) >= 3) {
      throw new Error("Free plan limit: 3 responses per month. Upgrade to Pro for unlimited responses.");
    }
  }

  const [response] = await db.insert(supplierResponses).values({
    supplierId: profile.id,
    opportunityId,
    coverNote: data.coverNote || null,
    contactEmail: data.contactEmail || profile.contactEmail || null,
    contactPhone: data.contactPhone || profile.contactPhone || null,
    status: "interested",
  }).onConflictDoNothing().returning();

  if (response) {
    await db.update(supplierProfiles).set({
      responsesThisMonth: sql`COALESCE(${supplierProfiles.responsesThisMonth}, 0) + 1`,
    }).where(eq(supplierProfiles.id, profile.id));
  }

  return response;
}

export async function fetchSupplierResponses() {
  const { profile } = await getSupplierContext();
  requireSupplierPro(profile.tier);

  const responses = await db.select().from(supplierResponses)
    .where(eq(supplierResponses.supplierId, profile.id))
    .orderBy(desc(supplierResponses.createdAt)).limit(100);

  const oppIds = responses.map(r => r.opportunityId);
  const opps = oppIds.length > 0
    ? await db.select().from(lcsOpportunities).where(sql`${lcsOpportunities.id} = ANY(${oppIds})`)
    : [];

  return responses.map(r => {
    const opp = opps.find(o => o.id === r.opportunityId);
    return {
      id: r.id, status: r.status, coverNote: r.coverNote,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
      opportunity: opp ? { id: opp.id, title: opp.title, company: opp.contractorName, deadline: opp.deadline, type: opp.noticeType } : null,
    };
  });
}

export async function updateSupplierProfile(data: {
  legalName?: string; tradingName?: string; contactEmail?: string; contactPhone?: string;
  serviceCategories?: string[]; capabilityStatement?: string; employeeCount?: number;
  yearEstablished?: number; isGuyaneseOwned?: boolean; website?: string; logoUrl?: string;
}) {
  const { profile } = await getSupplierContext();
  // Capability statement requires Pro
  if (data.capabilityStatement !== undefined && profile.tier !== "pro") {
    delete data.capabilityStatement;
  }
  await db.update(supplierProfiles).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(supplierProfiles.id, profile.id));
}

export async function fetchSupplierAnalytics() {
  const { profile } = await getSupplierContext();
  requireSupplierPro(profile.tier);

  const responses = await db.select().from(supplierResponses)
    .where(eq(supplierResponses.supplierId, profile.id)).limit(200);

  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  for (const r of responses) {
    byStatus[r.status || "interested"] = (byStatus[r.status || "interested"] || 0) + 1;
    if (r.createdAt) {
      const month = r.createdAt.toISOString().slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    }
  }

  return {
    profileViews: profile.profileViews || 0,
    totalResponses: responses.length,
    byStatus,
    byMonth: Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])),
    awardRate: responses.length > 0
      ? Math.round((responses.filter(r => r.status === "awarded").length / responses.length) * 100)
      : 0,
    tier: profile.tier || "lite",
  };
}

// ─── LCS CERTIFICATE APPLICATION SERVICE ────────────────────────

export async function createCertApplication(data: {
  applicationType: "individual" | "business";
  tier: "self_service" | "managed" | "concierge";
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [app] = await db.insert(lcsCertApplications).values({
    userId: session.user.id,
    applicationType: data.applicationType,
    tier: data.tier,
    status: "draft",
    completedStep: 0,
  }).returning();
  return app;
}

export async function fetchMyCertApplications() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  return db.select().from(lcsCertApplications)
    .where(eq(lcsCertApplications.userId, session.user.id))
    .orderBy(desc(lcsCertApplications.createdAt)).limit(20);
}

export async function fetchCertApplication(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Allow the applicant or secretariat/admin to view
  let isAdmin = !!(session.user as Record<string, unknown>).isSuperAdmin;
  if (!isAdmin) {
    try { await getSecretariatContext(); isAdmin = true; } catch { /* not secretariat */ }
  }

  const conditions = isAdmin
    ? eq(lcsCertApplications.id, id)
    : and(eq(lcsCertApplications.id, id), eq(lcsCertApplications.userId, session.user.id));

  const [app] = await db.select().from(lcsCertApplications).where(conditions).limit(1);
  if (!app) throw new Error("Application not found");
  return app;
}

export async function updateCertApplication(id: string, data: Record<string, unknown>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Verify ownership
  const [app] = await db.select({ id: lcsCertApplications.id, status: lcsCertApplications.status })
    .from(lcsCertApplications)
    .where(and(eq(lcsCertApplications.id, id), eq(lcsCertApplications.userId, session.user.id)))
    .limit(1);
  if (!app) throw new Error("Application not found");
  if (app.status !== "draft" && app.status !== "documents_pending") {
    throw new Error("Application cannot be modified after submission");
  }

  await db.update(lcsCertApplications).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(lcsCertApplications.id, id));
}

export async function submitCertApplication(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [app] = await db.select().from(lcsCertApplications)
    .where(and(eq(lcsCertApplications.id, id), eq(lcsCertApplications.userId, session.user.id)))
    .limit(1);
  if (!app) throw new Error("Application not found");

  // Validate required fields
  if (!app.applicantName) throw new Error("Applicant name is required");
  if (!app.applicantEmail) throw new Error("Email is required");
  if (app.applicationType === "business" && !app.legalName) throw new Error("Legal business name is required");
  if (!app.paidAt) throw new Error("Payment is required before submission");

  await db.update(lcsCertApplications).set({
    status: "under_review",
    updatedAt: new Date(),
  }).where(eq(lcsCertApplications.id, id));
}

// Admin: review cert applications
export async function fetchCertApplicationQueue() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  // Allow secretariat or super admin
  const isSuperAdmin = (session.user as Record<string, unknown>).isSuperAdmin;
  if (!isSuperAdmin) {
    try { await getSecretariatContext(); } catch { throw new Error("Not authorized"); }
  }

  return db.select({
    id: lcsCertApplications.id,
    applicationType: lcsCertApplications.applicationType,
    tier: lcsCertApplications.tier,
    status: lcsCertApplications.status,
    applicantName: lcsCertApplications.applicantName,
    applicantEmail: lcsCertApplications.applicantEmail,
    legalName: lcsCertApplications.legalName,
    serviceCategories: lcsCertApplications.serviceCategories,
    amountPaid: lcsCertApplications.amountPaid,
    paidAt: lcsCertApplications.paidAt,
    createdAt: lcsCertApplications.createdAt,
    completedStep: lcsCertApplications.completedStep,
  }).from(lcsCertApplications)
    .where(sql`${lcsCertApplications.status} != 'draft'`)
    .orderBy(desc(lcsCertApplications.createdAt)).limit(100);
}

export async function reviewCertApplication(id: string, data: {
  status: "submitted_to_lcs" | "approved" | "rejected";
  reviewNotes?: string;
  lcsCertId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const isSuperAdmin = (session.user as Record<string, unknown>).isSuperAdmin;
  if (!isSuperAdmin) {
    try { await getSecretariatContext(); } catch { throw new Error("Not authorized"); }
  }

  const update: Record<string, unknown> = {
    status: data.status,
    reviewNotes: data.reviewNotes || null,
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };

  if (data.status === "submitted_to_lcs") {
    update.submittedToLcsAt = new Date();
  }
  if (data.status === "approved" && data.lcsCertId) {
    update.lcsCertId = data.lcsCertId;
  }

  await db.update(lcsCertApplications).set(update).where(eq(lcsCertApplications.id, id));

  // If approved, auto-create or update supplier/seeker profile
  if (data.status === "approved" && data.lcsCertId) {
    const [app] = await db.select().from(lcsCertApplications).where(eq(lcsCertApplications.id, id)).limit(1);
    if (app) {
      if (app.applicationType === "business") {
        const [existing] = await db.select({ id: supplierProfiles.id }).from(supplierProfiles)
          .where(eq(supplierProfiles.userId, app.userId)).limit(1);
        if (existing) {
          await db.update(supplierProfiles).set({
            lcsCertId: data.lcsCertId, lcsVerified: true, lcsVerifiedAt: new Date(),
            legalName: app.legalName || undefined, tradingName: app.tradingName || undefined,
            serviceCategories: app.serviceCategories || undefined,
          }).where(eq(supplierProfiles.id, existing.id));
        } else {
          await db.insert(supplierProfiles).values({
            userId: app.userId, lcsCertId: data.lcsCertId, lcsVerified: true, lcsVerifiedAt: new Date(),
            legalName: app.legalName, tradingName: app.tradingName,
            serviceCategories: app.serviceCategories || [],
            contactEmail: app.businessEmail, contactPhone: app.businessPhone,
          });
        }
      } else {
        // Individual — update seeker profile
        const [existing] = await db.select({ id: jobSeekerProfiles.id }).from(jobSeekerProfiles)
          .where(eq(jobSeekerProfiles.userId, app.userId)).limit(1);
        if (existing) {
          await db.update(jobSeekerProfiles).set({
            lcsCertId: data.lcsCertId, lcaAttestationDate: new Date(),
          }).where(eq(jobSeekerProfiles.id, existing.id));
        }
      }
    }
  }
}

// ─── INDUSTRY NEWS ──────────────────────────────────────────────

export async function fetchIndustryNews(limit = 20, userType?: "filer" | "supplier" | "seeker" | "secretariat") {
  const all = await db.select().from(industryNews)
    .orderBy(desc(industryNews.publishedAt))
    .limit(100);

  if (!userType) return all.slice(0, limit);

  // Score articles differently per user type
  const categoryWeights: Record<string, Record<string, number>> = {
    filer: { local_content: 10, policy: 8, contracts: 6, production: 4, employment: 5, general: 2 },
    supplier: { contracts: 10, local_content: 7, production: 6, employment: 4, policy: 3, general: 2 },
    seeker: { employment: 10, local_content: 6, contracts: 5, production: 3, policy: 2, general: 2 },
    secretariat: { policy: 10, local_content: 9, employment: 7, contracts: 5, production: 4, general: 3 },
  };

  const weights = categoryWeights[userType];

  const scored = all.map(article => {
    const catWeight = weights[article.category || "general"] || 2;
    const relevance = article.relevanceScore || 5;
    const recencyBonus = article.publishedAt
      ? Math.max(0, 10 - Math.floor((Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)))
      : 0;
    return { ...article, score: catWeight + relevance + recencyBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ─── CANCELLATION / DELETION ──────────────────────────────────

export async function submitCancellationFeedback(data: {
  reason: string;
  reasonDetail?: string;
  feedback?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.insert(cancellationFeedback).values({
    userId: session.user.id,
    userRole: (session.user as any).userRole ?? null,
    reason: data.reason,
    reasonDetail: data.reasonDetail ?? null,
    feedback: data.feedback ?? null,
  });
}

export async function cancelSubscription() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Find user's tenant
  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, session.user.id))
    .limit(1);

  if (!membership) throw new Error("No subscription found");

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);

  if (!tenant) throw new Error("Tenant not found");

  // Cancel Stripe subscription if exists
  // cancel_at_period_end keeps access until trial/billing period ends
  // Stripe fires customer.subscription.deleted when it actually ends → locks them out
  if (tenant.stripeSubscriptionId) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      console.error("Stripe cancel error:", err);
    }
  } else {
    // No Stripe subscription (legacy or edge case) — lock immediately
    await db
      .update(tenants)
      .set({ stripeSubscriptionStatus: "canceled" })
      .where(eq(tenants.id, tenant.id));
  }

  // Log to audit
  await db.insert(auditLogs).values({
    tenantId: tenant.id,
    userId: session.user.id,
    action: "cancel_subscription",
    entityType: "tenant",
    entityId: tenant.id,
    metadata: JSON.stringify({ previousPlan: tenant.plan }),
  });

  // Sync HubSpot
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user?.email) {
    try {
      const { syncChurn } = await import("@/lib/hubspot-sync");
      await syncChurn(user.email);
    } catch {}
  }
}

export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const userId = session.user.id;

  // Get user data for archive
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  // Get tenant membership
  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);

  let tenant = null;
  if (membership) {
    const [t] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, membership.tenantId))
      .limit(1);
    tenant = t ?? null;
  }

  // Cancel Stripe if active
  if (tenant?.stripeSubscriptionId) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);
    } catch (err) {
      console.error("Stripe cancel error:", err);
    }
  }

  // Archive user data to audit log before deletion
  await db.insert(auditLogs).values({
    tenantId: tenant?.id ?? null,
    userId: null, // will be deleted
    userName: user.name,
    action: "delete_account",
    entityType: "user",
    entityId: userId,
    metadata: JSON.stringify({
      email: user.email,
      name: user.name,
      userRole: user.userRole,
      tenantId: tenant?.id,
      tenantName: tenant?.name,
      tenantPlan: tenant?.plan,
      deletedAt: new Date().toISOString(),
    }),
  });

  // Sync HubSpot
  if (user.email) {
    try {
      const { syncChurn } = await import("@/lib/hubspot-sync");
      await syncChurn(user.email);
    } catch {}
  }

  // Delete user (cascades to tenant_members, etc.)
  await db.delete(users).where(eq(users.id, userId));
}

// ─── ANNOUNCEMENTS ────────────────────────────────────────────

export async function fetchAnnouncements() {
  // Secretariat: fetch all announcements for management
  return db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(data: {
  title: string;
  body: string;
  priority: string;
  targetRoles: string;
  publishAt: string | null;
  expiresAt: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const publishAt = data.publishAt ? new Date(data.publishAt) : null;
  const isImmediate = !publishAt || publishAt <= new Date();

  const [row] = await db
    .insert(announcements)
    .values({
      title: data.title,
      body: data.body,
      priority: data.priority || "normal",
      targetRoles: data.targetRoles || "all",
      authorId: session.user.id,
      authorName: session.user.name || null,
      status: isImmediate ? "published" : "scheduled",
      publishAt,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      publishedAt: isImmediate ? new Date() : null,
    })
    .returning();

  return row;
}

export async function updateAnnouncement(
  id: string,
  data: {
    title?: string;
    body?: string;
    priority?: string;
    targetRoles?: string;
    publishAt?: string | null;
    expiresAt?: string | null;
    status?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.body !== undefined) updates.body = data.body;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.targetRoles !== undefined) updates.targetRoles = data.targetRoles;
  if (data.publishAt !== undefined) updates.publishAt = data.publishAt ? new Date(data.publishAt) : null;
  if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  if (data.status === "published") {
    updates.status = "published";
    updates.publishedAt = new Date();
  } else if (data.status !== undefined) {
    updates.status = data.status;
  }

  await db.update(announcements).set(updates).where(eq(announcements.id, id));
}

export async function deleteAnnouncement(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await db.delete(announcements).where(eq(announcements.id, id));
}

export async function fetchActiveAnnouncements(userRole: string) {
  const now = new Date();

  // Fetch published + scheduled-that-are-due, not expired
  const rows = await db
    .select()
    .from(announcements)
    .where(
      and(
        or(
          eq(announcements.status, "published"),
          and(eq(announcements.status, "scheduled"), lte(announcements.publishAt, now))
        ),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now))
      )
    )
    .orderBy(desc(announcements.publishedAt), desc(announcements.createdAt));

  // Auto-publish scheduled announcements that are now due
  for (const row of rows) {
    if (row.status === "scheduled") {
      await db.update(announcements).set({
        status: "published",
        publishedAt: row.publishAt || now,
      }).where(eq(announcements.id, row.id));
    }
  }

  // Filter by target role
  return rows.filter(a => {
    if (a.targetRoles === "all") return true;
    try {
      const roles = JSON.parse(a.targetRoles) as string[];
      return roles.includes(userRole);
    } catch {
      return a.targetRoles === userRole;
    }
  });
}

// ─── SECRETARIAT: TALENT POOL ─────────────────────────────────

export async function fetchSecretariatTalentPool(filters?: {
  search?: string;
  category?: string;
  guyaneseOnly?: boolean;
}) {
  const demo = await getDemoFilter();
  const allProfiles = await db
    .select({
      id: jobSeekerProfiles.id,
      userId: jobSeekerProfiles.userId,
      currentJobTitle: jobSeekerProfiles.currentJobTitle,
      employmentCategory: jobSeekerProfiles.employmentCategory,
      yearsExperience: jobSeekerProfiles.yearsExperience,
      isGuyanese: jobSeekerProfiles.isGuyanese,
      nationality: jobSeekerProfiles.nationality,
      skills: jobSeekerProfiles.skills,
      locationPreference: jobSeekerProfiles.locationPreference,
      headline: jobSeekerProfiles.headline,
      educationLevel: jobSeekerProfiles.educationLevel,
      educationField: jobSeekerProfiles.educationField,
      certifications: jobSeekerProfiles.certifications,
      guyaneseStatus: jobSeekerProfiles.guyaneseStatus,
      cvUrl: jobSeekerProfiles.cvUrl,
      resumeContent: jobSeekerProfiles.resumeContent,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      avatarUrl: users.avatarUrl,
    })
    .from(jobSeekerProfiles)
    .innerJoin(users, eq(jobSeekerProfiles.userId, users.id))
    .limit(500);

  const profiles = allProfiles.filter(p => demo.includeUser(p.userId));

  // Get badges
  const allUserIds = profiles.map(p => p.userId);
  const allBadges = allUserIds.length > 0
    ? await db.select({ userId: userCourseProgress.userId, badgeLabel: courses.badgeLabel })
        .from(userCourseProgress)
        .innerJoin(courses, eq(userCourseProgress.courseId, courses.id))
        .where(sql`${userCourseProgress.badgeEarnedAt} IS NOT NULL`)
        .limit(500)
    : [];

  const enriched = profiles.map(p => ({
    ...p,
    badges: allBadges.filter(b => b.userId === p.userId).map(b => b.badgeLabel).filter((v, i, a) => a.indexOf(v) === i),
  }));

  let filtered = enriched;
  if (filters?.guyaneseOnly) filtered = filtered.filter(p => p.isGuyanese);
  if (filters?.category) filtered = filtered.filter(p => p.employmentCategory === filters.category);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.userName?.toLowerCase().includes(q) ||
      p.currentJobTitle?.toLowerCase().includes(q) ||
      p.headline?.toLowerCase().includes(q) ||
      p.skills?.some(s => s.toLowerCase().includes(q))
    );
  }

  return filtered;
}

// ─── SECRETARIAT: SUPPLIER DIRECTORY ──────────────────────────

export async function fetchSecretariatSupplierDirectory(filters?: {
  search?: string;
  category?: string;
  statusFilter?: string;
}) {
  const rows = await db.select().from(lcsRegister).orderBy(desc(lcsRegister.legalName)).limit(1000);

  let filtered = rows;
  if (filters?.statusFilter && filters.statusFilter !== "all") {
    filtered = filtered.filter(r => r.status?.toLowerCase() === filters.statusFilter);
  }
  if (filters?.category && filters.category !== "all") {
    filtered = filtered.filter(r => r.serviceCategories?.some(c => c.toLowerCase().includes(filters.category!.toLowerCase())));
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(r =>
      r.legalName?.toLowerCase().includes(q) ||
      r.tradingName?.toLowerCase().includes(q) ||
      r.certId?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  }

  return {
    suppliers: filtered,
    total: rows.length,
    active: rows.filter(r => r.status === "Active").length,
    expired: rows.filter(r => r.status === "Expired" || (r.expirationDate && new Date(r.expirationDate) < new Date())).length,
    categories: [...new Set(rows.flatMap(r => r.serviceCategories || []))].sort(),
  };
}

// ─── SECRETARIAT: DEADLINE CALENDAR ───────────────────────────

export async function fetchSecretariatDeadlines() {
  const demo = await getDemoFilter();
  const allPeriods = await db
    .select({
      id: reportingPeriods.id,
      entityId: reportingPeriods.entityId,
      tenantId: entities.tenantId,
      reportType: reportingPeriods.reportType,
      periodStart: reportingPeriods.periodStart,
      periodEnd: reportingPeriods.periodEnd,
      dueDate: reportingPeriods.dueDate,
      fiscalYear: reportingPeriods.fiscalYear,
      status: reportingPeriods.status,
      submittedAt: reportingPeriods.submittedAt,
      entityName: entities.legalName,
      tenantName: tenants.name,
      companyType: entities.companyType,
    })
    .from(reportingPeriods)
    .innerJoin(entities, eq(reportingPeriods.entityId, entities.id))
    .innerJoin(tenants, eq(entities.tenantId, tenants.id))
    .orderBy(asc(reportingPeriods.dueDate));

  const periods = allPeriods.filter(p => demo.includeTenant(p.tenantId));
  const now = new Date();
  return {
    periods,
    overdue: periods.filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) < now),
    upcoming: periods.filter(p => p.status !== "submitted" && p.status !== "acknowledged" && new Date(p.dueDate) >= now),
    submitted: periods.filter(p => p.status === "submitted" || p.status === "acknowledged"),
  };
}

// ─── SECRETARIAT: AUDIT TRAIL ─────────────────────────────────

export async function fetchSecretariatAuditTrail(filters?: {
  search?: string;
  action?: string;
  limit?: number;
}) {
  const demo = await getDemoFilter();
  const rows = await db
    .select({
      id: auditLogs.id,
      tenantId: auditLogs.tenantId,
      userId: auditLogs.userId,
      userName: auditLogs.userName,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      fieldName: auditLogs.fieldName,
      oldValue: auditLogs.oldValue,
      newValue: auditLogs.newValue,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      tenantName: tenants.name,
    })
    .from(auditLogs)
    .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters?.limit || 200);

  let filtered = rows.filter(r => r.tenantId ? demo.includeTenant(r.tenantId) : true);
  if (filters?.action && filters.action !== "all") {
    filtered = filtered.filter(r => r.action === filters.action);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(r =>
      r.userName?.toLowerCase().includes(q) ||
      r.tenantName?.toLowerCase().includes(q) ||
      r.entityType?.toLowerCase().includes(q) ||
      r.action?.toLowerCase().includes(q)
    );
  }

  return filtered;
}

// ─── SECRETARIAT: NOTIFICATIONS LOG ───────────────────────────

export async function fetchSecretariatNotifications(filters?: {
  type?: string;
  limit?: number;
}) {
  const demo = await getDemoFilter();
  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      read: notifications.read,
      emailSent: notifications.emailSent,
      emailSentAt: notifications.emailSentAt,
      createdAt: notifications.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .orderBy(desc(notifications.createdAt))
    .limit(filters?.limit || 200);

  let filtered = rows.filter(r => demo.includeUser(r.userId));
  if (filters?.type && filters.type !== "all") {
    filtered = filtered.filter(r => r.type === filters.type);
  }

  const types = [...new Set(rows.map(r => r.type))].sort();
  return { notifications: filtered, types, total: rows.length };
}

// ─── SECRETARIAT: DOCUMENT LIBRARY ────────────────────────────

export async function fetchSecretariatDocuments() {
  const demo = await getDemoFilter();
  const allSubs = await db
    .select({
      id: submissionLogs.id,
      entityId: submissionLogs.entityId,
      tenantId: entities.tenantId,
      reportingPeriodId: submissionLogs.reportingPeriodId,
      submissionMethod: submissionLogs.submissionMethod,
      uploadedFileName: submissionLogs.uploadedFileName,
      uploadedFileKey: submissionLogs.uploadedFileKey,
      submittedAt: submissionLogs.createdAt,
      entityName: entities.legalName,
      tenantName: tenants.name,
      reportType: reportingPeriods.reportType,
      fiscalYear: reportingPeriods.fiscalYear,
    })
    .from(submissionLogs)
    .innerJoin(entities, eq(submissionLogs.entityId, entities.id))
    .innerJoin(tenants, eq(entities.tenantId, tenants.id))
    .innerJoin(reportingPeriods, eq(submissionLogs.reportingPeriodId, reportingPeriods.id))
    .orderBy(desc(submissionLogs.createdAt))
    .limit(200);

  return allSubs.filter(s => demo.includeTenant(s.tenantId));
}

