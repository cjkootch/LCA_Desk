"use client";

import { useEffect, useState } from "react";
import { fetchActiveAnnouncements } from "@/server/actions";
import { X, Megaphone, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnouncementBannerProps {
  userRole: "filer" | "supplier" | "seeker" | "secretariat";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Announcement = any;

export function AnnouncementBanner({ userRole }: AnnouncementBannerProps) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load dismissed IDs from localStorage
    try {
      const stored = localStorage.getItem("lca-dismissed-announcements");
      if (stored) setDismissed(new Set(JSON.parse(stored)));
    } catch {}

    fetchActiveAnnouncements(userRole)
      .then(setItems)
      .catch(() => {});
  }, [userRole]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try { localStorage.setItem("lca-dismissed-announcements", JSON.stringify([...next])); } catch {}
  };

  const visible = items.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a: Announcement) => {
        const isUrgent = a.priority === "urgent";
        const isImportant = a.priority === "important";

        return (
          <div
            key={a.id}
            className={cn(
              "rounded-lg border px-4 py-3 flex items-start gap-3",
              isUrgent && "bg-danger/5 border-danger/20",
              isImportant && "bg-warning/5 border-warning/20",
              !isUrgent && !isImportant && "bg-accent/5 border-accent/20"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg shrink-0 mt-0.5",
              isUrgent && "bg-danger/10",
              isImportant && "bg-warning/10",
              !isUrgent && !isImportant && "bg-accent/10"
            )}>
              {isUrgent ? (
                <AlertTriangle className="h-4 w-4 text-danger" />
              ) : isImportant ? (
                <AlertTriangle className="h-4 w-4 text-warning" />
              ) : (
                <Megaphone className="h-4 w-4 text-accent" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-semibold",
                isUrgent ? "text-danger" : isImportant ? "text-warning" : "text-text-primary"
              )}>
                {a.title}
              </p>
              <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-line">{a.body}</p>
              {a.authorName && (
                <p className="text-xs text-text-muted mt-1">
                  — {a.authorName}, Local Content Secretariat
                </p>
              )}
            </div>

            {!isUrgent && (
              <button onClick={() => dismiss(a.id)} className="text-text-muted hover:text-text-secondary shrink-0 mt-0.5">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
