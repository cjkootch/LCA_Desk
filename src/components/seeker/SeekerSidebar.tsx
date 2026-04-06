"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, FileText, Megaphone, Bookmark, User, Settings, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/seeker/dashboard", icon: LayoutDashboard },
  { label: "Find Jobs", href: "/seeker/jobs", icon: Search },
  { label: "My Applications", href: "/seeker/applications", icon: FileText },
  { label: "Opportunities", href: "/seeker/opportunities", icon: Megaphone },
  { label: "Saved", href: "/seeker/saved", icon: Bookmark },
  { label: "My Profile", href: "/seeker/profile", icon: User },
  { label: "Settings", href: "/seeker/settings", icon: Settings },
];

export function SeekerSidebar({ isOpen, onNavigate }: { isOpen?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

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
        <Link href="/seeker/dashboard" onClick={onNavigate}>
          <Image src="/logo-white-lca.png" alt="LCA Desk" width={140} height={40} priority />
        </Link>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden text-sidebar-text-muted hover:text-sidebar-text p-1">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Portal badge */}
      <div className="px-5 py-3 border-b border-white/10">
        <span className="text-[11px] font-medium uppercase tracking-wider text-sidebar-text-muted">
          Job Seeker Portal
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/seeker/dashboard"
              ? pathname === "/seeker/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
      </nav>

      {/* User menu */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <Link href="/seeker/profile" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
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
