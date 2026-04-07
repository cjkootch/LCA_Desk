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
  submissionAcknowledgments,
  amendmentRequests,
  supplierResponses,
  lcsCertApplications,
} from "@/server/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { getPlan, getEffectivePlan, isInTrial, isTrialExpired, getTrialDaysRemaining, getBillingAccess } from "@/lib/plans";
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
    plan: (membership.tenant.plan as string) || "free",
    trialEndsAt: membership.tenant.trialEndsAt ?? null,
    stripeSubscriptionId: membership.tenant.stripeSubscriptionId ?? null,
    stripeSubscriptionStatus: membership.tenant.stripeSubscriptionStatus ?? null,
  };
}

function requirePlan(plan: string, required: "lite" | "pro" | "enterprise", trialEndsAt?: Date | null) {
  const effective = getEffectivePlan(plan, trialEndsAt);
  const rank: Record<string, number> = { free: 0, lite: 1, starter: 1, pro: 2, enterprise: 3 };
  if ((rank[effective.code] ?? 0) < rank[required]) {
    const planNames: Record<string, string> = { lite: "Lite", pro: "Pro", enterprise: "Enterprise" };
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
  const { tenantId } = await getSessionTenant();
  await db
    .delete(capacityDevelopmentRecords)
    .where(
      and(
        eq(capacityDevelopmentRecords.id, id),
        eq(capacityDevelopmentRecords.tenantId, tenantId)
      )
    );
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
    with: { tenant: true },
  });

  return {
    user: session.user,
    tenant: membership?.tenant || null,
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
  const { tenantId, plan } = await getSessionTenant();
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

  if (!existingUser) {
    throw new Error("No account found with that email. They must sign up first.");
  }

  // Check if already a member
  const existing = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, existingUser.id)
    ),
  });

  if (existing) {
    throw new Error("This user is already a team member.");
  }

  const [member] = await db
    .insert(tenantMembers)
    .values({
      tenantId,
      userId: existingUser.id,
      role: data.role,
    })
    .returning();

  return member;
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
  const plan = tenant.plan || "free";
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
    isInTrial: isInTrial(trialEndsAt),
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
    .orderBy(notifications.createdAt)
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

  const [tenant] = await db
    .insert(tenants)
    .values({ name: companyName, slug, jurisdictionId: guyana?.id })
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
  name?: string;
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

  const openJobs = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.status, "open"), eq(jobPostings.isPublic, true)))
    .limit(500);

  const profile = await db.query.jobSeekerProfiles.findFirst({
    where: eq(jobSeekerProfiles.userId, session.user.id),
  });

  return {
    totalApplications: apps.length,
    activeApplications: apps.filter((a) => !["selected", "rejected"].includes(a.status || "")).length,
    selectedCount: apps.filter((a) => a.status === "selected").length,
    rejectedCount: apps.filter((a) => a.status === "rejected").length,
    savedOpportunities: saved.length,
    openJobsCount: openJobs.length,
    profileComplete: !!(
      profile?.currentJobTitle &&
      profile?.employmentCategory &&
      profile?.skills?.length
    ),
    profile,
  };
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
  // Check caller's plan to gate contact info server-side
  let callerIsPro = false;
  try {
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
      userName: users.name,
      userEmail: users.email,
    })
    .from(jobSeekerProfiles)
    .innerJoin(users, eq(jobSeekerProfiles.userId, users.id))
    .where(eq(jobSeekerProfiles.profileVisible, true))
    .limit(200);

  // Get badges for all visible users
  const allUserIds = profiles.map(p => p.userId);
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
  const sanitized = profiles.map(p => {
    const userBadges = allBadges
      .filter(b => b.userId === p.userId)
      .map(b => b.badgeLabel)
      .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
    return {
      ...p,
      userEmail: callerIsPro ? p.userEmail : null,
      cvUrl: callerIsPro ? p.cvUrl : null,
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

export async function fetchCourses(audience?: "seeker" | "filer" | "all") {
  const allCourses = await db.select().from(courses).where(eq(courses.active, true)).limit(50);
  if (audience) return allCourses.filter(c => c.audience === audience || c.audience === "all");
  return allCourses;
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
    moduleCount: 5,
    badgeLabel: "LCA Certified",
    badgeColor: "accent",
    estimatedMinutes: 30,
  }).returning();

  const moduleData = [
    {
      title: "Understanding the Local Content Act 2021",
      content: `## What is the Local Content Act?\n\nThe Local Content Act No. 18 of 2021 is Guyana's landmark legislation ensuring that Guyanese citizens and companies benefit from the country's petroleum sector.\n\n## Key Objectives\n- Maximize the use of Guyanese labour, services, and goods\n- Develop local capacity and skills\n- Ensure transparency in procurement\n- Create meaningful economic participation for Guyanese\n\n## Who Does It Apply To?\nThe Act applies to all **Contractors**, **Sub-Contractors**, and **Licensees** operating in Guyana's petroleum sector. This includes international companies like ExxonMobil, Halliburton, and their supply chains.\n\n## The Local Content Secretariat\nThe Secretariat, under the Ministry of Natural Resources, oversees compliance. Reports are submitted to **localcontent@nre.gov.gy**.`,
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
      content: `## Employment Under the LCA\n\nSection 12 requires that **first consideration** be given to Guyanese nationals for all positions.\n\n## Employment Categories\nThe LCA tracks employment in three categories:\n\n### Managerial (Minimum 75% Guyanese)\nSenior management, directors, department heads.\n\n### Technical (Minimum 60% Guyanese)\nEngineers, geologists, technicians, skilled specialists.\n\n### Non-Technical (Minimum 80% Guyanese)\nAdministrative, clerical, support staff, logistics.\n\n## ISCO-08 Classification\nAll positions must be classified using the International Standard Classification of Occupations (ISCO-08) in reports.\n\n## Equal Pay (Section 18)\nGuyanese nationals must receive equal pay for work of equal value compared to non-Guyanese counterparts.`,
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
      content: `## What is the LCS Register?\n\nThe Local Content Secretariat maintains a register of certified Guyanese suppliers at **lcregister.petroleum.gov.gy**.\n\n## LCS Certificate\nTo count as a \"Guyanese supplier\" for compliance purposes, a company must hold a valid LCS Certificate (format: LCSR-XXXXXXXX).\n\n## Why It Matters\n- Contractors track their **Local Content Rate** — the percentage of expenditure going to LCS-certified suppliers\n- Higher LC rates mean better compliance scores\n- The Secretariat reviews these numbers in Half-Yearly Reports\n\n## Service Categories\nThe register covers 40+ categories including:\n- Engineering and Machining\n- Construction\n- Transportation\n- Catering and Food Services\n- Environmental Services\n- And many more\n\n## How to Get Registered\nApply through the Secretariat with your business registration, TIN, and proof of Guyanese ownership.`,
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
      content: `## Your Rights Under the LCA\n\nAs a worker in Guyana's petroleum sector, the LCA provides specific protections.\n\n## First Consideration (Section 12)\nEvery employer must give first consideration to qualified Guyanese nationals. This means:\n- Job postings must be advertised locally\n- Guyanese candidates must be evaluated before international candidates\n- Employers must document their hiring rationale\n\n## Equal Pay (Section 18)\nGuyanese nationals must receive the same compensation as non-Guyanese workers performing the same or equivalent work.\n\n## Capacity Development (Section 19)\nEmployers must invest in training and skills development for Guyanese workers, including:\n- On-the-job training\n- Scholarships and bursaries\n- Technology transfer programs\n\n## Penalties for Non-Compliance\n- Fines: GY$1,000,000 to GY$50,000,000\n- False submissions: Criminal offense under Section 23\n- The Secretariat can audit at any time`,
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
      content: `## The Stabroek Block\n\nGuyana's petroleum industry is centered on the Stabroek Block, operated by ExxonMobil Guyana Limited with Hess and CNOOC as co-venturers.\n\n## Key Facts\n- First oil: December 2019 (Liza Phase 1)\n- Current production: 600,000+ barrels per day\n- Multiple FPSOs operating: Liza Destiny, Liza Unity, Prosperity, Yellowtail\n- Estimated recoverable resources: 11+ billion barrels\n\n## Major Companies in Guyana\n- **Operators**: ExxonMobil, Hess, CNOOC, TotalEnergies, CGX\n- **Service Companies**: Halliburton, SLB, Baker Hughes, TechnipFMC, Saipem\n- **Support**: GYSBI (shore base), SBM Offshore (FPSOs), Stena Drilling\n\n## Economic Impact\n- Thousands of direct and indirect jobs\n- Growing local supply chain\n- Sovereign wealth fund (Natural Resource Fund)\n\n## Your Role\nWhether you're a job seeker, supplier, or compliance professional, understanding this ecosystem is key to participating in Guyana's economic transformation.`,
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
  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, userRole: users.userRole, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(500);
  const recentSignups = allUsers.filter(u => u.createdAt && new Date(u.createdAt) > sevenDaysAgo);
  const filers = allUsers.filter(u => u.userRole?.includes("filer"));
  const seekers = allUsers.filter(u => u.userRole?.includes("job_seeker"));
  const suppliers = allUsers.filter(u => u.userRole?.includes("supplier"));

  // Tenants
  const allTenants = await db.select({
    id: tenants.id, name: tenants.name, plan: tenants.plan, trialEndsAt: tenants.trialEndsAt,
    stripeSubscriptionId: tenants.stripeSubscriptionId, createdAt: tenants.createdAt,
  }).from(tenants).orderBy(desc(tenants.createdAt)).limit(200);
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

export async function fetchSecretariatDashboard() {
  const { officeId } = await getSecretariatContext();

  // Get all submissions (all tenants, all periods that are submitted)
  const submissions = await db.select({
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
  })
    .from(reportingPeriods)
    .innerJoin(entities, eq(reportingPeriods.entityId, entities.id))
    .innerJoin(tenants, eq(reportingPeriods.tenantId, tenants.id))
    .where(eq(reportingPeriods.status, "submitted"))
    .orderBy(desc(reportingPeriods.submittedAt))
    .limit(100);

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
  const ctx = await getSecretariatContext();
  if (ctx.role !== "admin") throw new Error("Only secretariat admins can add members");

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("User not found — they must register first");

  // Update user role to include secretariat
  const [userData] = await db.select({ userRole: users.userRole }).from(users).where(eq(users.id, user.id)).limit(1);
  const currentRole = userData?.userRole || "";
  if (!currentRole.includes("secretariat")) {
    const newRole = currentRole ? `${currentRole},secretariat` : "secretariat";
    await db.update(users).set({ userRole: newRole }).where(eq(users.id, user.id));
  }

  await db.insert(secretariatMembers).values({ officeId, userId: user.id, role });
}

export async function fetchSubmissionDetail(periodId: string) {
  await getSecretariatContext(); // auth check

  const [period] = await db.select().from(reportingPeriods)
    .where(eq(reportingPeriods.id, periodId)).limit(1);
  if (!period) throw new Error("Submission not found");

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

  // All submitted periods with data
  const allSubmitted = await db.select({
    id: reportingPeriods.id,
    entityId: reportingPeriods.entityId,
    tenantId: reportingPeriods.tenantId,
  }).from(reportingPeriods)
    .where(eq(reportingPeriods.status, "submitted"))
    .limit(500);

  const allExp = await db.select().from(expenditureRecords).limit(5000);
  const allEmp = await db.select().from(employmentRecords).limit(5000);

  // Aggregate LC rate across all filers
  const totalSpend = allExp.reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const guySpend = allExp.filter(e => !!e.supplierCertificateId).reduce((s, e) => s + Number(e.actualPayment || 0), 0);
  const overallLcRate = totalSpend > 0 ? Math.round((guySpend / totalSpend) * 1000) / 10 : 0;

  // Aggregate employment
  const totalEmp = allEmp.reduce((s, e) => s + (e.totalEmployees || 0), 0);
  const guyEmp = allEmp.reduce((s, e) => s + (e.guyanaeseEmployed || 0), 0);

  // Unique filers
  const uniqueTenants = new Set(allSubmitted.map(p => p.tenantId)).size;
  const uniqueEntities = new Set(allSubmitted.map(p => p.entityId)).size;

  return {
    totalSubmissions: allSubmitted.length,
    uniqueFilers: uniqueTenants,
    uniqueEntities: uniqueEntities,
    overallLcRate,
    totalExpenditure: totalSpend,
    guyaneseExpenditure: guySpend,
    totalEmployees: totalEmp,
    guyaneseEmployees: guyEmp,
    employmentPct: totalEmp > 0 ? Math.round((guyEmp / totalEmp) * 1000) / 10 : 0,
  };
}

// ─── SECRETARIAT: MISSING FILERS ─────────────────────────────────

export async function fetchFilingCompliance(fiscalYear: number, reportType: string) {
  await getSecretariatContext();

  // Get ALL entities that should file (all active entities across all tenants)
  const allEntities = await db.select({
    id: entities.id,
    legalName: entities.legalName,
    companyType: entities.companyType,
    tenantName: tenants.name,
    tenantId: entities.tenantId,
  }).from(entities)
    .innerJoin(tenants, eq(entities.tenantId, tenants.id))
    .where(eq(entities.active, true))
    .limit(500);

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
      const { calculateDeadlines } = require("@/lib/compliance/deadlines");
      const deadlines = calculateDeadlines("GY", fiscalYear);
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

// ─── SECRETARIAT: PERIOD COMPARISON ──────────────────────────────

export async function fetchPeriodComparison(entityId: string) {
  await getSecretariatContext();

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

  // Opportunities data
  const opportunities = await db.select().from(lcsOpportunities)
    .orderBy(desc(lcsOpportunities.postedDate)).limit(500);

  // Employment notices
  const empNotices = await db.select().from(lcsEmploymentNotices)
    .orderBy(desc(lcsEmploymentNotices.postedDate)).limit(500);

  // Saved opportunities (engagement metric)
  const saves = await db.select({
    opportunityId: savedOpportunities.opportunityId,
  }).from(savedOpportunities).limit(2000);

  // Job seeker stats
  const seekers = await db.select({
    id: jobSeekerProfiles.id,
    employmentCategory: jobSeekerProfiles.employmentCategory,
    isGuyanese: jobSeekerProfiles.isGuyanese,
    educationLevel: jobSeekerProfiles.educationLevel,
    profileVisible: jobSeekerProfiles.profileVisible,
    yearsExperience: jobSeekerProfiles.yearsExperience,
    locationPreference: jobSeekerProfiles.locationPreference,
  }).from(jobSeekerProfiles).limit(1000);

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
      tier: profile.tier || "free",
      serviceCategories: profile.serviceCategories || [],
      profileViews: profile.profileViews || 0,
      responsesThisMonth: profile.responsesThisMonth || 0,
      capabilityStatement: profile.capabilityStatement,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      employeeCount: profile.employeeCount,
      yearEstablished: profile.yearEstablished,
      isGuyaneseOwned: profile.isGuyaneseOwned,
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
  yearEstablished?: number; isGuyaneseOwned?: boolean; website?: string;
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
    tier: profile.tier || "free",
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
