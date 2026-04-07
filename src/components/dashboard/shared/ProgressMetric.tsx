"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressMetricProps {
  label: string;
  value: number;
  max?: number;
  suffix?: string;
  threshold?: number;
  className?: string;
}

export function ProgressMetric({ label, value, max = 100, suffix = "%", threshold, className }: ProgressMetricProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const meetsThreshold = threshold ? value >= threshold : true;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className={cn("text-sm font-bold", meetsThreshold ? "text-success" : "text-warning")}>
          {typeof value === "number" ? value.toFixed(1) : value}{suffix}
          {threshold && <span className="text-text-muted font-normal text-xs ml-1">(min {threshold}{suffix})</span>}
        </span>
      </div>
      <Progress value={Math.min(pct, 100)} className="h-2" indicatorClassName={meetsThreshold ? "bg-success" : "bg-warning"} />
    </div>
  );
}
