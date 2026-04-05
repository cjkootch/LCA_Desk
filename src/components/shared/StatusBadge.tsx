"use client";

import { Badge } from "@/components/ui/badge";
import type { PeriodStatus } from "@/types/database.types";

interface StatusBadgeProps {
  status: PeriodStatus;
}

const STATUS_CONFIG: Record<PeriodStatus, { label: string; variant: "default" | "success" | "warning" | "danger" | "accent" }> = {
  not_started: { label: "Not Started", variant: "default" },
  in_progress: { label: "In Progress", variant: "accent" },
  review: { label: "In Review", variant: "warning" },
  submitted: { label: "Submitted", variant: "success" },
  acknowledged: { label: "Acknowledged", variant: "success" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
