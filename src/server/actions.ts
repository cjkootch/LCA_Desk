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
import { eq, and, gte, lte, or, sql, desc, asc, isNull } from "drizzle-orm";
import { getPlan, getEffectivePlan, isInTrial, isTrialExpired, getTrialDaysRemaining, getBillingAccess } from "@/lib/plans";
import { entitySchema } from "@/server/schemas";
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

export async function addEntity(data: Record<string, unknown>) {
  const validated = entitySchema.safeParse(data);
  if (!validated.success) throw new Error(`Invalid entity data: ${validated.error.issues.map(i => i.message).join(", ")}`);
  const { tenantId, tenant, plan } = await getSessionTenant();
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
  data: Record<string, unknown>
) {
  // Validate critical fields
  if (!data.supplier_name || typeof data.supplier_name !== "string") throw new Error("Supplier name is required");
  const { tenantId, userId } = await getSessionTenant();
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
  data: Record<string, unknown>
) {
  if (!data.employment_category || typeof data.employment_category !== "string") throw new Error("Employment category is required");
  const { tenantId, userId } = await getSessionTenant();
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
  data: Record<string, unknown>
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
  const { tenantId } = await getSessionTenant();

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
    const [updated] = await db
      .update(narrativeDrafts)
      .set({ draftContent: content, modelUsed: "claude-sonnet-4-6" })
      .where(eq(narrativeDrafts.id, existing.id))
      .returning();
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
      promptVersion: "1.0",
    })
    .returning();
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
          await db.update(users).set({ userRole: newRole }).where(eq(users.id, userId));
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

  await db
    .update(users)
    .set({ userRole: newRole, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

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
  // Check if already seeded
  const [existing] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, "lca-fundamentals")).limit(1);
  if (existing) return existing.id;

  const [course] = await db.insert(courses).values({
    slug: "lca-fundamentals",
    title: "LCA Fundamentals",
    description: "Understand Guyana's Local Content Act 2021 — the legal framework, filing obligations, employment requirements, and your rights as a Guyanese national in the petroleum sector.",
    audience: "all",
    jurisdictionCode: "GY",
    moduleCount: 5,
    badgeLabel: "LCA Certified",
    badgeColor: "accent",
    estimatedMinutes: 30,
  }).returning();

  const moduleData = [
    {
      title: "Understanding the Local Content Act 2021",
      content: `## What is the Local Content Act?\n\n- The **Local Content Act No. 18 of 2021** is Guyana's landmark petroleum legislation\n- It ensures **Guyanese citizens and companies** benefit from the oil and gas sector\n- The Act establishes legally binding requirements for operators and their supply chains\n- Non-compliance carries fines up to **GY$50,000,000**\n\n## Key Objectives of the Act\n\n- **Maximize** the use of Guyanese labour, services, and goods\n- **Develop** local capacity and skills through training obligations\n- **Ensure transparency** in procurement and hiring practices\n- **Create meaningful economic participation** for Guyanese nationals\n- **Build a sustainable** local supply chain for the petroleum sector\n\n## Who Must Comply?\n\n- **Contractors** — companies with direct agreements with the Government (e.g., ExxonMobil)\n- **Sub-Contractors** — companies with agreements under a Contractor (e.g., Halliburton)\n- **Licensees** — holders of petroleum exploration or production licences\n- All tiers of the **supply chain** operating in Guyana's petroleum sector must comply\n\n## The Local Content Secretariat\n\n- Operates under the **Ministry of Natural Resources**\n- Maintains the **LCS Register** of certified Guyanese suppliers\n- Reviews **Half-Yearly Reports** submitted by all operators\n- Reports are submitted to **localcontent@nre.gov.gy**\n\n## How the Act is Enforced\n\n- Operators must file **Half-Yearly Reports** (H1 and H2) with detailed compliance data\n- The Secretariat can **audit** any operator at any time\n- **False submissions** are a criminal offense under Section 23\n- The Act sets **minimum percentages** for Guyanese employment and procurement`,
      quiz: [
        { question: "What year was the Local Content Act enacted?", options: ["2019", "2020", "2021", "2022"], correctIndex: 2 },
        { question: "Who oversees LCA compliance?", options: ["EPA", "Ministry of Finance", "Local Content Secretariat", "Bank of Guyana"], correctIndex: 2 },
        { question: "The LCA applies to which sector?", options: ["Mining", "Agriculture", "Petroleum", "All sectors"], correctIndex: 2 },
        { question: "Which of these must comply with the LCA?", options: ["Only Guyanese companies", "Only foreign companies", "Contractors, Sub-Contractors, and Licensees", "Only ExxonMobil"], correctIndex: 2 },
        { question: "Reports are submitted to which email?", options: ["lca@gov.gy", "localcontent@nre.gov.gy", "reports@petroleum.gov.gy", "compliance@guyana.gov.gy"], correctIndex: 1 },
      ],
    },
    {
      title: "Employment Categories & Requirements",
      content: `## First Consideration (Section 12)\n\n- Every employer must give **first consideration** to qualified Guyanese nationals\n- Job postings must be **advertised locally** before hiring internationally\n- Guyanese candidates must be **evaluated first** in the hiring process\n- Employers must **document their rationale** when hiring non-Guyanese workers\n\n## Managerial Employment — 75% Minimum\n\n- Covers **senior management**, directors, and department heads\n- At least **75%** of managerial positions must be held by Guyanese nationals\n- Includes roles such as **General Manager**, **Country Manager**, and **VP-level** positions\n- Employers must demonstrate **succession planning** for non-Guyanese managers\n\n## Technical Employment — 60% Minimum\n\n- Covers **engineers**, geologists, technicians, and skilled specialists\n- At least **60%** of technical positions must be held by Guyanese nationals\n- This is the category with the **lowest minimum** due to specialized skill requirements\n- Employers must invest in **training programs** to build local technical capacity\n\n## Non-Technical Employment — 80% Minimum\n\n- Covers **administrative**, clerical, support staff, and logistics roles\n- At least **80%** of non-technical positions must be held by Guyanese nationals\n- This is the **highest minimum** — reflecting strong local availability in these roles\n- Includes drivers, security, catering staff, and office administrators\n\n## ISCO-08 Classification & Reporting\n\n- All positions must be classified using the **International Standard Classification of Occupations (ISCO-08)**\n- ISCO-08 codes are required in **Half-Yearly Report** employment tables\n- The classification ensures **consistent categorization** across all operators\n- Examples: 1211 (Finance Manager), 2146 (Mining Engineer), 4110 (General Office Clerk)\n\n## Equal Pay (Section 18)\n\n- Guyanese nationals must receive **equal pay for work of equal value**\n- Compensation includes **salary, bonuses, allowances**, and benefits\n- No differentiation permitted based solely on **nationality**\n- The Secretariat reviews **remuneration data** in filed reports to verify compliance`,
      quiz: [
        { question: "What is the minimum Guyanese percentage for Managerial roles?", options: ["60%", "70%", "75%", "80%"], correctIndex: 2 },
        { question: "What classification system is used for employment?", options: ["SOC", "NAICS", "ISCO-08", "ISIC"], correctIndex: 2 },
        { question: "Section 18 guarantees Guyanese nationals:", options: ["Priority hiring", "Equal pay", "Free training", "Management roles"], correctIndex: 1 },
        { question: "Which category requires 80% Guyanese employment?", options: ["Managerial", "Technical", "Non-Technical", "All categories"], correctIndex: 2 },
        { question: "'First consideration' means:", options: ["Must hire only Guyanese", "Guyanese must be considered before others", "Pay Guyanese more", "Train Guyanese first"], correctIndex: 1 },
      ],
    },
    {
      title: "The LCS Register & Supplier Certification",
      content: `## What is the LCS Register?\n\n- The **Local Content Secretariat** maintains an official register of certified Guyanese suppliers\n- Hosted at **lcregister.petroleum.gov.gy** and publicly accessible\n- Contains **796+ registered companies** across all service categories\n- Updated regularly as new businesses apply and are certified\n\n## The LCS Certificate\n\n- To count as a **Guyanese supplier** for compliance, a company must hold a valid **LCS Certificate**\n- Certificate format: **LCSR-XXXXXXXX** (unique identifier per company)\n- Contractors must record this ID when reporting **expenditure** with Guyanese suppliers\n- Certificates can **expire** — suppliers must renew to maintain verified status\n\n## Local Content Rate\n\n- **LC Rate** = Guyanese supplier spend / Total spend x 100%\n- Only expenditure with **LCS-certified suppliers** counts toward the Guyanese total\n- Higher LC rates mean **better compliance scores** in Half-Yearly Reports\n- The Secretariat **benchmarks** LC rates across operators for each sector category\n\n## Service Categories on the Register\n\n- The register covers **40+ sector categories** from the First Schedule\n- Includes **Engineering and Machining**, **Construction**, and **Transportation**\n- Also covers **Catering and Food Services**, **Environmental Services**, and **Security**\n- Categories like **ICT**, **Waste Management**, and **Accommodation** are also listed\n- Suppliers can register under **multiple categories**\n\n## How to Get Registered\n\n- Apply through the Secretariat with your **business registration** documents\n- Provide your **TIN** (Taxpayer Identification Number) and proof of **Guyanese ownership**\n- The Secretariat reviews applications and issues certificates to qualifying companies\n- LCA Desk offers **LCS Certificate as a Service** at /register-lcs starting at $49`,
      quiz: [
        { question: "What format is the LCS Certificate ID?", options: ["LCS-001", "LCSR-XXXXXXXX", "GY-CERT-001", "LC-2021-001"], correctIndex: 1 },
        { question: "Where is the LCS Register hosted?", options: ["lcadesk.com", "nre.gov.gy", "lcregister.petroleum.gov.gy", "guyana.gov.gy"], correctIndex: 2 },
        { question: "Local Content Rate measures:", options: ["Employee satisfaction", "Percentage of Guyanese employees", "Percentage of spend with LCS-certified suppliers", "Number of suppliers"], correctIndex: 2 },
        { question: "How many service categories does the register cover?", options: ["10+", "20+", "40+", "100+"], correctIndex: 2 },
        { question: "To count as a Guyanese supplier, a company needs:", options: ["A Guyana address", "A valid LCS Certificate", "Guyanese employees", "Government approval"], correctIndex: 1 },
      ],
    },
    {
      title: "Rights & Protections for Workers",
      content: `## Your Rights Under the LCA\n\n- As a worker in Guyana's petroleum sector, the LCA provides **specific legal protections**\n- These rights apply to all Guyanese nationals employed by **Contractors, Sub-Contractors, and Licensees**\n- The Act covers **hiring practices**, **compensation**, and **skills development**\n- Workers can report violations directly to the **Local Content Secretariat**\n\n## First Consideration (Section 12)\n\n- Every employer must give **first consideration** to qualified Guyanese nationals\n- Job postings must be **advertised locally** before international recruitment\n- Guyanese candidates must be **evaluated before** international candidates\n- Employers must **document their hiring rationale** when choosing non-Guyanese workers\n\n## Equal Pay (Section 18)\n\n- Guyanese nationals must receive **equal pay for work of equal value**\n- This includes **salary, bonuses, allowances**, and all forms of compensation\n- No worker can be paid less solely because of their **nationality**\n- The Secretariat reviews **remuneration data** in Half-Yearly Reports to verify compliance\n\n## Capacity Development (Section 19)\n\n- Employers must invest in **training and skills development** for Guyanese workers\n- Required programs include **on-the-job training** and mentorship\n- **Scholarships and bursaries** must be made available for advanced skill building\n- **Technology transfer programs** ensure knowledge moves from international to local staff\n\n## Penalties for Non-Compliance\n\n- Fines range from **GY$1,000,000 to GY$50,000,000** depending on severity\n- **False submissions** are a criminal offense under Section 23 of the Act\n- The Secretariat can **audit any operator** at any time without prior notice\n- Repeat offenders face **escalating penalties** and increased scrutiny`,
      quiz: [
        { question: "What is the maximum fine for LCA non-compliance?", options: ["GY$1M", "GY$10M", "GY$50M", "GY$100M"], correctIndex: 2 },
        { question: "False submissions are:", options: ["A warning offense", "A civil penalty", "A criminal offense", "Not penalized"], correctIndex: 2 },
        { question: "Section 19 requires employers to invest in:", options: ["Equipment", "Capacity development for Guyanese", "Government programs", "Environmental protection"], correctIndex: 1 },
        { question: "Equal pay is guaranteed by which section?", options: ["Section 12", "Section 18", "Section 19", "Section 23"], correctIndex: 1 },
        { question: "Job postings must be:", options: ["In English only", "Advertised internationally first", "Advertised locally", "Approved by the Secretariat"], correctIndex: 2 },
      ],
    },
    {
      title: "Guyana's Petroleum Sector Overview",
      content: `## The Stabroek Block\n\n- Guyana's petroleum industry is centered on the **Stabroek Block** offshore\n- Operated by **ExxonMobil Guyana Limited** with **Hess** and **CNOOC** as co-venturers\n- Estimated **11+ billion barrels** of recoverable oil equivalent\n- One of the most significant oil discoveries of the past decade\n\n## Production Milestones\n\n- **First oil**: December 2019 from the Liza Phase 1 development\n- **Current production**: 600,000+ barrels per day across multiple projects\n- **FPSOs operating**: Liza Destiny, Liza Unity, Prosperity, and Yellowtail\n- Each FPSO (**Floating Production Storage and Offloading**) vessel processes and stores oil offshore\n\n## Major Operators & Service Companies\n\n- **Operators**: ExxonMobil, Hess, CNOOC, TotalEnergies, CGX\n- **Service companies**: Halliburton, SLB, Baker Hughes, TechnipFMC, Saipem\n- **Support infrastructure**: GYSBI (shore base), SBM Offshore (FPSOs), Stena Drilling\n- Each company in this ecosystem has **LCA compliance obligations**\n\n## Economic Impact on Guyana\n\n- **Thousands of direct and indirect jobs** created across the supply chain\n- A rapidly **growing local supply chain** in catering, transport, engineering, and more\n- Revenue channeled through the **Natural Resource Fund** (sovereign wealth fund)\n- GDP growth has made Guyana one of the **fastest-growing economies** globally\n\n## Your Role in the Ecosystem\n\n- **Job seekers**: Thousands of positions available across operators and service companies\n- **Suppliers**: Growing demand for Guyanese goods and services in 40+ categories\n- **Compliance professionals**: Every operator needs staff to manage LCA reporting\n- Understanding this ecosystem is key to **participating in Guyana's economic transformation**`,
      quiz: [
        { question: "Who operates the Stabroek Block?", options: ["Halliburton", "ExxonMobil Guyana Limited", "TotalEnergies", "Petrobras"], correctIndex: 1 },
        { question: "When was Guyana's first oil?", options: ["2017", "2018", "2019", "2020"], correctIndex: 2 },
        { question: "What does FPSO stand for?", options: ["First Petroleum Supply Operation", "Floating Production Storage and Offloading", "Federal Petroleum Safety Office", "Fixed Platform Shore Operations"], correctIndex: 1 },
        { question: "GYSBI provides:", options: ["Drilling services", "Shore base operations", "Legal services", "Banking services"], correctIndex: 1 },
        { question: "Guyana's estimated recoverable oil resources are:", options: ["1 billion barrels", "5 billion barrels", "11+ billion barrels", "50 billion barrels"], correctIndex: 2 },
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
      content: `## Your Dashboard Overview\n\n- When you log in, the dashboard shows your **Compliance Health Score** (0-100)\n- The score is based on your **Local Content Rate** and **employment percentages**\n- A higher score means better alignment with LCA minimums\n- The dashboard refreshes automatically as you enter data\n\n## Key Dashboard Widgets\n\n- **Compliance Health Widget** — Your LC rate, employment breakdown vs LCA minimums, supplier cert expiry warnings\n- **Upcoming Deadlines** — Filing dates with countdown timers\n- **Recent Activity** — Latest actions by your team members\n- **Entity Cards** — Quick-access cards for each company you file for\n\n## Sidebar Navigation\n\n- **Compliance** — Entities, Log Payment, Reports, Calendar\n- **Workforce** — Employees, Jobs, Talent Pool\n- **Market** — Opportunities, Companies, Suppliers\n- **Resources** — Training, LCA Expert, Support, Settings\n\n## First Steps for New Users\n\n- **Step 1**: Add your first entity (the company you are filing for)\n- **Step 2**: Create a reporting period (H1 or H2)\n- **Step 3**: Start entering expenditure and employment data\n- Your **Compliance Health Score** will update as you add records`,
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
      content: `## What is an Entity?\n\n- An entity represents a **company or subsidiary** with LCA filing obligations\n- Each entity files its own **independent reports** to the Secretariat\n- You can manage **multiple entities** from a single LCA Desk account\n- Entity data pre-fills into every report you create\n\n## Creating an Entity\n\n- Go to **Entities** in the sidebar and click **Add Entity**\n- Enter the **legal name** (must match your LCS registration exactly)\n- Select **company type**: Contractor, Sub-Contractor, or Licensee\n- Add **contact information** and **LCS Certificate ID** if applicable\n\n## Starting a Report\n\n- From the entity detail page, click **Start New Report**\n- Select **report type**: H1 Half-Yearly, H2 Half-Yearly, Annual Plan, or Performance Report\n- Choose the **fiscal year** being reported on\n- Dates and deadlines **auto-fill** from the LCA filing calendar\n\n## Reporting Period Deadlines\n\n- **H1** (Jan-Jun) — due **July 30** of the same year\n- **H2** (Jul-Dec) — due **January 30** of the following year\n- When you submit one period, the **next period is auto-created**\n- Late filings are tracked and visible to the Secretariat\n\n## The 7-Step Filing Workflow\n\n- **Step 1**: Company Info (auto-filled from entity)\n- **Step 2**: Expenditure records\n- **Step 3**: Employment records\n- **Step 4**: Capacity Development records\n- **Steps 5-7**: AI Narrative drafts, Review & Compliance Check, Export & Submit`,
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
      content: `## Recording Expenditure\n\n- The expenditure sub-report tracks **all procurement spending** during the period\n- Each record requires: **type** (Goods or Services), **sector category**, and **supplier name**\n- You must also record the **LCS Certificate ID**, **payment amount**, and **payment method**\n- The **bank location** field helps the Secretariat track financial flows\n\n## Supplier Auto-Suggest\n\n- When typing a supplier name, LCA Desk searches **787+ LCS-registered companies**\n- The system **auto-fills the certificate ID** when a match is found\n- This saves time and ensures **accuracy** in your filings\n- Non-registered suppliers can be entered manually as **Non-Guyanese**\n\n## Local Content Rate\n\n- Your **LC Rate** = Guyanese supplier spend / Total spend x 100%\n- A supplier counts as **Guyanese** if they have a valid LCS Certificate ID\n- The LC Rate updates in **real-time** as you enter expenditure records\n- Higher LC rates demonstrate stronger **local content compliance**\n\n## Log Payment (Between Filings)\n\n- Use **Log Payment** in the sidebar to record payments as they happen\n- Entries show your **running LC rate** throughout the quarter\n- Logged payments can be **imported** into your formal filing period\n- This prevents last-minute data entry at filing time\n\n## CSV Import & Supplier Directory\n\n- Click **Import CSV** on the expenditure page to **bulk-upload** records from a spreadsheet\n- Browse the **Suppliers** page to find LCS-registered companies by name or category\n- The directory shows **service categories**, contact info, and certificate status\n- Use the directory to discover new **Guyanese suppliers** for your procurement needs`,
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
      content: `## Recording Employment Data\n\n- The employment sub-report tracks your **workforce by category**\n- Each record includes **job title**, **employment category**, and **ISCO-08 code**\n- You must enter **total employees** in each role and the **number of Guyanese**\n- **Remuneration data** (total and Guyanese-specific) is also required\n\n## LCA Employment Minimums\n\n- **Managerial**: 75% Guyanese — senior management, directors, department heads\n- **Technical**: 60% Guyanese — engineers, geologists, technicians\n- **Non-Technical**: 80% Guyanese — admin, clerical, support, logistics\n- The sidebar shows **pass/fail indicators** for each category in real-time\n\n## Jobs Board\n\n- Post positions through **Jobs** in the sidebar\n- Each posting **auto-generates** a Guyanese First Consideration statement (Section 12)\n- Postings link to an **entity** for employment reporting purposes\n- Applications are tracked with a **status pipeline** (Applied, Shortlisted, Hired, Rejected)\n\n## Talent Pool\n\n- Search the **Talent Pool** for Guyanese candidates who have opted in\n- Filter by **skills**, **category**, and **experience** level\n- **Contact info** for candidates requires the Pro plan\n- Candidates are tagged with their **ISCO-08 occupation** codes\n\n## Hire-to-Employee Flow\n\n- Click **Hire** on any applicant to convert them to an employee\n- Select the **entity** to assign them to\n- An **employee record** is auto-created with Guyanese status pre-filled\n- The record automatically appears in your **next employment filing**`,
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
      content: `## AI Narrative Drafting Overview\n\n- The LCA requires **written narratives** for each sub-report section\n- LCA Desk uses **Claude (Anthropic)** to generate these narratives automatically\n- Narratives are based on your **actual filing data**, not generic templates\n- All **three narratives** must be completed before submission is allowed\n\n## How to Generate Narratives\n\n- Go to the **Narrative** step in your filing workflow\n- Click **Generate** for each section: **Expenditure**, **Employment**, **Capacity Development**\n- The AI analyzes your data and writes a **compliant narrative** in LCA terminology\n- **Edit** the generated text as needed, then save\n\n## LCA Expert Chat\n\n- The **LCA Expert** in the sidebar is an AI assistant available anytime\n- It knows the **complete Local Content Act 2021** text\n- It also knows your **actual compliance data** — LC rate, employment percentages, deadlines\n- Ask questions like "Am I on track for H2?" or "Which categories am I below minimum?"\n\n## What You Can Ask the Expert\n\n- **Compliance status**: "What is my current LC rate?"\n- **Legal questions**: "What does Section 12 of the LCA require?"\n- **Deadline tracking**: "When is my next filing due?"\n- **Guidance**: "How do I improve my technical employment percentage?"\n\n## AI Compliance Scan\n\n- On the **Review** page, the AI scans your **entire filing** for issues\n- It checks for **missing data**, **below-minimum percentages**, and **invalid certificate IDs**\n- Flagged issues include **specific recommendations** for how to fix them\n- Run the scan **before exporting** to catch problems early`,
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
      content: `## Review & Validation\n\n- Before exporting, the **Review** page runs automated compliance checks\n- Checks include: are all sections **populated**? Do employment percentages **meet LCA minimums**?\n- Also validates: are supplier **certificate IDs** valid? Are **narratives** complete?\n- Each issue is flagged with a **specific recommendation** for resolution\n\n## Export Files\n\n- Two files are generated for the Secretariat submission\n- **Excel Report** — matches the official **LCS Template v4.1** format exactly\n- **PDF Narrative** — the Comparative Analysis Report with a **signature block**\n- Both files are downloadable from the Review page\n\n## Submission Workflow\n\n- **Draft** — data entry is in progress, report is fully editable\n- **In Review** — "Send for Review" marks it for **internal team review**\n- **Approved** — "Approve" confirms the report is **ready for submission**\n- **Submitted** — attest and submit, which **locks** the report permanently\n\n## Attestation\n\n- Before submitting, you must check the **attestation box**\n- You certify the information is **true, accurate, and complete**\n- False attestation carries penalties of up to **GY$50,000,000**\n- Once attested, the report **cannot be edited** or withdrawn\n\n## After Submission\n\n- Report is **locked** (read-only) with a permanent **data snapshot**\n- A **submission receipt** PDF is available for download\n- The **next reporting period** is auto-created for you\n- A **confirmation email** is sent and all changes are logged in the **audit trail**`,
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
      content: `## Compliance Reports Overview\n\n- The **Reports** page shows analytics across **all your entities**\n- View **LC Rate trends** over time and **employment by category** vs LCA minimums\n- See **top suppliers** by spend (with LCS badges) and **expenditure by sector**\n- Track **filing compliance** (on-time vs late vs overdue) at a glance\n\n## Additional Report Views\n\n- **Capacity development investment** — training spend and participant counts\n- **Hiring pipeline** — posted, applied, and hired metrics\n- **Entity compliance scorecard** — per-entity breakdown of all compliance metrics\n- All reports can be **filtered by date range** and **exported** as needed\n\n## Calendar\n\n- The **Calendar** shows all filing deadlines for every entity you manage\n- **Export to Outlook/Google Calendar** with a single ICS download\n- Deadlines include automatic **14-day and 7-day** advance reminders\n- Color-coded status: **green** (on track), **yellow** (upcoming), **red** (overdue)\n\n## Notifications\n\n- **In-app notifications** appear via the bell icon in the top bar\n- **Email notifications** are sent automatically via Resend\n- Types include: **deadline reminders** (30, 14, 7, 3, 1 days), **application status changes**\n- Also includes **report submitted** confirmations and **supplier cert expiry** warnings\n\n## Weekly Digest\n\n- Every **Monday**, a digest email summarizes your compliance status\n- Includes your **LC rate**, **employment percentages**, and **upcoming deadlines**\n- Highlights **new opportunities** matching your service categories\n- Flags **expiring supplier certs** — manage preferences in **Settings > Notifications**`,
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
      content: `## Opportunities Feed\n\n- The **Opportunities** page shows **190+ procurement notices** from the LCS Register\n- Each notice includes an **AI-generated summary** with scope, requirements, and deadlines\n- View the **original document** in an embedded PDF viewer\n- **Save/bookmark** opportunities for later (Pro plan feature)\n\n## Filtering & Sorting Opportunities\n\n- Filter by **type**, **status**, **company**, **notice type**, and **AI analyzed**\n- Sort by **newest**, **oldest**, **deadline**, or **company** name\n- Use keyword search to find opportunities matching your **service categories**\n- Saved filters persist across sessions for **quick access**\n\n## Company Directory\n\n- **700+ company profiles** auto-generated from LCS notices, jobs, and the register\n- Each profile aggregates **opportunities**, **jobs**, **contact info**, and **categories**\n- Companies can **claim their profile** to manage and update their information\n- Profiles show **LCS registration** details and verification status\n\n## Market Intelligence\n\n- Click **Market Intelligence** on the Opportunities page for analytics\n- View **top contractors** by procurement activity level\n- See **notice type distribution** (EOI, RFQ, RFP, RFI) and **monthly trends**\n- Analyze **procurement categories** to identify growing sectors\n\n## Contractor Profiles\n\n- Click any company to see all their **procurement notices** and **job postings**\n- **Contact info** is visible with the Pro plan\n- View **LCS registration details** and **service categories**\n- Track a contractor's **activity history** over time`,
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
    { title: "Your Verified Company Profile", content: "## The Verified Companies Directory\n\n- LCA Desk maintains a directory of **796+ LCS-registered companies**\n- Data is scraped from the **official LCS Register** and kept up to date\n- If your company is registered, you **already have a profile** in the directory\n- Contractors use this directory to **find and evaluate** Guyanese suppliers\n\n## Claiming Your Profile\n\n- Find your company in the **Verified Companies** section\n- Click **Claim This Business** to take ownership of your profile\n- Verify your identity via **email domain**, **LCS certificate**, or **manual review**\n- Once claimed, you can **update contact info** and showcase your capabilities\n\n## LCS Verification Badge\n\n- Companies with a valid LCS Certificate show a green **LCS Verified** badge\n- This badge tells contractors that procurement from you **counts toward their LC Rate**\n- Verified companies **rank higher** in search results on the platform\n- The badge is automatically applied when your **certificate is confirmed**\n\n## Getting Registered with the LCS\n\n- Not yet registered? Use **LCS Certificate as a Service** at /register-lcs\n- Guided registration process starting at **$49**\n- You will need your **business registration**, **TIN**, and proof of **Guyanese ownership**\n- Registration unlocks the **LCS Verified** badge and inclusion in the supplier directory\n\n## Why Your Profile Matters\n\n- Contractors are **required by law** to give first consideration to Guyanese suppliers\n- A complete, verified profile makes you **easier to find** and **more credible**\n- Profiles with **multiple service categories** attract more contractor interest\n- Your profile is your **digital storefront** in Guyana's petroleum supply chain",
      quiz: [
        { question: "How many LCS-registered companies are in the directory?", options: ["100+", "400+", "796+", "1000+"], correctIndex: 2 },
        { question: "What does 'LCS Verified' mean?", options: ["Paid for ads", "Has valid LCS Certificate", "Government-owned", "Has filed reports"], correctIndex: 1 },
        { question: "How can you claim your profile?", options: ["Pay a fee", "Email domain, LCS cert, or manual review", "Call Secretariat", "Submit a report"], correctIndex: 1 },
        { question: "The directory is sourced from:", options: ["User submissions", "Official LCS Register", "Google", "Company websites"], correctIndex: 1 },
        { question: "LCS registration starts at:", options: ["$29", "$49", "$99", "$199"], correctIndex: 1 },
      ],
    },
    { title: "Browsing & Responding to Opportunities", content: "## The Opportunity Feed\n\n- LCA Desk aggregates **190+ procurement notices** from the LCS website\n- Each notice includes an **AI-generated summary** of scope, requirements, and deadlines\n- Notices cover **EOI** (Expression of Interest), **RFQ**, **RFP**, and **RFI** types\n- New notices are added regularly as contractors post procurement requirements\n\n## Finding Opportunities\n\n- **Search** by company name or keyword to find relevant notices\n- **Filter** by notice type (EOI, RFQ, RFP, RFI) to narrow results\n- **Sort** by newest, deadline, or company to prioritize your review\n- View the **original PDF** document embedded directly in the platform\n\n## Expressing Interest\n\n- Click **Respond** on any opportunity to express your interest\n- Enter your **contact email** so the contractor can reach you\n- Add an optional **cover note** highlighting your relevant experience\n- Click **Submit** to send your response to the contractor\n\n## Free vs Supplier Pro Plans\n\n- **Free plan**: Up to **3 responses per month** with basic opportunity browsing\n- **Supplier Pro ($99/mo)**: **Unlimited responses** and priority placement\n- Pro members also get **saved searches** and **bookmark** functionality\n- Upgrade anytime from your **account settings**\n\n## Response Pipeline Tracking\n\n- Track your responses through four stages: **Interested**, **Contacted**, **Shortlisted**, **Awarded**\n- See your **response history** and current status for each opportunity\n- Monitor your **conversion rate** from response to award\n- Use pipeline data to **refine your targeting** strategy",
      quiz: [
        { question: "How many procurement notices are available?", options: ["50+", "100+", "190+", "500+"], correctIndex: 2 },
        { question: "Free plan allows how many responses/month?", options: ["1", "3", "5", "Unlimited"], correctIndex: 1 },
        { question: "Supplier Pro costs:", options: ["$49/mo", "$99/mo", "$199/mo", "$399/mo"], correctIndex: 1 },
        { question: "First pipeline status after responding:", options: ["Pending", "Interested", "Applied", "Submitted"], correctIndex: 1 },
        { question: "Response tracking requires:", options: ["Free plan", "Supplier Pro", "Enterprise", "No plan"], correctIndex: 1 },
      ],
    },
    { title: "Building Your Supplier Profile", content: "## Essential Profile Information\n\n- **Legal Name** — must match your LCS registration exactly\n- **Contact Email & Phone** — how contractors will reach you\n- **Service Categories** — select from **18+ categories** that match your capabilities\n- **Employee Count & Year Established** — shows your company's scale and track record\n\n## Guyanese Ownership & Compliance\n\n- **Guyanese ownership** information is required for LCA compliance verification\n- Contractors need to confirm your status to count you toward their **Local Content Rate**\n- Accurate ownership data ensures your **LCS Verified** badge is applied correctly\n- Update this information promptly if your ownership structure changes\n\n## Capability Statement (Pro)\n\n- Pro members can add a **detailed capability statement** visible to all contractors\n- Describe your **core services**, **equipment**, and **past project experience**\n- Highlight any **certifications**, **safety records**, or **quality standards** you hold\n- A strong capability statement significantly **increases contractor engagement**\n\n## Why Complete Profiles Win\n\n- Complete profiles with **multiple categories** and **contact info** rank higher in search\n- Adding a **capability statement** and **LCS verification** boosts your visibility further\n- Contractors are more likely to respond to profiles with **verified, detailed information**\n- Incomplete profiles may be **overlooked** even if your services match the requirement\n\n## Profile Optimization Tips\n\n- List **every service category** you can deliver — do not limit yourself to one\n- Keep your **contact information** current so contractors can reach you quickly\n- Add your **LCS Certificate ID** to activate the verification badge\n- Review and update your profile **quarterly** to reflect new capabilities",
      quiz: [
        { question: "Legal name should match:", options: ["Trading name", "LCS registration", "Email domain", "Bank account"], correctIndex: 1 },
        { question: "Service categories available:", options: ["5+", "10+", "18+", "50+"], correctIndex: 2 },
        { question: "Capability Statements require:", options: ["Free", "Supplier Pro", "Enterprise", "Manual approval"], correctIndex: 1 },
        { question: "What ranks profiles higher?", options: ["Paying more", "Complete info + LCS verification", "More employees", "Being older"], correctIndex: 1 },
        { question: "Guyanese ownership is required for:", options: ["Tax", "LCA compliance", "Banking", "Insurance"], correctIndex: 1 },
      ],
    },
    { title: "Analytics & Growth (Pro)", content: "## Profile Views Analytics\n\n- See how many **contractors viewed your profile** over any time period\n- Track **view trends** weekly and monthly to measure your visibility\n- Identify which **service categories** drive the most profile visits\n- Compare your views to **industry benchmarks** for your categories\n\n## Response Pipeline Dashboard\n\n- View all **opportunities you have responded to** in one place\n- See breakdown by status: **Interested**, **Contacted**, **Shortlisted**, **Awarded**\n- Track your **Award Rate** — the percentage of responses leading to contracts\n- Review a **monthly activity chart** showing your engagement trends over time\n\n## Priority Placement Benefits\n\n- **Supplier Pro** members appear **higher in search results** across the platform\n- Your profile is featured more prominently in **category searches** by contractors\n- Priority placement increases your **profile views** and response opportunities\n- This benefit applies to both the **supplier directory** and **opportunity responses**\n\n## Direct Contact Visibility\n\n- Pro makes your **email and phone visible** to all contractors on the platform\n- Without Pro, contractors must use the **platform messaging** system to reach you\n- Direct contact **speeds up** the procurement process significantly\n- Contractors report higher **engagement rates** with directly contactable suppliers\n\n## Growth Strategy Tips\n\n- **High views but few responses** suggests you should respond to more opportunities\n- **Low views** means your profile needs more **service categories** or better **keywords**\n- Track your **Award Rate** monthly and aim to improve it by **targeting relevant notices**\n- Use analytics to **focus your efforts** on the categories where you win most often",
      quiz: [
        { question: "Analytics is available on:", options: ["Free", "Supplier Pro", "All plans", "Enterprise only"], correctIndex: 1 },
        { question: "Award Rate measures:", options: ["Views", "Responses leading to contracts", "Revenue", "Hires"], correctIndex: 1 },
        { question: "Pro suppliers get:", options: ["Lower pricing", "Priority placement", "Government endorsement", "Free ads"], correctIndex: 1 },
        { question: "High views, few responses suggests:", options: ["Need more staff", "Should respond to more opportunities", "Bad profile", "Change industries"], correctIndex: 1 },
        { question: "Direct contact means:", options: ["Secretariat contacts you", "Contractors see your email/phone", "Auto calls", "Auto email"], correctIndex: 1 },
      ],
    },
    { title: "From Supplier to Filer", content: "## When Do Suppliers Need to File?\n\n- Most LCS-registered suppliers do **NOT** have filing obligations\n- Filing is triggered when a supplier **wins a contract** as a sub-contractor to an operator\n- Once you become a **sub-contractor**, you must file Half-Yearly Reports to the Secretariat\n- The threshold is based on your **contractual relationship**, not company size\n\n## How to Upgrade to Filer\n\n- Go to your Dashboard and click **Start Filing**\n- Your **company info** and **LCS certificate** data pre-fill from your supplier profile\n- You receive a **30-day Professional trial** to access all filing features\n- Your role becomes **supplier + filer**, giving you access to both portals\n\n## What Stays After Upgrading\n\n- Your **supplier profile** stays active and visible to contractors\n- All **opportunity responses** and response history are preserved\n- Your **analytics** and profile view data continue uninterrupted\n- You do not lose any **Pro plan benefits** if you are a Supplier Pro member\n\n## Filing Obligations as a Sub-Contractor\n\n- File **H1** (Jan-Jun) and **H2** (Jul-Dec) reports for each reporting period\n- Report your **expenditure** with Guyanese and non-Guyanese suppliers\n- Track **employment** by category with Guyanese percentages\n- Include **capacity development** activities and training investments\n\n## Benefits of the Dual Role\n\n- Access both the **supplier marketplace** and the **compliance filing** tools\n- Your supplier profile helps you **win more work** while you manage compliance\n- Filing data can **strengthen your profile** by demonstrating your operational scale\n- Maintain a **single account** for all your LCA Desk activities",
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
    { title: "Setting Up Your Entity", content: "## Your First Entity\n\n- An **entity** represents a company that files LCA reports to the Secretariat\n- After signup, your first entity is **auto-created** from your registration details\n- You can manage **multiple entities** if you file for more than one company\n- Entity data **pre-fills** into every report you create\n\n## What You Need to Set Up\n\n- **Legal name** — must match your LCS registration exactly\n- **Company type**: Contractor, Sub-Contractor, or Licensee\n- **LCS Certificate ID** in the format LCSR-XXXXXXXX\n- **Contact name and email** for the person responsible for filing\n\n## Company Types Explained\n\n- **Contractor**: Has a direct agreement with the Government (e.g., ExxonMobil)\n- **Sub-Contractor**: Has an agreement with a Contractor (e.g., Halliburton)\n- **Licensee**: Holds a petroleum exploration or production licence\n- Your company type determines your **reporting obligations** and deadlines\n\n## Starting Your First Report\n\n- From your entity page, click **Start New Report**\n- Select **H1** (Jan-Jun) or **H2** (Jul-Dec) as the reporting period\n- **Dates and deadlines** auto-fill from the Secretariat schedule\n- The report wizard guides you through each step in sequence\n\n## Key Deadlines to Know\n\n- **H1 reports** are due by **July 30** of the same year\n- **H2 reports** are due by **January 30** of the following year\n- Late submissions are flagged and may result in **compliance penalties**\n- The platform sends **automated reminders** at 30, 14, 7, 3, and 1 days before due",
      quiz: [
        { question: "What format is the LCS Certificate ID?", options: ["LCS-001", "LCSR-XXXXXXXX", "GY-CERT-001", "LC-2021"], correctIndex: 1 },
        { question: "An entity represents:", options: ["A user account", "A company with filing obligations", "A report", "A billing account"], correctIndex: 1 },
        { question: "H1 covers which months?", options: ["Jan-Mar", "Jan-Jun", "Jul-Dec", "Full year"], correctIndex: 1 },
        { question: "Company type 'Sub-Contractor' means:", options: ["Works for the government directly", "Has agreement with a Contractor", "Is a Guyanese company", "Has no filing obligation"], correctIndex: 1 },
        { question: "After starting a report, deadlines:", options: ["Must be entered manually", "Auto-fill from the Secretariat schedule", "Don't exist", "Are sent by email"], correctIndex: 1 },
      ],
    },
    { title: "Entering Expenditure Data", content: "## The Expenditure Sub-Report\n\n- This section records **every payment** made during the reporting period\n- It is the primary data source for calculating your **Local Content Rate**\n- Each record maps to a **sector category** from the LCA First Schedule\n- The Secretariat uses this data to measure **first consideration** compliance\n\n## Required Fields for Each Payment\n\n- **Type of item**: Goods or Services\n- **Related sector**: Selected from the LCA First Schedule (40+ categories)\n- **Supplier name**: Auto-suggest from **796+ LCS-registered** companies\n- **Supplier type**: Guyanese or Non-Guyanese\n- **Certificate ID**, **payment amount**, **currency**, and **payment method**\n\n## Speed Tips for Data Entry\n\n- **Click cells to edit inline** — no modal needed for quick fixes\n- **Paste from Excel** — copy rows from a spreadsheet directly into the table\n- **Save & Add Another** — batch entry without closing the form\n- **Import Excel** — upload the official Secretariat template directly\n\n## Understanding Your Local Content Rate\n\n- **LC Rate** = Guyanese supplier spend / Total spend x 100%\n- The sidebar shows your LC Rate in **real-time** as you enter data\n- Only suppliers with a valid **LCS Certificate** count as Guyanese\n- Aim for the **highest LC Rate possible** to demonstrate strong compliance\n\n## Common Expenditure Mistakes to Avoid\n\n- Do not leave the **sector category** as "Other" if a specific category applies\n- Ensure supplier names **match the LCS Register** exactly for auto-fill to work\n- Record **all payments** — even small ones contribute to your LC Rate\n- Double-check **currency** fields — mixing USD and GYD will skew your totals",
      quiz: [
        { question: "How many LCS-registered suppliers are in the auto-suggest?", options: ["100+", "400+", "796+", "1000+"], correctIndex: 2 },
        { question: "LC Rate formula:", options: ["Employees ÷ Total × 100", "Guyanese spend ÷ Total spend × 100", "Reports filed ÷ Due × 100", "Suppliers ÷ Total × 100"], correctIndex: 1 },
        { question: "To bulk-add records from a spreadsheet:", options: ["Email them to support", "Copy rows and paste into the table", "Use the Log Payment feature", "Print and scan them"], correctIndex: 1 },
        { question: "A supplier counts as Guyanese if:", options: ["They have a Guyana address", "They have an LCS Certificate or are marked as Guyanese", "They employ Guyanese people", "They were founded in Guyana"], correctIndex: 1 },
        { question: "The Related Sector dropdown contains:", options: ["5 options", "20 options", "40+ options from the First Schedule", "Unlimited custom entries"], correctIndex: 2 },
      ],
    },
    { title: "Employment & Capacity Data", content: "## Employment Sub-Report Overview\n\n- Record **every position** in your workforce during the reporting period\n- Each record must include the **job title** and **ISCO-08 classification** code\n- Select the **employment category**: Managerial, Technical, or Non-Technical\n- Enter **total employees** in the role and the **number of Guyanese** employed\n\n## Remuneration Data\n\n- For each position, report **total remuneration** paid during the period\n- Also report the **Guyanese-specific remuneration** separately\n- Remuneration means **total compensation** including salary, bonuses, and overtime\n- The Secretariat uses this to verify **equal pay** compliance under Section 18\n\n## LCA Employment Minimums\n\n- **Managerial**: At least **75%** of positions must be held by Guyanese nationals\n- **Technical**: At least **60%** must be Guyanese (lowest minimum due to specialization)\n- **Non-Technical**: At least **80%** must be Guyanese (highest minimum)\n- The sidebar shows **pass/fail indicators** for each category as you enter data\n\n## Capacity Development Sub-Report\n\n- Record **all training activities** conducted during the reporting period\n- Include **activity name**, **category**, and **participant type** (Guyanese Internal, External, Mixed)\n- Enter **number of participants** (Guyanese and total), **duration in days**, and **cost**\n- This section demonstrates your investment in **building local skills**\n\n## Why This Data Matters\n\n- The Secretariat **cross-references** employment data with expenditure records\n- This verification ensures **first consideration** compliance under Section 12\n- Capacity development data shows your commitment to **long-term local workforce growth**\n- Incomplete or inconsistent data may trigger an **audit** by the Secretariat",
      quiz: [
        { question: "Minimum Guyanese % for Technical roles:", options: ["50%", "60%", "75%", "80%"], correctIndex: 1 },
        { question: "ISCO-08 is:", options: ["A safety standard", "An occupation classification system", "A tax code", "A company registration"], correctIndex: 1 },
        { question: "Capacity Development includes:", options: ["Only classroom training", "All training, scholarships, and mentoring", "Only safety courses", "Only Guyanese participants"], correctIndex: 1 },
        { question: "Remuneration means:", options: ["Only base salary", "Total compensation including bonuses and overtime", "Only Guyanese pay", "Equipment costs"], correctIndex: 1 },
        { question: "The Secretariat cross-references employment with:", options: ["Tax records", "Expenditure data", "Bank statements", "Immigration records"], correctIndex: 1 },
      ],
    },
    { title: "Review, Export & Submit", content: "## AI Narrative Drafting\n\n- Click **Generate** for each of the three narrative sections\n- The AI writes your **Comparative Analysis Report** using your actual data\n- Narratives use proper **LCA terminology** and reference your specific numbers\n- **Edit as needed**, then save — all three must be completed before submission\n\n## Review & Compliance Check\n\n- The Review page runs **automated validation** on your entire filing\n- Checks whether all sections are **populated** with required data\n- Verifies that employment percentages **meet LCA minimums** for each category\n- Confirms that **certificate IDs** are valid and **narratives** are complete\n\n## Export Three Files\n\n- **Excel Report** — formatted to the Secretariat's **Version 4.1 template**\n- **Narrative PDF** — your Comparative Analysis Report with **signature block**\n- **Notice of Submission** — the required **cover letter** for the Secretariat\n- All three files are generated from your data and downloadable in one click\n\n## Submit & Attest\n\n- Choose **platform submission** (instant) or **email submission**\n- Check the **attestation box** confirming the information is true and accurate\n- Attestation references penalties of up to **GY$50,000,000** for false information\n- Once attested, the report is **locked permanently** and cannot be edited\n\n## After Submission\n\n- Report becomes **read-only** with a permanent **data snapshot** saved\n- A **receipt PDF** is available for download as proof of submission\n- The **next reporting period** (H2 or H1) is auto-created for you\n- A **confirmation email** is sent to all contacts on the entity",
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
    { title: "What is the First Schedule?", content: "## What the First Schedule Is\n\n- The **First Schedule** of the Local Content Act lists all **sector categories** where minimum local content levels apply\n- It contains **40+ reserved categories** covering goods and services in the petroleum sector\n- Every expenditure in your Half-Yearly Report must be classified into one of these sectors\n- The **Secretariat** uses these classifications to measure whether contractors give **first consideration** to Guyanese suppliers\n\n## Services and Logistics Categories\n\n- **Rental of Office Space** — leased offices and co-working facilities\n- **Accommodation Services** — housing and lodging for petroleum workers\n- **Equipment Rental** — machinery, tools, and specialised equipment hire\n- **Transportation** — Trucking, Ground, and Marine logistics\n- **Catering and Food Services** — meal provision for onshore and offshore crews\n\n## Construction, Engineering and Environmental\n\n- **Construction Work (Onshore)** — civil works, site preparation, and building\n- **Structural Fabrication** — welding, pipe fitting, and metal works\n- **Surveying** — land, marine, and geotechnical surveys\n- **Waste Management** — Hazardous and Non-Hazardous disposal and treatment\n- **Environmental Services** — EIAs, remediation, and monitoring\n\n## Support Services and ICT\n\n- **Security Services** — guarding, access control, and surveillance\n- **ICT and Network Services** — telecoms, network installation, and IT support\n- **Storage Services (Warehousing)** — inventory management and laydown yards\n- **Admin Support and Facilities Management** — office operations and maintenance\n- Plus **25+ additional categories** spanning the full petroleum value chain\n\n## The 'Other' Category\n\n- Use **'Other'** only when no specific First Schedule category fits your procurement\n- The Secretariat may **request justification** for why a listed category was not used\n- Over-reliance on 'Other' is a **common audit flag** and can trigger amendment requests\n- When in doubt, consult the **LCA Expert AI** to find the correct sector match",
      quiz: [
        { question: "The First Schedule lists:", options: ["Employment rules", "40+ reserved sector categories", "Penalty amounts", "Filing deadlines"], correctIndex: 1 },
        { question: "Every expenditure must be classified into:", options: ["Any category you choose", "A First Schedule sector category", "The cheapest category", "Multiple categories"], correctIndex: 1 },
        { question: "The 'Other' category should be used:", options: ["For all international suppliers", "When no specific category fits", "For the largest payments", "Never"], correctIndex: 1 },
        { question: "Storage Services falls under:", options: ["Transportation", "Warehousing (its own category)", "Equipment Rental", "Admin Support"], correctIndex: 1 },
        { question: "The Secretariat uses sector classification to:", options: ["Calculate taxes", "Measure first consideration compliance", "Set prices", "Hire staff"], correctIndex: 1 },
      ],
    },
    { title: "High-Impact Sectors", content: "## Catering and Transportation\n\n- **Catering and Food Services** is one of the highest-adoption sectors in the petroleum industry\n- Most contractors use **Guyanese catering companies** for onshore and some offshore operations\n- **Ground transportation**, trucking, and marine logistics have strong Guyanese participation\n- Companies like **G-Boats Inc.** and local trucking firms dominate the transportation sector\n\n## Engineering and Fabrication\n\n- **Structural fabrication** is increasingly localized with growing Guyanese capacity\n- Companies like **Raghunath Engineering Solutions** and **ProTech Engineering** lead the sector\n- **Pipe welding**, CNC machining, and mechanical repairs are in high demand\n- Engineering firms mapping services to **First Schedule categories** win more contracts\n\n## Environmental and Security Services\n\n- **Environmental Impact Assessments**, waste management, and remediation are required for all petroleum activities\n- Several **Guyanese firms** now provide full environmental service packages\n- **Security services** for onshore facilities are **nearly 100% localized**\n- **ICT and Network Services** including telecoms and IT support are growing rapidly\n\n## Sectors Dominated by International Firms\n\n- **Drilling and Well Services** — highly specialised equipment and expertise required\n- **Subsea Services** — requires deep-water vessels and equipment\n- **ROV Services** — remote operated vehicles need specialised operators\n- **FPSO Operations** — floating production, storage, and offloading vessels\n- These sectors present **future opportunities** as Guyanese capacity develops\n\n## Key Takeaways for Suppliers\n\n- Focus on **high-adoption sectors** where Guyanese firms already have a track record\n- Build capability in **growing sectors** like engineering and environmental services\n- Even in international-dominated sectors, **support services** can be localized\n- Your **LCS Certificate** is essential to count as local content in any sector",
      quiz: [
        { question: "Which sector has the highest local adoption?", options: ["Drilling", "Catering and Food Services", "Subsea Services", "ROV Services"], correctIndex: 1 },
        { question: "Security services are approximately:", options: ["10% local", "50% local", "Nearly 100% local", "0% local"], correctIndex: 2 },
        { question: "Drilling services are dominated by:", options: ["Guyanese firms", "International firms", "Government agencies", "No one"], correctIndex: 1 },
        { question: "Environmental services are:", options: ["Optional", "Required for all petroleum activities", "Only for onshore", "Only for international firms"], correctIndex: 1 },
        { question: "Structural fabrication is:", options: ["Declining locally", "Increasingly localized", "Banned for local firms", "Only done offshore"], correctIndex: 1 },
      ],
    },
    { title: "Classifying Your Expenditure", content: "## Read the Sector Description\n\n- Each First Schedule sector has a **specific definition** — read it carefully before classifying\n- **'Storage Services (Warehousing)'** is different from **'Laydown Yard Facilities'**\n- Similar-sounding categories have distinct scopes — do not guess\n- The full list of definitions is available in the **LCA First Schedule** document\n\n## Match the Primary Activity\n\n- Classify by the **primary service provided**, not the supplier's general business type\n- A logistics company providing trucking goes under **'Transportation Services: Trucking'**, not 'Cargo Management'\n- Ask yourself: **'What am I paying for?'** — the answer points to the correct sector\n- When a supplier provides multiple services, classify each **payment separately** by activity\n\n## Common Classification Mistakes\n\n- Classifying all **SLB payments** as 'Engineering' when some are 'Borehole Testing'\n- Using **'Other'** when 'Admin Support & Facilities Management' fits\n- Mixing up **'Construction Work (Onshore)'** with 'Structural Fabrication'\n- Classifying meals as **'Food Supply'** when the correct category is 'Catering Services'\n\n## Using the LCA Expert AI\n\n- Ask the AI: **'Which sector category should I use for [description]?'**\n- It knows all **40+ categories** and their official definitions\n- The AI can distinguish between similar categories and explain the difference\n- Use it as a **first check** before finalising your classification\n\n## Best Practices for Accurate Filing\n\n- Keep a **classification reference sheet** for your most common suppliers\n- Review previous period classifications for **consistency**\n- Flag any new procurement types for **team review** before filing\n- Run the **AI Compliance Scan** on the Review page to catch misclassifications",
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
    { title: "What the Secretariat Reviews", content: "## What Gets Reviewed\n\n- When you submit a **Half-Yearly Report**, the Secretariat conducts a structured review\n- They evaluate your submission across **four key dimensions**: completeness, accuracy, compliance, and consistency\n- Issues in any area can trigger an **amendment request**, delaying acceptance\n- Understanding the review criteria helps you **self-audit** before filing\n\n## Completeness Check\n\n- All **three sub-reports** must be present: Expenditure, Employment, and Capacity Development\n- Every column must be **filled for every record** — no blank fields\n- **Narratives** must be included for each section explaining your local content approach\n- The **Notice of Submission** must be attached with correct period and company details\n\n## Accuracy Check\n\n- **Expenditure amounts** must match bank records and financial statements\n- All Guyanese supplier **Certificate IDs** (LCSR-) must be valid and current\n- **Employment headcounts** must match actual payroll records\n- **ISCO-08 classifications** must correctly reflect each position\n\n## Compliance Check\n\n- **Local Content Rate** is compared against sector benchmarks\n- **Employment percentages** are measured against LCA minimums: 75% Managerial, 60% Technical, 80% Non-Technical\n- **First consideration evidence** must appear in your narratives with specific examples\n- **Sole source justifications** are required for any non-Guyanese procurement\n\n## Consistency Check\n\n- Numbers must **match between sub-reports** — employment totals should align across sections\n- Narratives must **reference actual data** from your report, not generic statements\n- **Period dates** must be correct (H1: Jan-Jun, H2: Jul-Dec)\n- **Company type** must be consistent with your LCS registration status",
      quiz: [
        { question: "The Secretariat reviews how many aspects?", options: ["2", "3", "4", "5"], correctIndex: 2 },
        { question: "ISCO-08 classifications are checked for:", options: ["Completeness only", "Accuracy", "Whether they exist", "Formatting"], correctIndex: 1 },
        { question: "First consideration evidence is found in:", options: ["The Excel report", "The narratives", "The Notice of Submission", "Separate documentation"], correctIndex: 1 },
        { question: "Consistency means:", options: ["All numbers are high", "Numbers match between sub-reports", "Everything is formatted correctly", "All suppliers are Guyanese"], correctIndex: 1 },
        { question: "Employment percentages are checked against:", options: ["Industry averages", "LCA minimums (75/60/80)", "Previous reports", "International standards"], correctIndex: 1 },
      ],
    },
    { title: "Common Rejection Reasons", content: "## Supplier Data Issues\n\n- **Missing Supplier Certificate IDs** — Guyanese suppliers without valid LCSR- numbers cannot be verified as local content\n- **Expired LCS Certificates** — Certificate IDs that expired during the reporting period do not count\n- **Misclassified Sectors** — using 'Other' when a specific First Schedule category applies triggers review\n- These are the **most common** amendment request triggers across all submissions\n\n## Employment and Headcount Issues\n\n- **Employment below minimums** — Managerial <75%, Technical <60%, or Non-Technical <80% without justification\n- **Inconsistent headcounts** — Employment sub-report says 50 employees but narrative mentions 75\n- **Missing remuneration data** — V4 requires remuneration breakdown for all positions (total and Guyanese-only)\n- Always cross-check employment figures **between your sub-report and narrative** before filing\n\n## Narrative and Justification Gaps\n\n- **Vague narratives** — saying 'We gave first consideration to local suppliers' without specific examples, numbers, or sector references\n- **No Sole Source Justification** — non-Guyanese procurement without a Sole Source Code or explanation\n- Narratives must reference **actual data** from your report to demonstrate compliance\n- Include **specific supplier names**, contract values, and sector categories in your explanations\n\n## Capacity Development and Filing\n\n- **Missing Capacity Development records** — no training data for a company with 100+ employees raises flags\n- **Late filing** — H1 due July 30, H2 due January 30; late submissions trigger penalties\n- Even small companies should document **any training activities** including on-the-job training\n- Set calendar reminders **at least 30 days before** each filing deadline\n\n## How to Avoid Amendment Requests\n\n- Run the **AI Compliance Scan** on the Review page before submitting\n- Verify every Guyanese supplier has a **valid, non-expired** LCSR- Certificate ID\n- Ensure employment percentages **meet or exceed** LCA minimums, or include written justification\n- Cross-reference all numbers **between sub-reports and narratives** for consistency",
      quiz: [
        { question: "The #1 rejection trigger is:", options: ["Late filing", "Missing Supplier Certificate IDs", "Low LC rate", "Bad formatting"], correctIndex: 1 },
        { question: "If Technical employment is 55%, you need:", options: ["Nothing", "Justification for being below 60% minimum", "To fire non-Guyanese staff", "To stop filing"], correctIndex: 1 },
        { question: "An expired LCS Certificate:", options: ["Still counts as Guyanese", "Does NOT count for that period", "Never expires", "Can be renewed retroactively"], correctIndex: 1 },
        { question: "Capacity Development records are expected when:", options: ["Always", "Only for large companies", "Company has significant workforce", "Never"], correctIndex: 2 },
        { question: "V4 requires remuneration data that is:", options: ["Optional", "Total and Guyanese-only breakdown", "Only for managers", "Only in GYD"], correctIndex: 1 },
      ],
    },
    { title: "Self-Audit Checklist", content: "## Expenditure Checklist\n\n- Every Guyanese supplier has a **valid LCSR- Certificate ID** that has not expired\n- **Supplier Type** (Guyanese/Non-Guyanese) is set for all records\n- Non-Guyanese suppliers without a **Sole Source Code** have written justification\n- **Sector categories** match actual procurement — avoid defaulting to 'Other'\n- Payment amounts match actual **bank records** and financial statements\n\n## Employment Checklist\n\n- All three categories represented: **Managerial, Technical, Non-Technical**\n- Guyanese percentages **meet or exceed** minimums (75/60/80)\n- **ISCO-08 classifications** assigned to every position\n- **Remuneration data** filled for all positions with total and Guyanese-only breakdown\n- Headcounts match **actual payroll** records exactly\n\n## Capacity Development Checklist\n\n- All **training activities** recorded including on-the-job training\n- Participant types **correctly categorized** (Guyanese vs non-Guyanese)\n- **Guyanese participant counts** verified and accurate\n- **Training expenditure** documented with amounts and descriptions\n- Even informal training should be captured if it develops **local capacity**\n\n## Narratives Checklist\n\n- All **three narrative sections** drafted: Expenditure, Employment, Capacity Development\n- **Specific examples** and actual numbers referenced from your data\n- **First consideration** explained concretely with supplier names and contract details\n- All **sole source situations** justified with clear reasoning\n\n## Export and Final Review\n\n- All **three files generated**: Excel report, Narrative PDF, and Notice of Submission\n- **Notice of Submission** has correct reporting period and company name\n- Run the **AI Compliance Scan** on the Review page to catch remaining issues\n- Fix **all flagged items** before clicking 'Attest & Submit'",
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
    { title: "Understanding the Procurement Cycle", content: "## The Five-Stage Procurement Process\n\n- Petroleum operators follow a **structured procurement process** with five key stages\n- Understanding each stage helps you **prepare the right documents** at the right time\n- The process can take **weeks to months** from initial notice to contract award\n- **First consideration** for Guyanese companies applies at the evaluation stage\n\n## EOI and RFQ Stages\n\n- **Expression of Interest (EOI)** — the contractor announces a need; you provide basic capability info as your first impression\n- **Request for Qualification (RFQ)** — contractor shortlists companies and requests detailed qualifications\n- RFQ evaluates **safety records**, relevant experience, certifications, and financial capacity\n- Strong EOI responses increase your chances of being **shortlisted** for the RFQ round\n\n## RFP and Evaluation Stages\n\n- **Request for Proposal (RFP)** — you submit a formal technical proposal and commercial offer\n- **Price matters**, but so does demonstrated capability and local content contribution\n- Contractors evaluate proposals on **technical merit, price, HSE record**, and LC contribution\n- Under the LCA, **first consideration** must go to qualified Guyanese companies\n\n## Contract Execution\n\n- After award, the process moves to **negotiation and contract signing**\n- **Mobilization** follows — deploying personnel, equipment, and materials to site\n- Ensure your **LCS Certificate** is valid before contract start date\n- Maintain **insurance coverage** and safety certifications throughout the contract period\n\n## Where to Find Opportunities\n\n- **LCA Desk Opportunities feed** — 190+ procurement notices from active contractors\n- **LCS website** (lcsguyana.com) — official government procurement listings\n- **Direct contractor portals** — ExxonMobil, SLB, and other operator websites\n- **Industry networking events** — conferences, trade shows, and supplier forums in Georgetown",
      quiz: [
        { question: "The first step in procurement is usually:", options: ["RFP", "Contract signing", "Expression of Interest (EOI)", "Invoice"], correctIndex: 2 },
        { question: "RFQ stands for:", options: ["Request for Quality", "Request for Qualification", "Report for Quarterly", "Required for Quotation"], correctIndex: 1 },
        { question: "First consideration in evaluation goes to:", options: ["The cheapest bid", "International firms", "Guyanese companies", "The largest company"], correctIndex: 2 },
        { question: "LCA Desk has how many procurement notices?", options: ["50+", "100+", "190+", "500+"], correctIndex: 2 },
        { question: "The procurement cycle ends with:", options: ["EOI submission", "Contract execution", "RFP submission", "Evaluation"], correctIndex: 1 },
      ],
    },
    { title: "Writing a Capability Statement", content: "## Why Capability Statements Matter\n\n- Your capability statement is the **single most important document** for winning petroleum work\n- It tells contractors **what you can do**, who you are, and why you are qualified\n- Contractors use it to **shortlist suppliers** before issuing formal RFPs\n- A weak or outdated statement means you get **passed over** even if you can do the work\n\n## Company Overview and Services\n\n- **Company Overview** (1 paragraph) — who you are, when established, employee count, Guyanese ownership %\n- **Services Offered** — specific services mapped to **LCA First Schedule categories**\n- Be precise: \"**Structural fabrication, pipe welding, and CNC machining**\" wins over vague \"Engineering services\"\n- Map every service to its **exact First Schedule category** so contractors see an immediate compliance fit\n\n## Projects, Certifications and Equipment\n\n- **Key Projects** (3-5 examples) — include project name, client, scope, value, and duration\n- **Certifications** — LCS Certificate ID, ISO certifications, safety certs (BOSIET, H2S), and insurance coverage\n- **Equipment and Capacity** — major equipment owned, workshop/yard facilities, vehicle fleet\n- **Contact Information** — key personnel names, email, phone, and physical address\n\n## Common Mistakes to Avoid\n\n- Being **too vague** — \"We do everything\" tells the contractor nothing useful\n- **No specific project examples** — contractors need proof you have done similar work\n- **Missing LCS Certificate** — without it, you do not count as a Guyanese supplier\n- **Poor formatting** or spelling errors — signals lack of professionalism\n- **Not updated** for 2+ years — outdated info erodes contractor confidence\n\n## Keeping Your Statement Current\n\n- Review and update your capability statement **at least annually**\n- Add **new projects** and certifications as soon as they are completed\n- Remove **expired certifications** and replace with current ones\n- Tailor versions for **different sectors** if you serve multiple First Schedule categories",
      quiz: [
        { question: "A capability statement should include:", options: ["Only pricing", "Company overview, services, projects, certifications", "Just a logo", "Employee salaries"], correctIndex: 1 },
        { question: "'Engineering services' is:", options: ["A strong service description", "Too vague — be specific", "Perfect for all bids", "What the Secretariat recommends"], correctIndex: 1 },
        { question: "Key projects should show:", options: ["Revenue only", "Client, scope, value, and duration", "Employee names", "Profit margins"], correctIndex: 1 },
        { question: "Updating your capability statement should happen:", options: ["Never", "Every 5 years", "At least annually", "Only when bidding"], correctIndex: 2 },
        { question: "The LCS Certificate should be:", options: ["Hidden", "Prominently displayed", "Only mentioned if asked", "Excluded from bids"], correctIndex: 1 },
      ],
    },
    { title: "Responding to Opportunities on LCA Desk", content: "## Browsing and Filtering Opportunities\n\n- Filter opportunities by **notice type** (EOI, RFQ, RFP, RFI) to find the right stage\n- Narrow results by **sector category** and **company** to match your capabilities\n- **Save interesting notices** for later review before deciding to respond\n- New opportunities are added regularly — check the feed **at least weekly**\n\n## Expressing Interest\n\n- Click **Respond** on any opportunity to express interest\n- Add your **contact email** and a concise **cover note**\n- Lead with your **most relevant experience** for the specific service requested\n- Mention your **LCS Certificate ID** and keep it under **200 words**\n- End with a call to action: \"We welcome the opportunity to discuss...\"\n\n## Tracking Your Pipeline\n\n- **Supplier Pro** ($99/mo) unlocks full response tracking and analytics\n- Track each opportunity through stages: **Interested, Contacted, Shortlisted, Awarded**\n- View **award rate** and **profile views** analytics to measure your success\n- Get **priority placement** in the supplier directory for increased visibility\n\n## Following Up and Response Limits\n\n- If contacted by a contractor, **respond within 24 hours**\n- Have your **capability statement** prepared and ready to send in advance\n- **Free plan** allows 3 responses per month\n- **Supplier Pro** provides unlimited responses and enhanced tracking",
      quiz: [
        { question: "Free plan allows how many responses?", options: ["1/month", "3/month", "5/month", "Unlimited"], correctIndex: 1 },
        { question: "A cover note should be:", options: ["500+ words", "Under 200 words with relevant experience", "A full proposal", "Just your name"], correctIndex: 1 },
        { question: "Response tracking requires:", options: ["Free plan", "Supplier Pro", "Enterprise", "Government approval"], correctIndex: 1 },
        { question: "When contacted by a contractor, respond within:", options: ["1 week", "24 hours", "1 month", "No rush"], correctIndex: 1 },
        { question: "Your cover note should reference:", options: ["Your competitor's weaknesses", "The specific service requested", "Your personal opinions", "Political connections"], correctIndex: 1 },
      ],
    },
    { title: "Positioning for First Consideration", content: "## What First Consideration Means\n\n- Under the LCA, **Guyanese companies must be evaluated BEFORE** international companies\n- If a Guyanese company can meet the requirements, they **should be selected**\n- Contractors must **document why** they chose a non-Guyanese supplier over a local alternative\n- This legal requirement gives you a **structural advantage** — but you must be prepared to use it\n\n## Get LCS Certified and Stay Current\n\n- Without a valid **LCS Certificate**, you do not count as Guyanese in the contractor's LC rate\n- **Renew before expiry** — an expired certificate makes you invisible to the compliance system\n- Map your capabilities to specific **First Schedule categories** that contractors use for classification\n- Contractors classify every purchase — if your services **match a category**, you are a natural fit\n\n## Build Visibility and Relationships\n\n- **Attend industry events**, register on contractor portals, and respond to EOIs even if you do not win\n- Visibility and name recognition matter when **shortlisting decisions** are made\n- Respond to opportunities **consistently** to build a track record with procurement teams\n- Follow up on every contact — relationships built today lead to **contracts tomorrow**\n\n## Demonstrate Capacity at Scale\n\n- Contractors worry about local firms' ability to **deliver at scale** and on schedule\n- Show evidence of capability: **equipment, workforce size, past project values**\n- Highlight **safety records** and certifications that meet international standards\n- Reference **specific completed projects** with measurable outcomes\n\n## Partner Through Joint Ventures\n\n- If a contract is too large for one firm, consider **joint ventures** with other Guyanese companies\n- A consortium of 3 local companies **beats one international firm** in LC rate calculations\n- Partnering lets you **bid on larger contracts** while building experience for future solo bids\n- Formalise JV agreements early and present a **unified capability statement** to contractors",
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
    { title: "Why LCS Certification Matters", content: "## The Business Case for LCS Certification\n\n- An **LCS Certificate** is your ticket to Guyana's petroleum supply chain\n- It proves you are a **registered Guyanese company** eligible for first consideration\n- Contractors can only count payments to you as **local content** if you hold a valid certificate\n- Without one, you are treated the **same as an international company** in LC rate calculations\n\n## What LCS Certification Does\n\n- Gets you listed in the **official LCS Register** (796+ companies and growing)\n- Shows up as **'LCS Verified'** on LCA Desk with a green badge\n- Enables contractors to **verify your status** instantly during procurement\n- Provides your unique **LCSR-XXXXXXXX** Certificate ID (8 hexadecimal characters)\n\n## Who Needs LCS Certification\n\n- Any **Guyanese-owned company** wanting to supply goods or services to the petroleum sector\n- **Individuals** seeking employment who want to prove Guyanese status to employers\n- Companies that want to appear in the **verified supplier directory** on LCA Desk\n- **Joint venture partners** who need to demonstrate local ownership credentials\n\n## Certificate Expiration Rules\n\n- Every LCS Certificate has an **expiration date** — it is not permanent\n- If yours expires, contractors **can no longer count** procurement from you as local content\n- You effectively become **invisible** to the compliance system until renewed\n- Set up **expiry alerts** to ensure you never lose coverage during an active contract\n\n## The Cost of Not Being Certified\n\n- A Guyanese company without LCS certification **loses its competitive advantage** entirely\n- Contractors cannot give you **first consideration** without a verifiable certificate\n- Your procurement **will not count** toward the contractor's local content rate\n- Certification is **quick and affordable** — there is no reason to operate without one",
      quiz: [
        { question: "LCS Certificate format:", options: ["LCS-001", "LCSR-XXXXXXXX", "GY-CERT-001", "LC-2021-001"], correctIndex: 1 },
        { question: "Without LCS certification, a Guyanese company:", options: ["Can still count as local content", "Is treated the same as an international company", "Cannot operate in Guyana", "Must pay a fine"], correctIndex: 1 },
        { question: "The LCS Register contains:", options: ["100+", "400+", "796+", "1000+"], correctIndex: 2 },
        { question: "If your certificate expires:", options: ["Nothing changes", "Contractors can't count your procurement as local", "You're automatically renewed", "You must close your business"], correctIndex: 1 },
        { question: "LCS Verified on LCA Desk shows as:", options: ["A red badge", "A green badge", "A yellow badge", "No badge"], correctIndex: 1 },
      ],
    },
    { title: "Registration Requirements", content: "## Business Registration Documents\n\n- **Business Registration Certificate** — must match the name on your LCS application exactly\n- **TIN Certificate** (Tax Identification Number) — must be current and not expired\n- **Director/Owner National ID** — clear scan required; expired IDs will be rejected\n- **Proof of Business Address** — utility bill or bank statement showing your registered address\n- **Company Profile / Portfolio** describing your services and experience\n\n## Recommended Business Documents\n\n- **NIB Certificate of Good Standing** — demonstrates compliance with National Insurance\n- **GRA Tax Clearance** — shows good standing with the Guyana Revenue Authority\n- These are not mandatory but **strengthen your application** significantly\n- Having both signals to the Secretariat that your business is **fully compliant**\n\n## Individual Registration Documents\n\n- **National ID or Passport** — proof of Guyanese nationality\n- **TIN Certificate** — required for all individual applicants\n- **Proof of Address** — utility bill or bank statement\n- **CV / Resume** — highlighting relevant experience and qualifications\n- **Professional Certifications** — BOSIET, H2S, NEBOSH, or other industry credentials\n\n## Guyanese Ownership Requirement\n\n- To qualify as a **'Guyanese company'**, the business must be **majority-owned (51%+)** by Guyanese nationals\n- The Secretariat may **verify ownership structure** through company registration records\n- **Joint ventures** must demonstrate that the Guyanese partner holds the majority stake\n- Ownership changes must be **reported and updated** to maintain certification validity\n\n## Common Application Errors\n\n- **Expired TIN certificate** — the single most common reason for application rejection\n- Business registration name **not matching** the name on the LCS application\n- **Missing proof of address** — a utility bill or bank statement is required\n- National ID **expired or unclear scan** — ensure a high-quality, legible copy\n- **No service categories selected** — you must choose at least one First Schedule category",
      quiz: [
        { question: "Minimum Guyanese ownership for certification:", options: ["25%", "50%", "51%+", "100%"], correctIndex: 2 },
        { question: "TIN stands for:", options: ["Total Income Number", "Tax Identification Number", "Trade Information Notice", "Territorial ID Number"], correctIndex: 1 },
        { question: "Proof of address can be:", options: ["A verbal statement", "Utility bill or bank statement", "A text message", "Social media profile"], correctIndex: 1 },
        { question: "Most common application error:", options: ["Wrong font size", "Expired TIN certificate", "Too many pages", "Wrong email address"], correctIndex: 1 },
        { question: "Business name on application must match:", options: ["Your trading name", "Business Registration Certificate", "Your personal name", "Your bank account name"], correctIndex: 1 },
      ],
    },
    { title: "Applying Through LCA Desk", content: "## Service Tiers Overview\n\n- LCA Desk offers **guided LCS registration** at three pricing tiers\n- **Self-Service ($49)** — step-by-step application wizard, document checklist, and auto-filled forms\n- **Managed ($99)** — most popular; adds document review, error checking, and resubmission handling\n- **Concierge ($199)** — adds dedicated support agent, expedited processing, and 1-year renewal management\n\n## The 8-Step Application Process\n\n- Go to **/register-lcs** on LCA Desk and choose **Individual or Business**\n- Select your **service tier** based on how much support you need\n- Fill in your **company or personal details** accurately\n- **Upload required documents** — the platform shows exactly which ones you need\n- **Pay and submit** — LCA Desk reviews your package before forwarding to the Secretariat\n\n## What Happens After You Submit\n\n- LCA Desk **reviews your documents** for errors and completeness (Managed and Concierge tiers)\n- If issues are found, the team handles **resubmission** on your behalf\n- Your application is submitted to the **Secretariat** for official processing\n- Once approved, you receive your **LCSR- Certificate ID** via email\n\n## Benefits After Certification\n\n- Your profile appears in the **Verified Companies directory** on LCA Desk\n- **Contractors can find you** by service category when sourcing Guyanese suppliers\n- You become visible to **all filers** on the platform who need local suppliers\n- Set up **expiry alerts** so you never lose coverage during an active contract\n\n## Choosing the Right Tier\n\n- Choose **Self-Service** if you are confident preparing documents independently\n- Choose **Managed** if you want a professional review to **avoid rejection**\n- Choose **Concierge** if you need **hands-on support** and automatic renewal tracking\n- All tiers produce a **submit-ready package** — the difference is the level of assistance",
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
    { title: "Career Paths in Petroleum", content: "## The Three LCA Employment Categories\n\n- Guyana's petroleum sector classifies all positions into **three LCA categories**\n- Each category has a **minimum Guyanese employment percentage** set by law\n- Employers must meet these thresholds or provide **written justification** for shortfalls\n- Your category determines which minimum applies to your role\n\n## Managerial Roles (75% Guyanese Minimum)\n\n- **Operations Manager** — oversees daily production and logistics\n- **Project Manager** — leads capital projects and contractor coordination\n- **HSE Manager** — manages health, safety, and environmental compliance\n- **Finance Director** — controls budgets, reporting, and financial planning\n- **Supply Chain Manager** — manages procurement and vendor relationships\n\n## Technical Roles (60% Guyanese Minimum)\n\n- **Drilling Engineer** — designs and oversees well drilling operations\n- **Mechanical Engineer** — maintains and repairs production equipment\n- **Geologist** — analyses subsurface data and reservoir characteristics\n- **HSE Officer** — implements safety procedures and conducts inspections\n- **Electrical Technician, Marine Pilot, ROV Operator** — specialised operational roles\n\n## Non-Technical Roles (80% Guyanese Minimum)\n\n- **Admin Assistant** — office administration and document management\n- **Logistics Coordinator** — coordinates transport and material movement\n- **Crane Operator** — operates heavy lifting equipment on site\n- **Catering Staff and Security Officer** — essential support services\n- **Warehouse Manager** — manages inventory and storage facilities\n\n## Understanding ISCO-08 Classification\n\n- Every petroleum position is classified using **ISCO-08 codes** (International Standard Classification of Occupations)\n- Understanding your code helps you **find matching jobs** on LCA Desk\n- It ensures employers **categorize you correctly** in their Half-Yearly Reports\n- Your ISCO-08 classification determines which **employment minimum** applies to your role",
      quiz: [
        { question: "Managerial roles require minimum Guyanese employment of:", options: ["60%", "70%", "75%", "80%"], correctIndex: 2 },
        { question: "A Drilling Engineer falls under:", options: ["Managerial", "Technical", "Non-Technical", "Unclassified"], correctIndex: 1 },
        { question: "ISCO-08 is:", options: ["A safety course", "International occupation classification", "A tax system", "A company type"], correctIndex: 1 },
        { question: "Admin Assistant falls under:", options: ["Managerial", "Technical", "Non-Technical", "None"], correctIndex: 2 },
        { question: "Non-Technical minimum Guyanese employment:", options: ["60%", "70%", "75%", "80%"], correctIndex: 3 },
      ],
    },
    { title: "Essential Certifications", content: "## Safety Certifications (Most Critical)\n\n- **BOSIET** (Basic Offshore Safety Induction & Emergency Training) — required for **ALL offshore work**\n- **HUET** (Helicopter Underwater Escape Training) — required for **helicopter transport** offshore\n- **H2S Alive** — hydrogen sulfide awareness, required for **most field positions**\n- **STCW** (Standards of Training, Certification & Watchkeeping) — required for **marine roles**\n- Safety certifications are **non-negotiable** — without them, you cannot work on site\n\n## Technical and Professional Certifications\n\n- **NEBOSH** (National Examination Board in OSH) — essential for HSE roles\n- **IOSH** (Institution of Occupational Safety and Health) — general safety awareness\n- **API certifications** — for inspection, welding, and pipeline work\n- **ASME certifications** — for pressure vessel and piping specialists\n- **PMP, CPA/ACCA, ISO Lead Auditor** — for management, finance, and quality roles\n\n## Where to Get Certified in Guyana\n\n- **Guyana Fire & Safety Training Centre** — offers BOSIET, H2S, and other safety courses\n- **OGIFS** (Oil & Gas Industry Fire & Safety) — specialised petroleum safety training\n- **International providers** with local centres in Georgetown\n- Check course schedules in advance — **popular courses fill up quickly**\n\n## Certification Cost Ranges\n\n- **BOSIET**: $500 - $1,000 — the most essential investment for offshore careers\n- **H2S Alive**: $200 - $400 — affordable and widely required\n- **NEBOSH**: $1,500 - $3,000 — higher cost but opens doors to HSE management\n- **PMP**: $400 - $600 — valuable for project management career paths\n- Many employers **reimburse certification costs** for committed employees\n\n## Keeping Certifications Current\n\n- Most safety certifications must be **renewed every 2-4 years**\n- An **expired certification** is treated the same as having no certification at all\n- Track expiry dates and schedule renewals **well in advance** of deadlines\n- Add all valid certifications to your **LCA Desk profile** with expiry dates",
      quiz: [
        { question: "BOSIET is required for:", options: ["Only managers", "All offshore work", "Only drilling", "Optional"], correctIndex: 1 },
        { question: "H2S stands for:", options: ["Health & Safety Standard", "Hydrogen Sulfide", "High Security System", "Human Safety"], correctIndex: 1 },
        { question: "NEBOSH is relevant for:", options: ["Drilling roles", "HSE roles", "Catering roles", "Admin roles"], correctIndex: 1 },
        { question: "BOSIET costs approximately:", options: ["$100-$200", "$500-$1,000", "$2,000-$5,000", "$10,000+"], correctIndex: 1 },
        { question: "HUET training is for:", options: ["Helicopter escape", "Fire fighting", "First aid", "Diving"], correctIndex: 0 },
      ],
    },
    { title: "Building Your Profile on LCA Desk", content: "## Complete Your Profile\n\n- A complete profile makes you visible to contractors in the **Talent Pool**\n- Include your **current job title** and correct LCA employment category (Managerial/Technical/Non-Technical)\n- Be specific with skills: **'FPSO maintenance'** wins over generic 'maintenance'\n- Add **certifications with dates**, education level, years of experience, and location preference\n\n## Opt Into the Talent Pool\n\n- Toggle **Profile Visible** in your settings to let contractors find you\n- Contractors search by **skills, employment category, and certifications**\n- A hidden profile means you will **not appear** in contractor searches\n- Keep your profile **updated** — stale information reduces your chances of being contacted\n\n## Earn Badges and Build Credibility\n\n- Completed courses show as **badges** on your Talent Pool profile\n- **LCA Certified** (blue) — signals understanding of local content regulations\n- **Career Ready** (blue) and **Supplier Certified** (green) — demonstrate sector knowledge\n- Badges signal to employers that you **understand the regulatory environment**\n\n## Use the AI Resume Builder\n\n- The AI-powered resume builder creates **petroleum-sector-ready CVs**\n- **Extract skills** from existing documents or generate a resume from your profile data\n- **Enhance** existing resumes with industry-specific keywords and formatting\n- **Export as PDF** ready to attach to job applications and EOI responses\n\n## Set Up Job Alerts\n\n- Enable alerts in **Settings** to get notified when matching jobs are posted\n- Alerts are filtered by your **employment category** and skill preferences\n- Respond quickly to new postings — **early applicants** often get priority consideration\n- Combine alerts with a **complete profile** to maximise your visibility to employers",
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
    { title: "What Contractors Look For", content: "## Safety Culture\n\n- **Safety is non-negotiable** in petroleum hiring decisions\n- Every answer you give should demonstrate **safety awareness**\n- You must understand **Stop Work Authority** — anyone can stop unsafe work\n- Candidates who downplay safety are immediately disqualified\n- Show you prioritize safety over schedule pressure\n\n## Technical Competence & Certifications\n\n- Specific experience with relevant **equipment, software, or processes** matters most\n- Generic qualifications are less valuable than hands-on expertise\n- Valid **BOSIET, H2S, and role-specific certs** are table stakes\n- **Expired certifications are not valid** — keep them current\n- Bring copies of all certificates to interviews\n\n## Cultural Fit & Adaptability\n\n- Can you work in a **multi-national team** environment?\n- Are you prepared for a **28-day rotation schedule**?\n- Comfortable working in **remote or offshore locations**?\n- Behavioral interview questions assess teamwork and adaptability\n\n## Local Content Advantage\n\n- Under the **Local Content Act**, contractors must give first consideration to **qualified Guyanese nationals**\n- Your nationality is a **competitive advantage** — own it\n- Contractors need to meet **employment minimums** (75/60/80 targets)\n- Being Guyanese helps companies meet their compliance obligations\n\n## Common Interview Formats\n\n- **Phone screen** — 15-30 minutes, initial fit assessment\n- **Technical assessment** — written test or practical demonstration\n- **Panel interview** — 2-3 interviewers, behavioral and technical mix\n- **HSE scenario walkthrough** — how you handle safety situations\n- **Medical and fitness assessment** — required for offshore roles",
      quiz: [
        { question: "The most important trait for petroleum hiring:", options: ["Speed", "Safety culture", "Social skills", "Salary flexibility"], correctIndex: 1 },
        { question: "Stop Work Authority means:", options: ["Managers can stop work", "Anyone can stop unsafe work", "Work stops at 5pm", "The government can stop operations"], correctIndex: 1 },
        { question: "An expired BOSIET certificate is:", options: ["Still valid for 6 months", "Not valid", "Valid if you passed originally", "Transferable"], correctIndex: 1 },
        { question: "Under the LCA, Guyanese nationality is:", options: ["Irrelevant", "A competitive advantage", "A requirement for all roles", "Only relevant for managers"], correctIndex: 1 },
        { question: "A typical interview process includes:", options: ["Just a phone call", "Phone screen, technical assessment, panel interview", "Only a written test", "A single meeting"], correctIndex: 1 },
      ],
    },
    { title: "Common Interview Questions", content: "## Technical Questions — Engineering\n\n- \"Describe your experience with **[specific equipment or process]**\"\n- \"Walk me through a time you **solved a technical problem** under pressure\"\n- \"What **standards** do you follow for welding, inspection, or design?\"\n- Prepare concrete examples with **measurable outcomes**\n- Reference industry standards like **API, ASME, or ISO** where relevant\n\n## Technical Questions — HSE & Operations\n\n### HSE Roles\n- \"Describe your approach to a **Job Safety Analysis (JSA)**\"\n- \"How would you handle a colleague **not wearing PPE**?\"\n- \"What is your experience with **incident investigation**?\"\n\n### Operations & Logistics\n- \"How do you **prioritize competing demands**?\"\n- \"Describe managing **supply chains in remote locations**\"\n- \"How do you handle **equipment breakdowns** during critical operations?\"\n\n## The STAR Method for Behavioral Questions\n\n- **S**ituation — set the scene with context\n- **T**ask — explain what you were responsible for\n- **A**ction — describe specifically what you did\n- **R**esult — share the measurable outcome\n- Practice with: \"Tell me about a time you **identified a safety hazard**\"\n\n## Sample Behavioral Questions\n\n- \"Describe working with a **difficult team member**\"\n- \"Give an example of when you **went above and beyond**\"\n- \"Tell me about a time you **met a tight deadline**\"\n- \"How did you handle **conflicting instructions** from supervisors?\"\n- Always tie your answer back to **safety, teamwork, or results**\n\n## Questions to Ask the Interviewer\n\n- What does a typical **rotation schedule** look like?\n- What **safety certifications** does the team hold?\n- How does the company support **local content development**?\n- What does **career progression** look like in this role?\n- What **training programs** are available for new hires?",
      quiz: [
        { question: "STAR stands for:", options: ["Safety, Training, Assessment, Review", "Situation, Task, Action, Result", "Standard, Technical, Applied, Reported", "Start, Think, Act, Reflect"], correctIndex: 1 },
        { question: "When asked about PPE non-compliance, you should:", options: ["Ignore it", "Report it and address it directly", "Wait for a manager", "Document it only"], correctIndex: 1 },
        { question: "Asking about rotation schedule shows:", options: ["You're lazy", "You understand the working environment", "You want more time off", "Nothing useful"], correctIndex: 1 },
        { question: "Technical questions test:", options: ["Memorization", "Specific experience with relevant processes", "Speed of thinking", "Personality"], correctIndex: 1 },
        { question: "A JSA is:", options: ["Job Safety Analysis", "Joint Service Agreement", "Junior Staff Assessment", "Jurisdiction Safety Act"], correctIndex: 0 },
      ],
    },
    { title: "After the Interview", content: "## Follow-Up Best Practices\n\n- Send a **thank-you email within 24 hours** of the interview\n- Reference something **specific** from the conversation\n- If no response, follow up after **5-7 business days** — once only\n- Be **professional, not pushy** in all follow-up communication\n\n## If You Get the Offer\n\n- Review the **contract carefully** before signing\n- Check **rotation schedule, leave policy, and medical coverage**\n- Verify which **certifications** are required before your start date\n- Ask about the **onboarding timeline** and training plan\n- Confirm **salary, overtime rates, and payment schedule** in writing\n\n## If You Are Not Selected\n\n- **Ask for feedback** — many companies will provide it\n- Stay in their **candidate database** for future opportunities\n- Keep your **LCA Desk profile** updated with new skills and certs\n- **Apply to similar roles** — persistence pays off in this sector\n\n## Red Flags in Job Offers\n\n- **No written contract** before your start date\n- **Vague payment terms** or unclear salary schedule\n- No mention of **insurance or medical coverage**\n- Required to **pay for certifications** the employer should cover\n- Salary **significantly below market rate** for the role\n\n## Salary Expectations — Guyana 2026\n\n- **Entry-level technical**: $80,000-$150,000 GYD/month\n- **Mid-level engineer**: $200,000-$500,000 GYD/month\n- **Senior / Managerial**: $500,000-$1,500,000 GYD/month\n- **Offshore premium**: 30-50% above onshore rates\n- Always research the **market rate** before negotiating",
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
    { title: "What is ESG?", content: "## What ESG Stands For\n\n- **ESG** = Environmental, Social, and Governance\n- A framework used by **investors, regulators, and stakeholders**\n- Evaluates a company's impact **beyond financial returns**\n- Increasingly required for companies in the **petroleum sector**\n- Drives investment decisions and **contract awards**\n\n## The Environmental Pillar\n\n- **Carbon emissions** and climate impact tracking\n- **Waste management** and pollution prevention\n- **Biodiversity** and ecosystem protection\n- **Water usage** and treatment standards\n\n## The Social Pillar\n\n- **Local content and community benefit** — this is where LCA compliance fits\n- **Worker health and safety** programs\n- **Diversity and inclusion** in hiring\n- **Human rights** in supply chains\n- **Community engagement** and development\n\n## The Governance Pillar\n\n- **Board diversity** and independence requirements\n- **Executive compensation** transparency\n- **Anti-corruption** and bribery policies\n- **Regulatory compliance** and audit readiness\n\n## Why ESG Matters for Local Content\n\n- Major operators (**ExxonMobil, Hess, TotalEnergies**) publish annual ESG reports\n- Local content in Guyana is a key metric in the **Social pillar**\n- Every dollar spent with a **Guyanese supplier** is an ESG data point\n- Every **Guyanese national employed** feeds ESG reporting\n- Training programs delivered count toward **Social impact metrics**",
      quiz: [
        { question: "ESG stands for:", options: ["Energy, Safety, Growth", "Environmental, Social, Governance", "Equity, Standards, Guidelines", "Economics, Systems, Goals"], correctIndex: 1 },
        { question: "Local content falls under which ESG pillar?", options: ["Environmental", "Social", "Governance", "None"], correctIndex: 1 },
        { question: "Who reads ESG reports?", options: ["Only the government", "Investors, regulators, and stakeholders", "Only employees", "No one"], correctIndex: 1 },
        { question: "Guyanese supplier spend is:", options: ["Irrelevant to ESG", "An ESG data point for the Social pillar", "Only relevant to Guyana", "A tax metric"], correctIndex: 1 },
        { question: "Major petroleum companies publish ESG reports:", options: ["Never", "Every 5 years", "Annually", "Only when required"], correctIndex: 2 },
      ],
    },
    { title: "Local Content as ESG Performance", content: "## Local Procurement Metrics\n\n- **Total spend** with Guyanese suppliers\n- **Local Content Rate (%)** — the core KPI\n- Number of **Guyanese suppliers engaged**\n- **Supplier development programs** delivered\n- Maps to ESG Social pillar: **Community Benefit**\n\n## Local Employment Metrics\n\n- **Guyanese employment by category** (management, technical, other)\n- Compliance with **employment minimums** (75/60/80 targets)\n- **Remuneration data** — equal pay compliance\n- **Workforce development** and training investment\n- Maps to ESG Social pillar: **Workforce**\n\n## Capacity Development Metrics\n\n- **Training hours** delivered to Guyanese nationals\n- Number of **Guyanese participants** trained\n- **Scholarships** and educational support programs\n- **Technology transfer** initiatives\n- Maps to ESG Social pillar: **Education & Training**\n\n## ESG Reporting Frameworks\n\n- **GRI Standard 204**: Procurement Practices\n- **GRI Standard 401**: Employment\n- **GRI Standard 404**: Training and Education\n- **SASB** Oil & Gas industry standards\n- LCA Desk filing data maps **directly** to these frameworks\n\n## Why Accuracy Matters\n\n- Your half-yearly filing produces data your **ESG team needs**\n- Inaccurate filings create **reporting risk** for the entire company\n- Structured data from **LCA Desk** is audit-ready\n- Compliance officers are the **bridge** between operations and ESG reporting",
      quiz: [
        { question: "LC Rate maps to which ESG metric?", options: ["Environmental impact", "Local procurement / community benefit", "Carbon emissions", "Board diversity"], correctIndex: 1 },
        { question: "GRI Standard 204 covers:", options: ["Climate change", "Procurement Practices", "Water usage", "Executive pay"], correctIndex: 1 },
        { question: "Training data feeds into ESG through:", options: ["Environmental pillar", "Governance pillar", "Social pillar (education & training)", "Financial reporting"], correctIndex: 2 },
        { question: "LCA Desk filing data is useful for:", options: ["Only the Secretariat", "Both regulatory compliance and ESG reporting", "Only tax purposes", "Only internal use"], correctIndex: 1 },
        { question: "Equal pay compliance falls under:", options: ["Environmental", "Social - Workforce", "Governance", "Not ESG-related"], correctIndex: 1 },
      ],
    },
    { title: "Future of Local Content & ESG", content: "## Mandatory ESG Reporting Is Coming\n\n- The EU's **CSRD** (Corporate Sustainability Reporting Directive) mandates ESG disclosures\n- The **SEC's climate disclosure rules** add further requirements\n- Companies operating in Guyana will need **structured local content data**\n- Voluntary reporting is shifting to **mandatory compliance**\n- Operators without ESG data infrastructure face **regulatory risk**\n\n## Carbon & Local Content Intersection\n\n- Using **local suppliers** reduces transportation emissions\n- A Guyanese catering company has a **smaller carbon footprint** than flying food from Houston\n- This creates a **dual ESG benefit**: local content + reduced emissions\n- Local procurement supports both the **Environmental and Social** pillars\n\n## Supply Chain Due Diligence\n\n- International regulations require companies to **audit their entire supply chain**\n- Your **LCS certification** becomes proof of responsible sourcing\n- **Compliance data** demonstrates ESG readiness to auditors\n- Operators increasingly require suppliers to show **ESG credentials**\n\n## Digital Verification & Data Quality\n\n- Platforms like **LCA Desk** provide **auditable, timestamped** compliance data\n- More valuable to ESG auditors than **self-reported spreadsheets**\n- Digital records create an **immutable compliance trail**\n- Structured data can be exported directly into **ESG reporting tools**\n\n## Your Competitive Edge\n\n- Understanding the **ESG-local content connection** wins more contracts\n- Operators want partners who help report **strong ESG numbers**\n- **LCS-certified Guyanese companies** provide exactly this value\n- As **Nigeria, Suriname, and Namibia** adopt local content laws, your skills transfer globally",
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
  const mods = [
    { title: "Understanding the Market", content: "## The Compliance Obligation\n\n- Every **contractor and sub-contractor** in petroleum must file **Half-Yearly Reports**\n- This is **mandatory** under the Local Content Act 2021\n- Non-compliance carries fines up to **GY$50M**\n- Most companies spend **20-40 hours** per filing period doing this manually\n- **Excel templates** are confusing, error-prone, and hard to audit\n\n## Who Needs LCA Desk\n\n- **Contractors**: ExxonMobil partners, CNOOC, Hess, SBM Offshore\n- **Sub-contractors**: Engineering firms, catering, logistics, marine services\n- **Consultants**: Firms that file on behalf of multiple companies\n- **New entrants**: Companies just starting petroleum sector operations\n\n## Key Pain Points to Highlight\n\n- **Employment minimums** (75/60/80) are hard to track manually\n- **Secretariat submissions** require multiple documents in specific formats\n- **Deadline management** is stressful — one missed date means penalties\n- **Narrative reports** take hours to write from scratch\n- Data scattered across **spreadsheets, emails, and paper files**\n\n## Your Value Proposition\n\n- LCA Desk reduces reporting from **20+ hours to under 2 hours**\n- **AI-powered narrative drafting** generates compliant reports automatically\n- **Direct Secretariat submission** eliminates manual filing\n- Built-in **deadline reminders** prevent late filings\n- One platform for **expenditure, employment, and capacity development**",
      quiz: [
        { question: "Half-Yearly Reports are:", options: ["Optional for small companies", "Mandatory under the Local Content Act 2021", "Only required annually", "Only for contractors"], correctIndex: 1 },
        { question: "Manual compliance reporting typically takes:", options: ["1-2 hours", "5-10 hours", "20-40 hours per period", "Over 100 hours"], correctIndex: 2 },
        { question: "The maximum fine for non-compliance is:", options: ["GY$1M", "GY$10M", "GY$50M", "GY$100M"], correctIndex: 2 },
        { question: "LCA Desk reduces reporting time to:", options: ["Under 2 hours", "10 hours", "Half a day", "One full day"], correctIndex: 0 },
        { question: "Which is NOT a pain point of manual filing?", options: ["Error-prone spreadsheets", "Missed deadlines", "Automated narrative drafting", "Scattered data"], correctIndex: 2 },
      ],
    },
    { title: "Buyer Personas", content: "## The Compliance Officer\n\n- Spends **days on each report** every filing period\n- Frustrated with **Excel templates** and manual calculations\n- Worried about **missing deadlines** and facing penalties\n- Needs to track **employment minimums** across departments\n- **Pitch**: Time savings, automation, deadline reminders\n\n## The CEO or General Manager\n\n- Cares about **penalties and company reputation**\n- Wants compliance handled **without adding headcount**\n- Needs **audit readiness** for investors and regulators\n- Focused on **risk reduction** across the business\n- **Pitch**: Risk reduction, cost savings, audit-ready reports\n\n## The Consultant\n\n- Manages reports for **multiple companies** simultaneously\n- Needs to **scale without hiring** additional staff\n- Requires **professional-grade tools** for client deliverables\n- Values **multi-entity management** and bulk workflows\n- **Pitch**: Multi-entity management, bulk pricing, professional tools\n\n## The New Market Entrant\n\n- Does not fully understand the **Act requirements**\n- Needs **guidance and training**, not just software\n- Overwhelmed by **compliance complexity** in a new jurisdiction\n- Often unaware of **employment minimums and filing deadlines**\n- **Pitch**: Built-in training, AI expert, step-by-step guidance\n\n## Matching Persona to Pitch\n\n- Identify the **decision-maker** vs. the **end user** — they may differ\n- Lead with the **pain point** most relevant to their role\n- **Compliance Officers** care about time; **CEOs** care about risk\n- **Consultants** care about scale; **New entrants** care about learning",
      quiz: [
        { question: "A Compliance Officer's primary pain point is:", options: ["Company growth", "Time spent on reports", "Marketing strategy", "Product development"], correctIndex: 1 },
        { question: "For a CEO, the best pitch focuses on:", options: ["Spreadsheet features", "Risk reduction and cost savings", "Social media integration", "Training modules"], correctIndex: 1 },
        { question: "Consultants need LCA Desk primarily for:", options: ["Single-entity reporting", "Multi-entity management at scale", "Personal tax filing", "Job searching"], correctIndex: 1 },
        { question: "New market entrants are most concerned about:", options: ["Bulk pricing", "Understanding Act requirements", "Rotation schedules", "ESG reporting"], correctIndex: 1 },
        { question: "The decision-maker and end user:", options: ["Are always the same person", "May be different people", "Don't matter for sales", "Only matter for consultants"], correctIndex: 1 },
      ],
    },
    { title: "Objection Handling", content: "## \"We Already Use Excel\"\n\n- Acknowledge that Excel works — then highlight what it **cannot** do\n- LCA Desk **automates calculations** that are error-prone in spreadsheets\n- **AI generates the narrative report** — Excel cannot do this\n- Built-in **deadline tracking** eliminates calendar management\n- Most companies save **20+ hours per period** by switching\n\n## \"It's Too Expensive\"\n\n- At **$199/month**, it costs less than one compliance officer's time for 2 days\n- The penalty for a **late filing starts at GY$1M minimum**\n- Compare the subscription cost to the **cost of errors and fines**\n- ROI is achieved in the **first filing period** for most companies\n\n## \"We'll Build Our Own\"\n\n- LCA Desk is **purpose-built** for the Local Content Act\n- Supports **4 jurisdictions** with jurisdiction-specific rules\n- Includes **AI narrative drafting** and direct Secretariat submission\n- Building in-house would take **6-12 months** and cost **10x more**\n- Ongoing maintenance and regulatory updates add further cost\n\n## \"We Don't Need It Yet\"\n\n- The next **Half-Yearly deadline** is always approaching\n- Companies that start now have time to **enter data properly**\n- **Last-minute filings** are where costly errors happen\n- The **30-day free trial** means there is no risk in starting early\n\n## General Objection-Handling Tips\n\n- **Listen first** — understand the real concern behind the objection\n- **Acknowledge** the objection before responding\n- Use **specific numbers** (hours saved, penalty amounts, cost comparison)\n- Always offer the **free trial** as a low-risk next step",
      quiz: [
        { question: "When someone says 'We use Excel', you should first:", options: ["Criticize Excel", "Acknowledge it works, then highlight gaps", "Ignore the objection", "Offer a discount"], correctIndex: 1 },
        { question: "The cost of LCA Desk compared to manual compliance is:", options: ["Much higher", "About the same", "Significantly lower", "Free"], correctIndex: 2 },
        { question: "Building an in-house compliance tool would take:", options: ["1-2 weeks", "1-2 months", "6-12 months and cost 10x more", "No time at all"], correctIndex: 2 },
        { question: "The best response to 'We don\'t need it yet' involves:", options: ["Agreeing and leaving", "Mentioning the upcoming deadline", "Pressuring them to buy now", "Offering a bigger discount"], correctIndex: 1 },
        { question: "Effective objection handling uses:", options: ["Emotional appeals only", "Specific numbers and data", "Aggressive closing", "Ignoring concerns"], correctIndex: 1 },
      ],
    },
    { title: "Closing Techniques", content: "## The Trial Close\n\n- Offer the **30-day free trial** as a no-risk starting point\n- They can enter **real data** and evaluate time savings firsthand\n- **No credit card required** to start — removes friction\n- Frame it as: \"See if it saves you time — no obligation\"\n\n## The Deadline Close\n\n- Check the **compliance calendar** for their next filing date\n- Say: \"Your next H1 report is due [date] — starting now gives you time to set up\"\n- **Urgency is real** — late filings carry guaranteed penalties\n- This works especially well in the **weeks before a deadline**\n\n## Using Your Referral Link\n\n- **Always share** your personal referral link — not the generic URL\n- When they sign up through your link, they are **attributed to you**\n- When they subscribe, you **earn your commission**\n- The more companies you refer, the **more you earn**\n\n## Follow-Up Strategy\n\n- Send your **referral link** in a follow-up email after every conversation\n- **Check back after 7 days** if they have not signed up\n- Offer to **help them set up** their first entity on the platform\n- Keep notes on each prospect's **specific pain points** for personalized follow-up\n\n## Key Closing Principles\n\n- **Always ask** for the next step — do not leave conversations open-ended\n- Make it easy: share the link, offer help, **remove barriers**\n- The best close is a **solved problem** — show them it works\n- Follow up **consistently** but respectfully — persistence wins",
      quiz: [
        { question: "The free trial period is:", options: ["7 days", "14 days", "30 days", "60 days"], correctIndex: 2 },
        { question: "The deadline close works because:", options: ["People like pressure", "Filing deadlines create real urgency", "It's a trick", "Everyone forgets dates"], correctIndex: 1 },
        { question: "You should share:", options: ["The generic website URL", "Your personal referral link", "A competitor's link", "No link at all"], correctIndex: 1 },
        { question: "After initial contact, follow up within:", options: ["24 hours", "7 days", "30 days", "Never"], correctIndex: 1 },
        { question: "The best close is:", options: ["High-pressure tactics", "A solved problem — showing it works", "Repeated phone calls", "Offering the lowest price"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
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
  const mods = [
    { title: "Social Media Strategy", content: "## Why LinkedIn Is Your Primary Channel\n\n- **LinkedIn** is where your buyers (compliance officers, CEOs, consultants) are active\n- Petroleum industry professionals use LinkedIn for **industry news and networking**\n- Posts about compliance topics get **high engagement** from your target audience\n- Your profile should clearly state your **affiliation with LCA Desk**\n- Connect with people in **oil & gas, compliance, and legal** roles in Guyana\n\n## What to Post About\n\n- **Compliance deadlines** approaching — creates urgency\n- **Local content statistics** and trends from the Secretariat\n- **Pain points** of manual reporting — your audience relates\n- **Success stories** from companies using LCA Desk\n- **Tips and insights** about the Local Content Act\n\n## Posting Cadence & Content Mix\n\n- Post **2-3 times per week** for consistent visibility\n- Mix content: **1 educational, 1 promotional, 1 engagement** post\n- Use the **pre-written posts** available in Marketing Assets\n- **Always include your referral link** in promotional posts\n- Engage with comments to **boost post visibility** in the algorithm\n\n## Hashtags & Reach\n\n- Use relevant hashtags: **#LocalContent #Guyana #PetroleumSector**\n- Also use: **#Compliance #LCADesk #OilAndGas**\n- Tag relevant companies and individuals to **increase reach**\n- Share and comment on **industry news** to stay visible\n\n## Other Social Platforms\n\n- **Facebook**: Useful for reaching Guyanese business community groups\n- **X (Twitter)**: Good for sharing quick compliance tips and news\n- **WhatsApp**: Business groups are active in Guyana — share your link\n- Focus **80% of effort on LinkedIn** — it has the highest ROI",
      quiz: [
        { question: "The primary social media channel for selling LCA Desk is:", options: ["Instagram", "TikTok", "LinkedIn", "Snapchat"], correctIndex: 2 },
        { question: "Recommended posting frequency is:", options: ["Once a month", "2-3 times per week", "Daily", "Once a year"], correctIndex: 1 },
        { question: "The content mix should include:", options: ["Only promotional posts", "Educational, promotional, and engagement posts", "Only memes", "Only news articles"], correctIndex: 1 },
        { question: "You should always include in promotional posts:", options: ["Your phone number", "Your referral link", "Your home address", "A competitor comparison"], correctIndex: 1 },
        { question: "The best ROI social platform for B2B compliance sales is:", options: ["Instagram", "TikTok", "LinkedIn", "Pinterest"], correctIndex: 2 },
      ],
    },
    { title: "Email Outreach", content: "## Finding Prospects\n\n- **LinkedIn search**: Look for \"compliance officer\" + \"Guyana\"\n- **LCS Register**: Company directories list active petroleum companies\n- **Industry events**: Collect contacts from attendee lists\n- **Chamber of Commerce**: Membership lists include target companies\n- **Company websites**: Find compliance and legal department contacts\n\n## Crafting Your Email\n\n### The 5-Part Email Structure\n- **Personal hook** — mention their company name or role specifically\n- **Pain point** — compliance reporting takes too long and is error-prone\n- **Solution** — LCA Desk automates the entire process\n- **Social proof** — mention companies already using the platform\n- **CTA** — include your referral link for a free trial\n\n## Subject Lines That Get Opened\n\n- \"Cutting your Half-Yearly Report time by 90%\"\n- \"[Company Name] — compliance reporting question\"\n- \"The next filing deadline is [date] — are you ready?\"\n- Keep subject lines **under 50 characters** when possible\n- **Personalization** in the subject line increases open rates\n\n## Email Best Practices\n\n- Send emails **Tuesday through Thursday** for best open rates\n- Keep the body to **3-5 short paragraphs** maximum\n- Use the **proven templates** in the Marketing Assets section\n- **Follow up once** after 5-7 days if no response\n- Never send **bulk unsolicited emails** — personalize each one\n\n## Tracking & Measuring Results\n\n- Track which **subject lines** get the most opens\n- Note which **pain points** resonate with different personas\n- Keep a **spreadsheet of contacts** and follow-up dates\n- Measure your **referral link clicks** to gauge interest",
      quiz: [
        { question: "The best day to send outreach emails is:", options: ["Monday morning", "Tuesday through Thursday", "Friday afternoon", "Saturday"], correctIndex: 1 },
        { question: "The email structure should start with:", options: ["A discount offer", "A personal hook mentioning their company", "A generic greeting", "Your life story"], correctIndex: 1 },
        { question: "Subject lines should be:", options: ["As long as possible", "Under 50 characters when possible", "In all caps", "Always the same"], correctIndex: 1 },
        { question: "If no response, follow up after:", options: ["1 hour", "5-7 days", "30 days", "Never follow up"], correctIndex: 1 },
        { question: "Prospect lists can be built from:", options: ["Only LinkedIn", "LCS Register, LinkedIn, events, and Chamber of Commerce", "Only cold calling", "Only referrals"], correctIndex: 1 },
      ],
    },
    { title: "Events & Networking", content: "## Key Industry Events\n\n- **Guyana Energy Conference** — the largest annual industry gathering\n- **LCS stakeholder meetings** — direct access to compliance decision-makers\n- **Chamber of Commerce events** — broad business networking\n- **Oil & Gas networking mixers** — informal relationship building\n- Attend **at least one event per quarter** to maintain visibility\n\n## Your Elevator Pitch\n\n- \"I help petroleum companies cut compliance reporting time by **90%**\"\n- \"LCA Desk automates **Half-Yearly Reports** — expenditure, employment, capacity development\"\n- \"**AI drafts the narrative** and data is submitted directly to the Secretariat\"\n- \"Most companies save **20+ hours per filing period**\"\n- Keep it under **30 seconds** — practice until it flows naturally\n\n## Working a Room Effectively\n\n- **Ask questions first** — learn about their compliance challenges\n- Listen for **pain points** before pitching the solution\n- Exchange **business cards** or contact info at every conversation\n- Mention the **free trial** — it is a natural conversation closer\n- Do not hard-sell — **build relationships** that convert later\n\n## Business Cards & Materials\n\n- Include your **referral link** on your business card\n- Add a **QR code** that links directly to your signup page\n- Carry a few **one-pagers** about LCA Desk for interested prospects\n- Your card should clearly identify you as an **LCA Desk affiliate**\n\n## Post-Event Follow-Up\n\n- Send your **referral link within 24 hours** with a personalized note\n- Reference the **specific conversation** you had at the event\n- Connect on **LinkedIn** and engage with their posts\n- Add them to your **prospect tracking spreadsheet**\n- Follow up again in **7-10 days** if they have not signed up",
      quiz: [
        { question: "The largest annual industry event in Guyana is:", options: ["Chamber mixer", "Guyana Energy Conference", "LCS meeting", "Trade expo"], correctIndex: 1 },
        { question: "Your elevator pitch should be under:", options: ["5 seconds", "30 seconds", "5 minutes", "15 minutes"], correctIndex: 1 },
        { question: "At networking events, you should first:", options: ["Pitch immediately", "Ask questions and listen for pain points", "Hand out flyers", "Avoid conversation"], correctIndex: 1 },
        { question: "Post-event follow-up should happen within:", options: ["1 hour", "24 hours", "1 month", "Never"], correctIndex: 1 },
        { question: "Your business card should include:", options: ["Only your name", "Your referral link or QR code", "Your home address", "Nothing special"], correctIndex: 1 },
      ],
    },
  ];

  for (let i = 0; i < mods.length; i++) {
    await db.insert(courseModules).values({ courseId: course.id, orderIndex: i + 1, title: mods[i].title, content: mods[i].content, quizQuestions: JSON.stringify(mods[i].quiz) });
  }
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
