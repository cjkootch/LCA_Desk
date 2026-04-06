"use client";

import Link from "next/link";
import { ArrowRight, Clock, Building2, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Entity } from "@/types/database.types";
import { differenceInDays, format } from "date-fns";
import { calculateDeadlines } from "@/lib/compliance/deadlines";

interface PortfolioCardProps {
  entity: Entity;
}

const COMPANY_TYPE_VARIANT: Record<string, "default" | "accent" | "warning" | "gold"> = {
  contractor: "accent",
  subcontractor: "warning",
  licensee: "gold",
};

export function PortfolioCard({ entity }: PortfolioCardProps) {
  // Calculate next deadline for this entity
  const currentYear = new Date().getFullYear();
  const deadlines = calculateDeadlines("GY", currentYear);
  const today = new Date();
  const nextDeadline = deadlines
    .filter((d) => d.due_date > today)
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())[0];

  const daysToDeadline = nextDeadline
    ? differenceInDays(nextDeadline.due_date, today)
    : null;

  // Certificate status
  let certStatus: "valid" | "expiring" | "expired" | "none" = "none";
  if (entity.lcs_certificate_expiry) {
    const expiry = new Date(entity.lcs_certificate_expiry);
    const daysToExpiry = differenceInDays(expiry, today);
    if (daysToExpiry < 0) certStatus = "expired";
    else if (daysToExpiry < 30) certStatus = "expiring";
    else certStatus = "valid";
  }

  const certVariant = {
    valid: "success" as const,
    expiring: "warning" as const,
    expired: "danger" as const,
    none: "default" as const,
  };

  return (
    <Card className="hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-accent-light">
            <Building2 className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm">{entity.legal_name}</h3>
            {entity.trading_name && (
              <p className="text-xs text-text-muted">t/a {entity.trading_name}</p>
            )}
          </div>
        </div>
        {entity.company_type && (
          <Badge variant={COMPANY_TYPE_VARIANT[entity.company_type] || "default"}>
            {entity.company_type}
          </Badge>
        )}
      </div>

      <div className="space-y-2.5 text-sm mb-4">
        {/* LCS Certificate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Shield className="h-3.5 w-3.5" />
            <span>LCS Certificate</span>
          </div>
          {entity.lcs_certificate_id ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-text-primary">{entity.lcs_certificate_id}</span>
              <Badge variant={certVariant[certStatus]}>
                {certStatus === "valid" ? "Active" : certStatus === "expiring" ? "Expiring" : certStatus === "expired" ? "Expired" : ""}
              </Badge>
            </div>
          ) : (
            <Link href={`/dashboard/entities/${entity.id}`} className="text-accent text-xs hover:text-accent-hover font-medium">
              Add certificate &rarr;
            </Link>
          )}
        </div>

        {/* Ownership */}
        {entity.guyanese_ownership_pct !== null && (
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Guyanese Ownership</span>
            <span className="font-medium text-text-primary">{entity.guyanese_ownership_pct}%</span>
          </div>
        )}

        {/* Next Deadline */}
        {nextDeadline && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-text-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>Next Deadline</span>
            </div>
            <div className="text-right">
              <span className={daysToDeadline !== null && daysToDeadline < 14 ? "text-warning font-medium" : "text-text-secondary"}>
                {format(nextDeadline.due_date, "MMM d, yyyy")}
              </span>
              {daysToDeadline !== null && (
                <span className="text-text-muted text-xs ml-1">({daysToDeadline}d)</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border">
        <Link href={`/dashboard/entities/${entity.id}`}>
          <Button variant="secondary" size="sm" className="w-full">
            Manage Entity
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
