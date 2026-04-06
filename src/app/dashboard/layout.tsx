import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { isInTrial } from "@/lib/plans";
import { DashboardShell } from "./DashboardShell";

// Pages that bypass the trial paywall
const PAYWALL_BYPASS = [
  "/dashboard/trial-expired",
  "/dashboard/settings/billing",
  "/dashboard/settings",
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Trial paywall — only enforced when NEXT_PUBLIC_ENFORCE_PAYWALL=true
  if (process.env.NEXT_PUBLIC_ENFORCE_PAYWALL === "true") {
    const session = await auth();
    if (session?.user?.id) {
      const membership = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, session.user.id),
        with: { tenant: true },
      });

      if (membership?.tenant) {
        const plan = (membership.tenant.plan as string) || "free";
        const trialActive = isInTrial(membership.tenant.trialEndsAt);
        const hasPaid = plan === "lite" || plan === "pro" || plan === "enterprise";

        if (!trialActive && !hasPaid) {
          // Check current path — allow billing and trial-expired pages through
          const headersList = await headers();
          const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";

          const isBypassed = PAYWALL_BYPASS.some(p => pathname.startsWith(p));
          if (!isBypassed) {
            redirect("/dashboard/trial-expired");
          }
        }
      }
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
