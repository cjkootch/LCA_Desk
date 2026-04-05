"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Calendar, Settings, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Entities", href: "/dashboard/entities", icon: Building2 },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-border bg-bg-surface flex flex-col">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-border">
        <Link href="/dashboard">
          <Image src="/logo-white.png" alt="LCA Desk" width={120} height={40} priority />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin — conditionally shown */}
        <Link
          href="/dashboard/admin"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/dashboard/admin")
              ? "bg-accent/10 text-accent"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
          )}
        >
          <Shield className="h-4 w-4" />
          Admin
        </Link>
      </nav>

      {/* User menu */}
      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
            {profile?.full_name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {profile?.full_name || "User"}
            </p>
            <p className="text-xs text-text-muted truncate">{profile?.email || ""}</p>
          </div>
          <button onClick={signOut} className="text-text-muted hover:text-danger transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
