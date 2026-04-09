"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Bell, AlertTriangle, Clock, Shield, FileText, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  generateDeadlineNotifications,
} from "@/server/actions";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  deadline_overdue: { icon: AlertTriangle, color: "text-danger" },
  deadline_warning: { icon: Clock, color: "text-warning" },
  cert_expiring: { icon: Shield, color: "text-warning" },
  report_submitted: { icon: FileText, color: "text-success" },
  team_invite: { icon: Bell, color: "text-accent" },
  plan_limit: { icon: Bell, color: "text-gold" },
};

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Awaited<ReturnType<typeof fetchNotifications>>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const settingsHref = pathname?.startsWith("/secretariat") ? "/secretariat/settings"
    : pathname?.startsWith("/seeker") ? "/seeker/settings"
    : pathname?.startsWith("/supplier-portal") ? "/supplier-portal/settings"
    : "/dashboard/settings";

  // Generate notifications and fetch count on mount
  useEffect(() => {
    generateDeadlineNotifications()
      .then(() => fetchUnreadCount())
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  // Load full list when dropdown opens
  useEffect(() => {
    if (open && !loaded) {
      fetchNotifications(30)
        .then((data) => {
          setNotifs(data);
          setLoaded(true);
        })
        .catch(() => {});
    }
  }, [open, loaded]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-border bg-bg-card shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-text-primary text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">No notifications yet</p>
              </div>
            ) : (
              notifs.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.plan_limit;
                const Icon = config.icon;

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-border-light hover:bg-bg-primary transition-colors",
                      !n.read && "bg-accent-light/50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mt-1 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.read) handleMarkRead(n.id);
                            setOpen(false);
                          }}
                          className="block"
                        >
                          <p className={cn("text-sm", !n.read ? "font-medium text-text-primary" : "text-text-secondary")}>
                            {n.title}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.message}</p>
                        </Link>
                      ) : (
                        <>
                          <p className={cn("text-sm", !n.read ? "font-medium text-text-primary" : "text-text-secondary")}>
                            {n.title}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.message}</p>
                        </>
                      )}
                      <p className="text-xs text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 p-1 text-text-muted hover:text-accent"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border">
            <Link
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Notification settings →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
