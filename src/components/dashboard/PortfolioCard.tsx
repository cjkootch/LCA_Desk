"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Entity } from "@/types/database.types";

interface PortfolioCardProps {
  entity: Entity;
  currentPeriodLabel?: string;
  localContentRate?: number;
  nextDeadline?: string;
  daysToDeadline?: number;
  periodStatus?: string;
}

const COMPANY_TYPE_VARIANT: Record<string, "default" | "accent" | "warning" | "gold"> = {
  contractor: "accent",
  subcontractor: "warning",
  licensee: "gold",
};

export function PortfolioCard({
  entity,
  currentPeriodLabel = "H1 2026",
  localContentRate = 0,
  nextDeadline,
  daysToDeadline,
  periodStatus = "not_started",
}: PortfolioCardProps) {
  const rateColor =
    localContentRate >= 70 ? "bg-success" : localContentRate >= 50 ? "bg-warning" : "bg-danger";

  return (
    <Card className="hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-text-primary">{entity.legal_name}</h3>
          {entity.trading_name && (
            <p className="text-sm text-text-muted">t/a {entity.trading_name}</p>
          )}
        </div>
        {entity.company_type && (
          <Badge variant={COMPANY_TYPE_VARIANT[entity.company_type] || "default"}>
            {entity.company_type}
          </Badge>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">LCS Cert</span>
          <span className="text-text-primary font-mono text-xs">
            {entity.lcs_certificate_id || "—"}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-text-secondary">Current Period</span>
          <Badge variant="accent">{currentPeriodLabel}</Badge>
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-text-secondary">Local Content Rate</span>
            <span className="text-gold font-bold">{localContentRate.toFixed(1)}%</span>
          </div>
          <Progress value={localContentRate} indicatorClassName={rateColor} />
        </div>

        {nextDeadline && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3 text-text-muted" />
            <span className={daysToDeadline && daysToDeadline < 14 ? "text-warning" : "text-text-muted"}>
              Due {nextDeadline}
              {daysToDeadline !== undefined && ` (${daysToDeadline}d)`}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        <Link href={`/dashboard/entities/${entity.id}`}>
          <Button variant="secondary" size="sm" className="w-full">
            {periodStatus === "not_started" ? "Start Filing" : "Continue Filing"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
