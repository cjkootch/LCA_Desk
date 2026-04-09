"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, FileText, BarChart3, UserCog, Settings, LogOut, X, Menu, GraduationCap, Bell } from "lucide-react";
import { SupplierTour } from "@/components/onboarding/SupplierTour";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { SessionProvider } from "next-auth/react";

interface NavSection { label?: string; items: { label: string; href: string; icon: React.ElementType }[] }

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/supplier-portal/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Opportunities", href: "/supplier-portal/opportunities", icon: Briefcase },
      { label: "My Responses", href: "/supplier-portal/responses", icon: FileText },
      { label: "Analytics", href: "/supplier-portal/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Training", href: "/supplier-portal/training", icon: GraduationCap },
      { label: "Company Profile", href: "/supplier-portal/profile", icon: UserCog },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", href: "/supplier-portal/notifications", icon: Bell },
      { label: "Settings", href: "/supplier-portal/settings", icon: Settings },
    ],
  },
];

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary" style={{ paddingTop: "var(--demo-banner-h, 0px)" }}>
      <aside
        className="fixed z-40 w-60 bg-[#1e293b] flex flex-col transition-all duration-200 lg:left-0"
        style={{ top: "var(--demo-banner-h, 0px)", height: "calc(100vh - var(--demo-banner-h, 0px))", left: sidebarOpen ? 0 : undefined }}
        data-open={sidebarOpen}
      >
        <style>{`aside[data-open="false"] { left: -15rem; } @media (min-width: 1024px) { aside[data-open] { left: 0 !important; } }`}</style>

        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <Link href="/supplier-portal/dashboard" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo-white-lca.png" alt="LCA Desk" width={140} height={40} priority />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-accent" />
            <span className="text-sm font-medium uppercase tracking-wider text-white/50">Supplier Portal</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-white/30">{section.label}</p>}
              <div className="space-y-0.5">
                {section.items.map(item => {
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
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <Link href="/supplier-portal/settings" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold shrink-0 overflow-hidden">
                {profile?.id ? (
                  <img src={`/api/avatar?id=${profile.id}`} alt="" className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.textContent = profile?.full_name?.charAt(0) || "S"; }} />
                ) : (profile?.full_name?.charAt(0) || "S")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile?.full_name || "Supplier"}</p>
                <p className="text-xs text-white/50 truncate">{profile?.email || ""}</p>
              </div>
            </Link>
            <button onClick={signOut} className="text-white/50 hover:text-red-300 transition-colors shrink-0">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-30 flex items-center h-14 px-4 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-2 text-sm font-heading font-semibold text-text-primary">Supplier Portal</span>
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <main className="lg:ml-60 min-h-screen">{children}</main>
      <SupplierTour />
    </div>
  );
}

export function SupplierShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
