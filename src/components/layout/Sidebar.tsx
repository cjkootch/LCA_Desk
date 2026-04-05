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
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg flex flex-col">
      {/* Logo */}
      <div className="flex items-center h-16 px-5 border-b border-white/10">
        <Link href="/dashboard">
          <Image src="/logo-full.png" alt="LCA Desk" width={140} height={40} priority />
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
                  ? "bg-sidebar-active text-sidebar-text"
                  : "text-sidebar-text-muted hover:text-sidebar-text hover:bg-sidebar-hover"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

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
      </nav>

      {/* User menu */}
      <div className="border-t border-white/10 px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sidebar-text text-sm font-bold">
            {profile?.full_name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-text truncate">
              {profile?.full_name || "User"}
            </p>
            <p className="text-xs text-sidebar-text-muted truncate">{profile?.email || ""}</p>
          </div>
          <button onClick={signOut} className="text-sidebar-text-muted hover:text-red-300 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
