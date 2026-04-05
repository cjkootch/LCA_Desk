"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        style={{ display: sidebarOpen ? "block" : "none" }}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div
        className="fixed inset-y-0 left-0 z-40 lg:translate-x-0 transition-transform duration-200"
        style={{ transform: sidebarOpen ? "translateX(0)" : undefined }}
      >
        {/* On mobile, default is off-screen. On lg+, always visible via lg:translate-x-0 */}
        <style>{`
          @media (max-width: 1023px) {
            .sidebar-wrapper { transform: translateX(-100%); }
            .sidebar-wrapper.open { transform: translateX(0) !important; }
          }
        `}</style>
        <div className={`sidebar-wrapper ${sidebarOpen ? "open" : ""}`}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-60 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-text-secondary hover:text-text-primary"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo-full.png" alt="LCA Desk" className="h-7" />
        </div>
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
