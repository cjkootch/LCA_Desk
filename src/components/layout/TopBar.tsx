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
  const [plan, setPlan] = useState<string>("starter");

  useEffect(() => {
    fetchPlanAndUsage()
      .then((d) => setPlan(d.plan))
      .catch(() => {});
  }, []);

  const planConfig = getPlan(plan);
  const showUpgrade = planConfig.code !== "enterprise";

  return (
    <header className="flex items-center justify-between h-16 px-8 border-b border-border bg-bg-surface">
      <div>
        <h1 className="text-lg font-heading font-semibold text-text-primary">{title}</h1>
        {description && (
          <p className="text-sm text-text-secondary">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {showUpgrade && (
          <Link href="/dashboard/settings/billing">
            <Button variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent-light">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Upgrade
              <Badge variant="accent" className="ml-1.5 text-[10px] px-1.5 py-0">
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
