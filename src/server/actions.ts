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
  users,
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
  const { tenantId, tenant } = await getSessionTenant();
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
  const [period] = await db
    .insert(reportingPeriods)
    .values({
      entityId: data.entity_id,
      tenantId,
      jurisdictionId: data.jurisdiction_id || null,
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
  const { tenantId } = await getSessionTenant();

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

  return recentPeriods.map((p) => ({
    id: p.id,
    type: "period_update" as const,
    entityName: p.entityName,
    reportType: p.reportType,
    status: p.status,
    timestamp: p.updatedAt,
  }));
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
  const { tenantId, tenant } = await getSessionTenant();
  const plan = tenant.plan || "starter";

  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"

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

  // Count entities and team members
  const entityCount = (
    await db
      .select()
      .from(entities)
      .where(and(eq(entities.tenantId, tenantId), eq(entities.active, true)))
  ).length;

  const memberCount = (
    await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId))
  ).length;

  return {
    plan,
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
  const { tenantId } = await getSessionTenant();
  const currentMonth = new Date().toISOString().slice(0, 7);

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
    const newValue = (existing[type] || 0) + 1;
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
