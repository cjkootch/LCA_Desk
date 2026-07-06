import { db } from "@/server/db";
import { reportingPeriods, tenants, tenantMembers, userPurchases, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getBillingAccess } from "@/lib/plans";

/**
 * Server-side gate for report exports. Mirrors the export page UI logic
 * so the paywall can't be bypassed by calling the export API directly.
 *
 * Access is granted when the user's tenant has an active subscription or
 * an active trial (getBillingAccess.canAccess), OR the user has bought a
 * per-report export unlock for this specific period. Demo/super-admin
 * accounts bypass the gate.
 */
export async function hasReportExportAccess(userId: string, periodId: string): Promise<boolean> {
  if (!userId || !periodId) return false;

  // Demo + super-admin bypass so the demo experience and internal use keep working
  const [u] = await db.select({ email: users.email, isSuperAdmin: users.isSuperAdmin })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (u?.isSuperAdmin) return true;
  const email = u?.email || "";
  if (email.startsWith("demo-") && email.endsWith("@lcadesk.com")) return true;

  // Resolve the period -> tenant, and confirm the user belongs to that tenant
  const [period] = await db.select({ tenantId: reportingPeriods.tenantId })
    .from(reportingPeriods).where(eq(reportingPeriods.id, periodId)).limit(1);
  if (!period?.tenantId) return false;

  const [member] = await db.select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, period.tenantId), eq(tenantMembers.userId, userId)))
    .limit(1);
  if (!member) return false;

  // Active subscription or trial?
  const [tenant] = await db.select({
    plan: tenants.plan,
    trialEndsAt: tenants.trialEndsAt,
    stripeSubscriptionId: tenants.stripeSubscriptionId,
    stripeSubscriptionStatus: tenants.stripeSubscriptionStatus,
  }).from(tenants).where(eq(tenants.id, period.tenantId)).limit(1);

  if (tenant) {
    const access = getBillingAccess(tenant.plan, tenant.trialEndsAt, tenant.stripeSubscriptionId, tenant.stripeSubscriptionStatus);
    if (access.canAccess) return true;
  }

  // Per-report one-time purchase for this specific period?
  const [purchase] = await db.select({ id: userPurchases.id })
    .from(userPurchases)
    .where(and(eq(userPurchases.userId, userId), eq(userPurchases.productId, `report_export:${periodId}`)))
    .limit(1);
  return !!purchase;
}
