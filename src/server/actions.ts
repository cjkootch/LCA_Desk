"use server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import {
  entities,
  reportingPeriods,
  expenditureRecords,
  employmentRecords,
  capacityDevelopmentRecords,
  narrativeDrafts,
  submissionLogs,
  tenantMembers,
  sectorCategories,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

async function getSessionTenant() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: { with: { jurisdiction: true } } },
  });

  if (!membership) throw new Error("No tenant found");

  return {
    userId: session.user.id,
    tenantId: membership.tenantId,
    tenant: membership.tenant,
    role: membership.role,
  };
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

export async function addEntity(data: {
  legal_name: string;
  trading_name?: string;
  registration_number?: string;
  lcs_certificate_id?: string;
  lcs_certificate_expiry?: string;
  petroleum_agreement_ref?: string;
  company_type: string;
  guyanese_ownership_pct?: number;
  registered_address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
}) {
  const { tenantId, tenant } = await getSessionTenant();
  const [entity] = await db
    .insert(entities)
    .values({
      tenantId,
      jurisdictionId: tenant.jurisdictionId,
      legalName: data.legal_name,
      tradingName: data.trading_name || null,
      registrationNumber: data.registration_number || null,
      lcsCertificateId: data.lcs_certificate_id || null,
      lcsCertificateExpiry: data.lcs_certificate_expiry || null,
      petroleumAgreementRef: data.petroleum_agreement_ref || null,
      companyType: data.company_type,
      guyanaeseOwnershipPct: data.guyanese_ownership_pct?.toString() || null,
      registeredAddress: data.registered_address || null,
      contactName: data.contact_name || null,
      contactEmail: data.contact_email || null,
      contactPhone: data.contact_phone || null,
    })
    .returning();
  return entity;
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

export async function markPeriodSubmitted(periodId: string) {
  const { tenantId, userId } = await getSessionTenant();
  const [updated] = await db
    .update(reportingPeriods)
    .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(reportingPeriods.id, periodId),
        eq(reportingPeriods.tenantId, tenantId)
      )
    )
    .returning();

  if (updated) {
    await db.insert(submissionLogs).values({
      reportingPeriodId: periodId,
      entityId: updated.entityId,
      tenantId,
      submittedBy: userId,
      submissionMethod: "email",
      submittedToEmail: "localcontent@nre.gov.gy",
      status: "sent",
    });
  }

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
  const { tenantId } = await getSessionTenant();
  const [record] = await db
    .insert(expenditureRecords)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      sectorCategoryId: data.sector_category_id as string,
      supplierName: data.supplier_name as string,
      supplierLcsCertId: (data.supplier_lcs_cert_id as string) || null,
      isGuyaneseSupplier: data.is_guyanese_supplier === true || data.is_guyanese_supplier === "true",
      isSoleSourced: data.is_sole_sourced === true || data.is_sole_sourced === "true",
      soleSourceCode: (data.sole_source_code as string) || null,
      amountLocal: String(data.amount_local),
      amountUsd: data.amount_usd ? String(data.amount_usd) : null,
      currencyCode: "GYD",
      paymentMethod: (data.payment_method as string) || null,
      paymentDate: (data.payment_date as string) || null,
      description: (data.description as string) || null,
    })
    .returning();
  return record;
}

export async function removeExpenditure(id: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .delete(expenditureRecords)
    .where(
      and(eq(expenditureRecords.id, id), eq(expenditureRecords.tenantId, tenantId))
    );
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
  const { tenantId } = await getSessionTenant();
  const [record] = await db
    .insert(employmentRecords)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      jobTitle: data.job_title as string,
      isco08Code: (data.isco_08_code as string) || null,
      positionType: data.position_type as string,
      isGuyanese: data.is_guyanese === true || data.is_guyanese === "true",
      nationality: (data.nationality as string) || null,
      headcount: Number(data.headcount) || 1,
      remunerationBand: (data.remuneration_band as string) || null,
      totalRemunerationLocal: data.total_remuneration_local
        ? String(data.total_remuneration_local)
        : null,
      contractType: (data.contract_type as string) || null,
    })
    .returning();
  return record;
}

export async function removeEmployment(id: string) {
  const { tenantId } = await getSessionTenant();
  await db
    .delete(employmentRecords)
    .where(
      and(eq(employmentRecords.id, id), eq(employmentRecords.tenantId, tenantId))
    );
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
      activityType: data.activity_type as string,
      activityName: data.activity_name as string,
      providerName: (data.provider_name as string) || null,
      providerType: (data.provider_type as string) || null,
      participantCount: Number(data.participant_count) || 0,
      guyanaeseParticipantCount: Number(data.guyanese_participant_count) || 0,
      startDate: (data.start_date as string) || null,
      endDate: (data.end_date as string) || null,
      totalHours: data.total_hours ? String(data.total_hours) : null,
      costLocal: data.cost_local ? String(data.cost_local) : null,
      costUsd: data.cost_usd ? String(data.cost_usd) : null,
      description: (data.description as string) || null,
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

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: true },
  });

  return {
    user: session.user,
    tenant: membership?.tenant || null,
    role: membership?.role || null,
  };
}
