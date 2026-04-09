"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { fetchPlanAndUsage } from "@/server/actions";
import { getPlan } from "@/lib/plans";

interface TopBarProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function TopBar({ title, description, action }: TopBarProps) {
  const [plan, setPlan] = useState<string>("lite");

  useEffect(() => {
    fetchPlanAndUsage()
      .then((d) => setPlan(d.plan))
      .catch(() => {});
  }, []);

  const planConfig = getPlan(plan);
  const showUpgrade = planConfig.code !== "enterprise";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 sm:h-16 px-4 sm:px-8 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-heading font-semibold text-text-primary truncate">{title}</h1>
        {description && (
          <p className="text-sm text-text-secondary hidden sm:block">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {showUpgrade && (
          <Link href="/dashboard/settings/billing">
            <Button variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent-light">
              <Sparkles className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Upgrade</span>
              <Badge variant="accent" className="ml-1.5 text-xs px-1.5 py-0">
                {planConfig.name}
              </Badge>
            </Button>
          </Link>
        )}
        <NotificationBell />
        {action && (
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
