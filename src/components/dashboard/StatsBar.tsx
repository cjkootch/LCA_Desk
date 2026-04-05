"use client";

import { Building2, FileText, AlertTriangle, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  valueColor?: string;
}

function StatCard({ label, value, icon: Icon, color = "text-accent", valueColor }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
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
}

export function StatsBar({ totalEntities, reportsDueThisMonth, overdueReports, avgLocalContentRate }: StatsBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard label="Total Entities" value={totalEntities} icon={Building2} />
      <StatCard label="Reports Due This Month" value={reportsDueThisMonth} icon={FileText} color="text-warning" />
      <StatCard
        label="Overdue Reports"
        value={overdueReports}
        icon={AlertTriangle}
        color="text-danger"
        valueColor={overdueReports > 0 ? "text-danger" : undefined}
      />
      <StatCard
        label="Avg Local Content Rate"
        value={`${avgLocalContentRate.toFixed(1)}%`}
        icon={TrendingUp}
        color="text-gold"
        valueColor="text-gold"
      />
    </div>
  );
}
