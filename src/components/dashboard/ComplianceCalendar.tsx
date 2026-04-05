"use client";

import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";

interface ComplianceCalendarProps {
  deadlines: DeadlineWithStatus[];
}

const STATUS_STYLES: Record<string, string> = {
  overdue: "border-l-danger text-danger",
  due_soon: "border-l-warning text-warning",
  on_track: "border-l-success text-success",
  completed: "border-l-text-muted text-text-muted line-through",
};

export function ComplianceCalendar({ deadlines }: ComplianceCalendarProps) {
  const sortedDeadlines = [...deadlines].sort(
    (a, b) => a.due_date.getTime() - b.due_date.getTime()
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Compliance Calendar</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {sortedDeadlines.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">No upcoming deadlines</p>
        ) : (
          <div className="space-y-2">
            {sortedDeadlines.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "border-l-2 pl-3 py-2 text-sm",
                  STATUS_STYLES[d.status] || ""
                )}
              >
                <p className="font-medium text-text-primary">{d.label}</p>
                {d.entity_name && (
                  <p className="text-xs text-text-muted">{d.entity_name}</p>
                )}
                <p className="text-xs mt-0.5">
                  {format(d.due_date, "MMM d, yyyy")} &middot;{" "}
                  {d.status === "overdue"
                    ? `${Math.abs(d.days_remaining)}d overdue`
                    : `${d.days_remaining}d remaining`}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
