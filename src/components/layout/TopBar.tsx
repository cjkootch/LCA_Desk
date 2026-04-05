"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function TopBar({ title, description, action }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-16 px-8 border-b border-border bg-bg-surface/50">
      <div>
        <h1 className="text-lg font-heading font-semibold text-text-primary">{title}</h1>
        {description && (
          <p className="text-sm text-text-secondary">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-text-secondary hover:text-text-primary transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-danger rounded-full" />
        </button>
        {action && (
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
