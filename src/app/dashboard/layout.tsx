import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { tenantMembers } from "@/server/db/schema";
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

  const membership = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, session.user.id),
    with: { tenant: true },
  });

  if (!membership?.tenant) redirect("/auth/login");

  const { tenant } = membership;
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
