"use client";

import { differenceInDays, format } from "date-fns";
import { cn } from "@/lib/utils";

interface DeadlineCountdownProps {
  dueDate: Date;
  className?: string;
}

export function DeadlineCountdown({ dueDate, className }: DeadlineCountdownProps) {
  const today = new Date();
  const daysRemaining = differenceInDays(dueDate, today);

  let color = "text-success";
  let label = `${daysRemaining} days`;

  if (daysRemaining < 0) {
    color = "text-danger";
    label = `${Math.abs(daysRemaining)} days overdue`;
  } else if (daysRemaining <= 14) {
    color = "text-warning";
    label = `${daysRemaining} days left`;
  } else {
    label = `${daysRemaining} days left`;
  }

  return (
    <div className={cn("text-sm", className)}>
      <span className={cn("font-semibold", color)}>{label}</span>
      <span className="text-text-muted ml-2">Due {format(dueDate, "MMM d, yyyy")}</span>
    </div>
  );
}
