"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { FloatingChatWidget } from "@/components/ai/FloatingChatWidget";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { UsageBanner } from "@/components/billing/UsageBanner";
import { Menu } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { BillingAccess } from "@/lib/plans";

interface DashboardShellProps {
  children: React.ReactNode;
  billingAccess: BillingAccess;
}

const ALLOWED_PATHS = [
  "/dashboard/settings/billing",
  "/dashboard/trial-expired",
  "/dashboard/payment-required",
  "/dashboard/activate",
];

export function DashboardShell({ children, billingAccess }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAllowedPath = ALLOWED_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!billingAccess.canAccess && !isAllowedPath) {
      if (billingAccess.state === "setup_required") {
        router.replace("/dashboard/activate");
      } else if (billingAccess.state === "trial_expired") {
        router.replace("/dashboard/trial-expired");
      } else if (billingAccess.state === "locked") {
        router.replace(`/dashboard/payment-required?reason=${billingAccess.lockReason || "canceled"}`);
      }
    }
  }, [billingAccess, isAllowedPath, router]);

  if (!billingAccess.canAccess && !isAllowedPath) return null;

  return (
    <div className="flex min-h-screen" style={{ paddingTop: "var(--demo-banner-h, 0px)" }}>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <main className="flex-1 lg:ml-60 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-text-secondary hover:text-text-primary">
              <Menu className="h-5 w-5" />
            </button>
            <img src="/logo-full.svg" alt="LCA Desk" className="h-7" />
          </div>
          <NotificationBell />
        </div>
        {/* Desktop persistent bell */}
        <div className="hidden lg:flex fixed top-3 right-4 z-20">
          <NotificationBell />
        </div>
        <div className="px-4 sm:px-8 pt-4">
          <UsageBanner billingAccess={billingAccess} />
        </div>
        {children}
      </main>
      <OnboardingTour />
      <FloatingChatWidget
        pageContext={pathname || undefined}
        quickQuestions={[
          "What are my filing deadlines?",
          "What's my current LC rate?",
          "Which employment categories am I below minimum?",
          "Help me understand this page",
        ]}
      />
    </div>
  );
}
