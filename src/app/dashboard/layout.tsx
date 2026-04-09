import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { tenantMembers, tenants } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getBillingAccess } from "@/lib/plans";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const [membership] = await db.select({
    tenantId: tenantMembers.tenantId,
    role: tenantMembers.role,
  }).from(tenantMembers)
    .where(eq(tenantMembers.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/auth/login");

  const [tenant] = await db.select({
    plan: tenants.plan,
    trialEndsAt: tenants.trialEndsAt,
    stripeSubscriptionId: tenants.stripeSubscriptionId,
    stripeSubscriptionStatus: tenants.stripeSubscriptionStatus,
  }).from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);

  if (!tenant) redirect("/auth/login");

  const billingAccess = getBillingAccess(
    tenant.plan,
    tenant.trialEndsAt,
    tenant.stripeSubscriptionId,
    tenant.stripeSubscriptionStatus
  );

  return (
    <DashboardShell billingAccess={billingAccess}>
      {children}
    </DashboardShell>
  );
}
