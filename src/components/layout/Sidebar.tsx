"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Calendar, Settings, Shield, LogOut, Sparkles, Crown, Truck, Users2, X, Briefcase, Megaphone, LifeBuoy, Factory, BarChart3, Receipt, UserSearch, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserContext } from "@/server/actions";
import { getPlan } from "@/lib/plans";

interface NavSection {
  label?: string;
  items: { label: string; href: string; icon: React.ElementType }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Compliance",
    items: [
      { label: "Entities", href: "/dashboard/entities", icon: Building2 },
      { label: "Log Payment", href: "/dashboard/log-payment", icon: Receipt },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
      { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Employees", href: "/dashboard/employees", icon: Users2 },
      { label: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
      { label: "Talent Pool", href: "/dashboard/talent", icon: UserSearch },
    ],
  },
  {
    label: "Market",
    items: [
      { label: "Opportunities", href: "/dashboard/opportunities", icon: Megaphone },
      { label: "Verified Companies", href: "/dashboard/companies", icon: Factory },
      { label: "Suppliers", href: "/dashboard/suppliers", icon: Truck },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Training", href: "/dashboard/training", icon: GraduationCap },
      { label: "LCA Expert", href: "/dashboard/expert", icon: Sparkles },
      { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ isOpen, onNavigate }: { isOpen?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [planCode, setPlanCode] = useState("lite");

  useEffect(() => {
    fetchUserContext().then((ctx) => {
      if (ctx?.isSuperAdmin) setIsSuperAdmin(true);
      if (ctx?.tenant?.plan) setPlanCode(ctx.tenant.plan as string);
    }).catch(() => {});
  }, []);

  return (
    <aside
      className="fixed top-0 z-40 h-screen w-60 bg-sidebar-bg flex flex-col transition-all duration-200 lg:left-0"
      style={{ left: isOpen ? 0 : undefined }}
      data-open={isOpen}
    >
      <style>{`
        aside[data-open="false"] { left: -15rem; }
        @media (min-width: 1024px) { aside[data-open] { left: 0 !important; } }
      `}</style>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
        <Link href="/dashboard" onClick={onNavigate}>
          <Image src="/logo-white-lca.png" alt="LCA Desk" width={140} height={40} priority />
        </Link>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden text-sidebar-text-muted hover:text-sidebar-text p-1">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? "pt-3" : ""}>
            {section.label && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-active text-sidebar-text"
                      : "text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {isSuperAdmin && (
          <Link
            href="/dashboard/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/dashboard/admin")
                ? "bg-sidebar-active text-sidebar-text"
                : "text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}
      </nav>

      {/* Upgrade CTA */}
      {getPlan(planCode).code !== "enterprise" && (
        <div className="px-3 pb-2">
          <Link
            href="/dashboard/settings/billing"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-white/10 hover:bg-white/15 transition-colors"
          >
            <Crown className="h-4 w-4 text-gold" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-text">Upgrade to {getPlan(planCode).code === "lite" ? "Professional" : "Enterprise"}</p>
              <p className="text-[10px] text-sidebar-text-muted">{getPlan(planCode).displayName} plan</p>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-gold" />
          </Link>
        </div>
      )}

      {/* User menu */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <Link href="/dashboard/settings" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sidebar-text text-sm font-bold shrink-0">
              {profile?.full_name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-text truncate">
                {profile?.full_name || "User"}
              </p>
              <p className="text-xs text-sidebar-text-muted truncate">{profile?.email || ""}</p>
            </div>
          </Link>
          <button onClick={signOut} className="text-sidebar-text-muted hover:text-red-300 transition-colors shrink-0">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
