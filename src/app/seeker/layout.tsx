"use client";

import { useState, useEffect } from "react";
import { SeekerSidebar } from "@/components/seeker/SeekerSidebar";
import { PlatformBriefing, SEEKER_BRIEFING } from "@/components/onboarding/PlatformBriefing";
import { Menu } from "lucide-react";
import { SessionProvider } from "next-auth/react";
import { markOnboardingComplete } from "@/server/actions";

const SEEKER_BRIEFING_KEY = "seeker-briefing-completed";

function SeekerShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [briefingActive, setBriefingActive] = useState(false);

  // Auto-start the AI briefing for new users who haven't completed it
  useEffect(() => {
    const completed = localStorage.getItem(SEEKER_BRIEFING_KEY);
    if (completed) return;
    const timer = setTimeout(() => setBriefingActive(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Manual trigger (from Support / replay buttons)
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
      {briefingActive && (
        <PlatformBriefing
          steps={SEEKER_BRIEFING}
          onComplete={() => {
            localStorage.setItem(SEEKER_BRIEFING_KEY, "true");
            setBriefingActive(false);
            markOnboardingComplete().catch(() => {});
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
