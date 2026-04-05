"use client";

import { useState } from "react";
import { Building2, FileText, AlertTriangle, TrendingUp, X, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";
import { format } from "date-fns";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  valueColor?: string;
  onClick?: () => void;
  clickable?: boolean;
}

function StatCard({ label, value, icon: Icon, color = "text-accent", valueColor, onClick, clickable }: StatCardProps) {
  return (
    <Card
      className={cn(
        "flex items-center gap-4 p-5",
        clickable && "cursor-pointer hover:border-accent/30 transition-colors"
      )}
      onClick={onClick}
    >
      <div className={cn("p-3 rounded-lg bg-bg-primary", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className={cn("text-2xl font-bold", valueColor || "text-text-primary")}>{value}</p>
      </div>
    </Card>
  );
}

interface StatsBarProps {
  totalEntities: number;
  reportsDueThisMonth: number;
  overdueReports: number;
  avgLocalContentRate: number;
  overdueDeadlines?: DeadlineWithStatus[];
  dueSoonDeadlines?: DeadlineWithStatus[];
}

export function StatsBar({
  totalEntities,
  reportsDueThisMonth,
  overdueReports,
  avgLocalContentRate,
  overdueDeadlines = [],
  dueSoonDeadlines = [],
}: StatsBarProps) {
  const [showOverdue, setShowOverdue] = useState(false);
  const [showDueSoon, setShowDueSoon] = useState(false);

  return (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Entities" value={totalEntities} icon={Building2} />
        <StatCard
          label="Reports Due This Month"
          value={reportsDueThisMonth}
          icon={FileText}
          color="text-warning"
          clickable={reportsDueThisMonth > 0}
          onClick={() => reportsDueThisMonth > 0 && setShowDueSoon(!showDueSoon)}
        />
        <StatCard
          label="Overdue Reports"
          value={overdueReports}
          icon={AlertTriangle}
          color="text-danger"
          valueColor={overdueReports > 0 ? "text-danger" : undefined}
          clickable={overdueReports > 0}
          onClick={() => overdueReports > 0 && setShowOverdue(!showOverdue)}
        />
        <StatCard
          label="Avg Local Content Rate"
          value={`${avgLocalContentRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="text-gold"
          valueColor="text-gold"
        />
      </div>

      {/* Overdue reports panel */}
      {showOverdue && overdueDeadlines.length > 0 && (
        <Card className="border-danger/20 bg-danger-light p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-danger flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue Reports — Take Action
            </h3>
            <button onClick={() => setShowOverdue(false)} className="text-text-muted hover:text-text-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {overdueDeadlines.map((d, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-danger/10">
                <div>
                  <p className="font-medium text-text-primary text-sm">{d.label}</p>
                  <p className="text-xs text-text-muted">
                    {d.entity_name} — Due {format(d.due_date, "MMM d, yyyy")}
                    <Badge variant="danger" className="ml-2">{Math.abs(d.days_remaining)}d overdue</Badge>
                  </p>
                </div>
                {d.entity_id && (
                  <Link href={`/dashboard/entities/${d.entity_id}`}>
                    <Button size="sm" variant="danger">
                      Start Filing <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Due soon reports panel */}
      {showDueSoon && dueSoonDeadlines.length > 0 && (
        <Card className="border-warning/20 bg-warning-light p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-warning flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reports Due Soon
            </h3>
            <button onClick={() => setShowDueSoon(false)} className="text-text-muted hover:text-text-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {dueSoonDeadlines.map((d, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-warning/10">
                <div>
                  <p className="font-medium text-text-primary text-sm">{d.label}</p>
                  <p className="text-xs text-text-muted">
                    {d.entity_name} — Due {format(d.due_date, "MMM d, yyyy")}
                    <Badge variant="warning" className="ml-2">{d.days_remaining}d remaining</Badge>
                  </p>
                </div>
                {d.entity_id && (
                  <Link href={`/dashboard/entities/${d.entity_id}`}>
                    <Button size="sm">
                      Start Filing <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
