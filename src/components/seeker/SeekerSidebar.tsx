"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, FileText, Megaphone, Bookmark, User, Settings, LogOut, X, Sparkles, GraduationCap, Bell, Briefcase, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface NavSection { label?: string; items: { label: string; href: string; icon: React.ElementType }[] }

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/seeker/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Jobs",
    items: [
      { label: "Find Jobs", href: "/seeker/jobs", icon: Search },
      { label: "Opportunities", href: "/seeker/opportunities", icon: Briefcase },
      { label: "My Applications", href: "/seeker/applications", icon: FileText },
      { label: "Saved", href: "/seeker/saved", icon: Bookmark },
    ],
  },
  {
    label: "Career",
    items: [
      { label: "My Profile", href: "/seeker/profile", icon: User },
      { label: "Resume Builder", href: "/seeker/resume", icon: Sparkles },
      { label: "Learn", href: "/seeker/learn", icon: GraduationCap },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Referrals", href: "/seeker/referrals", icon: Gift },
      { label: "Notifications", href: "/seeker/notifications", icon: Bell },
      { label: "Support", href: "/seeker/support", icon: LifeBuoy },
    { label: "Settings", href: "/seeker/settings", icon: Settings },
    ],
  },
];

export function SeekerSidebar({ isOpen, onNavigate }: { isOpen?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <aside
      className="fixed z-40 w-60 bg-sidebar-bg flex flex-col transition-all duration-200 lg:left-0"
      style={{ top: "var(--demo-banner-h, 0px)", height: "calc(100vh - var(--demo-banner-h, 0px))", left: isOpen ? 0 : undefined }}
      data-open={isOpen}
    >
      <style>{`
        aside[data-open="false"] { left: -15rem; }
        @media (min-width: 1024px) { aside[data-open] { left: 0 !important; } }
      `}</style>

      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
        <Link href="/seeker/dashboard" onClick={onNavigate}>
          <Image src="/logo-white.svg" alt="LCA Desk" width={140} height={40} priority />
        </Link>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden text-sidebar-text-muted hover:text-sidebar-text p-1">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Portal badge */}
      <div className="px-5 py-3 border-b border-white/10">
        <span className="text-sm font-medium uppercase tracking-wider text-sidebar-text-muted">
          Job Seeker Portal
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-text-muted/50">{section.label}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => {
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
            </div>
          </div>
        ))}
      </nav>

      {/* User menu */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <Link href="/seeker/settings" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sidebar-text text-sm font-bold shrink-0 overflow-hidden">
              {profile?.id ? (
                <img src={`/api/avatar?id=${profile.id}`} alt="" className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.textContent = profile?.full_name?.charAt(0) || "U"; }} />
              ) : (profile?.full_name?.charAt(0) || "U")}
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
