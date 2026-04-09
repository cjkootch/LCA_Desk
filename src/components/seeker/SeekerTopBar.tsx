"use client";

import { NotificationBell } from "@/components/notifications/NotificationBell";

interface SeekerTopBarProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SeekerTopBar({ title, description, action }: SeekerTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 sm:h-16 px-4 sm:px-8 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-heading font-semibold text-text-primary truncate">{title}</h1>
        {description && (
          <p className="text-sm text-text-secondary hidden sm:block">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        <NotificationBell />
      </div>
    </header>
  );
}
