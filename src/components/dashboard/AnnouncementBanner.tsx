"use client";

import { useEffect, useState } from "react";
import { fetchActiveAnnouncements } from "@/server/actions";
import { X, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
/* eslint-disable @next/next/no-img-element */

interface AnnouncementBannerProps {
  userRole: "filer" | "supplier" | "seeker" | "secretariat";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Announcement = any;

const CATEGORY_ILLUSTRATIONS: Record<string, string> = {
  filing: "/filing-illustration.svg",
  upgrade: "/upgrade-illustration.svg",
  training: "/training-illustration.svg",
  policy: "/policy-illustration.svg",
  general: "/general-illustration.svg",
};

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
    <div className="space-y-3 mb-3">
      {visible.map((a: Announcement) => {
        const isUrgent = a.priority === "urgent";
        const isImportant = a.priority === "important";

        // Urgent = red-tinted banner, important = amber-tinted, normal = dark teal
        const bgClass = isUrgent
          ? "bg-gradient-to-r from-red-900 to-red-800"
          : isImportant
          ? "bg-gradient-to-r from-amber-900 to-amber-800"
          : "bg-gradient-to-r from-[#1a3a4a] to-[#2a4f5f]";

        return (
          <div
            key={a.id}
            className={cn(
              "relative rounded-xl overflow-hidden",
              bgClass
            )}
          >
            <div className="flex items-center">
              {/* Text content */}
              <div className="flex-1 min-w-0 px-5 py-4 sm:px-6 sm:py-5">
                {isUrgent && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
                    <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">Urgent</span>
                  </div>
                )}
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {a.title}
                </h3>
                <p className="text-sm text-white/70 mt-1 leading-relaxed max-w-xl whitespace-pre-line">
                  {a.body}
                </p>
                {a.ctaUrl ? (
                  <a href={a.ctaUrl} className="inline-flex items-center gap-1 mt-2.5 text-sm font-semibold text-white underline underline-offset-2 decoration-white/40 hover:decoration-white transition-colors">
                    {a.ctaLabel || "Learn more"} <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                ) : a.authorName ? (
                  <div className="flex items-center gap-1.5 mt-3">
                    <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
                      {a.authorId ? (
                        <img src={`/api/avatar?id=${a.authorId}`} alt="" className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.textContent = a.authorName?.charAt(0) || "S"; }} />
                      ) : (
                        <span className="text-[10px] font-bold text-white/80">{a.authorName?.charAt(0)}</span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">
                      {a.authorName}, Local Content Secretariat
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Illustration — changes based on announcement category */}
              {!isUrgent && (
                <div className="hidden sm:block shrink-0 w-36 md:w-44 self-stretch relative">
                  <img
                    src={CATEGORY_ILLUSTRATIONS[a.category] || CATEGORY_ILLUSTRATIONS.general}
                    alt=""
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-28 md:h-32 w-auto opacity-80 pointer-events-none select-none"
                  />
                </div>
              )}
            </div>

            {/* Dismiss button */}
            {!isUrgent && (
              <button
                onClick={() => dismiss(a.id)}
                className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
