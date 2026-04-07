"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { UsageBanner } from "@/components/billing/UsageBanner";
import { Menu } from "lucide-react";
import type { BillingAccess } from "@/lib/plans";

interface DashboardShellProps {
  children: React.ReactNode;
  billingAccess: BillingAccess;
}

const ALLOWED_PATHS = [
  "/dashboard/settings/billing",
  "/dashboard/trial-expired",
  "/dashboard/payment-required",
];

export function DashboardShell({ children, billingAccess }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAllowedPath = ALLOWED_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!billingAccess.canAccess && !isAllowedPath) {
      if (billingAccess.state === "trial_expired") {
        router.replace("/dashboard/trial-expired");
      } else if (billingAccess.state === "locked") {
        router.replace(`/dashboard/payment-required?reason=${billingAccess.lockReason || "canceled"}`);
      }
    }
  }, [billingAccess, isAllowedPath, router]);

  if (!billingAccess.canAccess && !isAllowedPath) return null;

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <main className="flex-1 lg:ml-60 min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-text-secondary hover:text-text-primary">
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo-full.png" alt="LCA Desk" className="h-7" />
        </div>
        <div className="px-4 sm:px-8 pt-4">
          <UsageBanner billingAccess={billingAccess} />
        </div>
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
