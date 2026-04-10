"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, DollarSign, Gift, Settings, LogOut, X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SessionProvider } from "next-auth/react";

/* eslint-disable @next/next/no-img-element */

const NAV_ITEMS = [
  { label: "Dashboard", href: "/affiliate/dashboard", icon: LayoutDashboard },
  { label: "Referrals", href: "/affiliate/referrals", icon: Gift },
  { label: "Earnings", href: "/affiliate/earnings", icon: DollarSign },
  { label: "Settings", href: "/affiliate/settings", icon: Settings },
];

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary" style={{ paddingTop: "var(--demo-banner-h, 0px)" }}>
      <aside
        className="fixed z-40 w-60 bg-[#1a1a2e] flex flex-col transition-all duration-200 lg:left-0"
        style={{ top: "var(--demo-banner-h, 0px)", height: "calc(100vh - var(--demo-banner-h, 0px))", left: sidebarOpen ? 0 : undefined }}
        data-open={sidebarOpen}
      >
        <style>{`aside[data-open="false"] { left: -15rem; } @media (min-width: 1024px) { aside[data-open] { left: 0 !important; } }`}</style>

        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <Link href="/affiliate/dashboard" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo-white.svg" alt="LCA Desk" width={140} height={40} priority />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Gift className="h-3.5 w-3.5 text-gold" />
            <span className="text-sm font-medium uppercase tracking-wider text-gold/60">Affiliate Portal</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-gold/20 text-gold" : "text-white/50 hover:text-white hover:bg-white/5"
                )}>
                <item.icon className="h-4 w-4" />{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || "Affiliate"}</p>
              <p className="text-xs text-white/50 truncate">{profile?.email || ""}</p>
            </div>
            <button onClick={signOut} className="text-white/50 hover:text-red-300 transition-colors shrink-0">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
        <div className="flex items-center">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 text-sm font-heading font-semibold text-text-primary">Affiliate</span>
        </div>
        <NotificationBell />
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="lg:ml-60 min-h-screen relative">
        <div className="hidden lg:flex fixed top-3 right-4 z-20">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
