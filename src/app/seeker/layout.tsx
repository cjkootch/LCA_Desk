"use client";

import { useState, useEffect } from "react";
import { SeekerSidebar } from "@/components/seeker/SeekerSidebar";
import { SeekerTour } from "@/components/onboarding/SeekerTour";
import { PlatformBriefing, SEEKER_BRIEFING } from "@/components/onboarding/PlatformBriefing";
import { Menu } from "lucide-react";
import { SessionProvider } from "next-auth/react";

function SeekerShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [briefingActive, setBriefingActive] = useState(false);

  useEffect(() => {
    const handler = () => setBriefingActive(true);
    window.addEventListener("start-briefing", handler);
    return () => window.removeEventListener("start-briefing", handler);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary" style={{ paddingTop: "var(--demo-banner-h, 0px)" }}>
      <SeekerSidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {/* Mobile header */}
      <div className="lg:hidden sticky z-30 flex items-center h-14 px-4 border-b border-border bg-bg-surface/95 backdrop-blur-sm" style={{ top: "var(--demo-banner-h, 0px)" }}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-2 text-sm font-heading font-semibold text-text-primary">LCA Desk</span>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="lg:ml-60 min-h-screen">
        {children}
      </main>
      <SeekerTour />
      {briefingActive && (
        <PlatformBriefing
          steps={SEEKER_BRIEFING}
          onComplete={() => {
            localStorage.setItem("seeker-briefing-completed", "true");
            setBriefingActive(false);
          }}
        />
      )}
    </div>
  );
}

export default function SeekerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SeekerShell>{children}</SeekerShell>
    </SessionProvider>
  );
}
