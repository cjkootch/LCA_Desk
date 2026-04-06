"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { UsageBanner } from "@/components/billing/UsageBanner";
import { Menu } from "lucide-react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />

      <main className="flex-1 lg:ml-60 min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-text-secondary hover:text-text-primary"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo-full.png" alt="LCA Desk" className="h-7" />
        </div>
        <div className="px-4 sm:px-8 pt-4"><UsageBanner /></div>
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
