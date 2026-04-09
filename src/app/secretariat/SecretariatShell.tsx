"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FileText, Users, LogOut, X, Menu, Shield, ClipboardCheck, Bot, BarChart3, UserPlus, PieChart, Settings, Megaphone } from "lucide-react";
import { SecretariatTour } from "@/components/onboarding/SecretariatTour";
import { FloatingChatWidget } from "@/components/ai/FloatingChatWidget";
import { Shield as ShieldIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { SessionProvider } from "next-auth/react";

const NAV_ITEMS = [
  { label: "Submissions", href: "/secretariat/dashboard", icon: FileText },
  { label: "Filing Compliance", href: "/secretariat/compliance", icon: ClipboardCheck },
  { label: "Reports", href: "/secretariat/reports", icon: PieChart },
  { label: "Market Intel", href: "/secretariat/market", icon: BarChart3 },
  { label: "LCS Applications", href: "/secretariat/applications", icon: UserPlus },
  { label: "Compliance Analyst", href: "/secretariat/assistant", icon: Bot },
  { label: "Announcements", href: "/secretariat/announcements", icon: Megaphone },
  { label: "Team", href: "/secretariat/team", icon: Users },
  { label: "Settings", href: "/secretariat/settings", icon: Settings },
];

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Sidebar */}
      <aside
        className="fixed top-0 z-40 h-screen w-60 bg-[#1e293b] flex flex-col transition-all duration-200 lg:left-0"
        style={{ left: sidebarOpen ? 0 : undefined }}
        data-open={sidebarOpen}
      >
        <style>{`aside[data-open="false"] { left: -15rem; } @media (min-width: 1024px) { aside[data-open] { left: 0 !important; } }`}</style>

        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <Link href="/secretariat/dashboard" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo-white-lca.png" alt="LCA Desk" width={140} height={40} priority />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gold" />
            <span className="text-sm font-medium uppercase tracking-wider text-white/50">Secretariat Portal</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                )}>
                <item.icon className="h-4 w-4" />{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {profile?.full_name?.charAt(0) || "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || "User"}</p>
              <p className="text-xs text-white/50 truncate">{profile?.email || ""}</p>
            </div>
            <button onClick={signOut} className="text-white/50 hover:text-red-300 transition-colors shrink-0">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center h-14 px-4 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-2 text-sm font-heading font-semibold text-text-primary">Secretariat</span>
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="lg:ml-60 min-h-screen">{children}</main>
      <SecretariatTour />
      <FloatingChatWidget
        endpoint="/api/ai/secretariat-chat"
        title="Compliance Analyst"
        subtitle="Regulatory AI with sector-wide data"
        accentColor="bg-[#1e293b]"
        icon={ShieldIcon}
        quickQuestions={[
          "Which companies are below employment minimums?",
          "Summarize this period's sector compliance posture",
          "What enforcement actions are available for late filers?",
          "Draft amendment request language for incomplete employment data",
          "How many submissions are pending review?",
        ]}
      />
    </div>
  );
}

export function SecretariatShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
