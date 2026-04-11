"use client";

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";
import { useState } from "react";

interface ComplianceCalendarProps {
  deadlines: DeadlineWithStatus[];
}

const STATUS_STYLES: Record<string, string> = {
  overdue: "border-l-danger text-danger",
  due_soon: "border-l-warning text-warning",
  on_track: "border-l-success text-success",
  completed: "border-l-text-muted text-text-muted line-through",
};

const DOT_COLORS: Record<string, string> = {
  overdue: "bg-danger",
  due_soon: "bg-warning",
  on_track: "bg-success",
  completed: "bg-text-muted",
};

export function ComplianceCalendar({ deadlines }: ComplianceCalendarProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(today));

  const sortedDeadlines = [...deadlines].sort(
    (a, b) => a.due_date.getTime() - b.due_date.getTime()
  );

  // Build calendar grid
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  function getDeadlinesForDay(date: Date) {
    return deadlines.filter(d => isSameDay(d.due_date, date));
  }

  function getWorstStatus(dayDeadlines: DeadlineWithStatus[]): string | null {
    if (dayDeadlines.length === 0) return null;
    const priority = ["overdue", "due_soon", "on_track", "completed"];
    for (const p of priority) {
      if (dayDeadlines.some(d => d.status === p)) return p;
    }
    return dayDeadlines[0].status;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Compliance Calendar</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {/* Mini calendar grid */}
        <div className="mb-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setViewMonth(m => startOfMonth(addDays(m, -1)))}
              className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="text-xs font-semibold text-text-primary">
              {format(viewMonth, "MMMM yyyy")}
            </p>
            <button
              onClick={() => setViewMonth(m => startOfMonth(addDays(endOfMonth(m), 1)))}
              className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-text-muted py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="space-y-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((date, di) => {
                  const inMonth = isSameMonth(date, viewMonth);
                  const isToday = isSameDay(date, today);
                  const dayDeadlines = getDeadlinesForDay(date);
                  const worstStatus = getWorstStatus(dayDeadlines);

                  return (
                    <div
                      key={di}
                      className={cn(
                        "flex flex-col items-center py-1 rounded text-xs",
                        !inMonth && "opacity-25",
                        isToday && "bg-accent/10"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 flex items-center justify-center rounded-full text-[11px]",
                          isToday && "bg-accent text-white font-semibold",
                          !isToday && inMonth && "text-text-primary",
                          !isToday && !inMonth && "text-text-muted"
                        )}
                      >
                        {format(date, "d")}
                      </span>
                      {worstStatus && (
                        <span
                          className={cn(
                            "w-1 h-1 rounded-full mt-0.5",
                            DOT_COLORS[worstStatus] || "bg-text-muted"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {[
              { status: "overdue", label: "Overdue" },
              { status: "due_soon", label: "Due soon" },
              { status: "on_track", label: "On track" },
            ].map(({ status, label }) => (
              <div key={status} className="flex items-center gap-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", DOT_COLORS[status])} />
                <span className="text-[10px] text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-3" />

        {/* List */}
        {sortedDeadlines.length === 0 ? (
          <p className="text-sm text-text-muted py-2 text-center">No upcoming deadlines</p>
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
