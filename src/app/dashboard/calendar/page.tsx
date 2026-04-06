"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateDeadlines, enrichDeadline } from "@/lib/compliance/deadlines";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";

const STATUS_CONFIG = {
  overdue: { color: "bg-danger", textColor: "text-danger", icon: AlertTriangle, label: "Overdue" },
  due_soon: { color: "bg-warning", textColor: "text-warning", icon: Clock, label: "Due Soon" },
  on_track: { color: "bg-accent", textColor: "text-accent", icon: Calendar, label: "On Track" },
  completed: { color: "bg-success", textColor: "text-success", icon: CheckCircle, label: "Completed" },
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Generate deadlines for current year and next year
  const allDeadlines = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];
    return years.flatMap((year) =>
      calculateDeadlines("GY", year).map((d) => enrichDeadline(d, false))
    );
  }, []);

  // Get deadlines for a specific date
  const getDeadlinesForDate = (date: Date) =>
    allDeadlines.filter((d) => isSameDay(d.due_date, date));

  // Get deadlines for selected date
  const selectedDeadlines = selectedDate ? getDeadlinesForDate(selectedDate) : [];

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Upcoming deadlines list
  const upcoming = allDeadlines
    .filter((d) => d.due_date >= new Date())
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
    .slice(0, 8);

  return (
    <div>
      <TopBar title="Compliance Calendar" description="Track all filing deadlines across your entities" />
      <div className="p-4 sm:p-8">
        <PageHeader title="Compliance Calendar" description="All filing deadlines for the current and upcoming fiscal year." />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar grid */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-4 flex items-center justify-between border-b border-border">
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-heading font-semibold text-text-primary">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-text-muted py-2">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7 gap-1">
                  {weeks.flat().map((date, i) => {
                    const deadlines = getDeadlinesForDate(date);
                    const inMonth = isSameMonth(date, currentMonth);
                    const today = isToday(date);
                    const selected = selectedDate && isSameDay(date, selectedDate);

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          "relative h-16 rounded-lg border text-left p-1.5 transition-colors",
                          inMonth ? "bg-bg-surface" : "bg-bg-primary/50",
                          today && "ring-2 ring-accent",
                          selected && "border-accent bg-accent-light",
                          !selected && "border-transparent hover:border-border",
                          !inMonth && "opacity-40"
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-medium",
                            today ? "text-accent" : inMonth ? "text-text-primary" : "text-text-muted"
                          )}
                        >
                          {format(date, "d")}
                        </span>
                        {deadlines.length > 0 && (
                          <div className="flex gap-0.5 mt-1 flex-wrap">
                            {deadlines.map((d, di) => (
                              <div
                                key={di}
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  STATUS_CONFIG[d.status].color
                                )}
                                title={d.label}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <div className={cn("h-2 w-2 rounded-full", config.color)} />
                      {config.label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected date detail */}
            {selectedDate && (
              <Card className="mt-4">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-text-primary mb-3">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </h3>
                  {selectedDeadlines.length === 0 ? (
                    <p className="text-sm text-text-muted">No deadlines on this date.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDeadlines.map((d, i) => {
                        const config = STATUS_CONFIG[d.status];
                        const Icon = config.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-bg-primary">
                            <Icon className={cn("h-5 w-5 mt-0.5", config.textColor)} />
                            <div>
                              <p className="font-medium text-text-primary text-sm">{d.label}</p>
                              <p className="text-xs text-text-muted mt-0.5">
                                Period: {format(d.period_start, "MMM d")} – {format(d.period_end, "MMM d, yyyy")}
                              </p>
                              <Badge
                                variant={d.status === "overdue" ? "danger" : d.status === "due_soon" ? "warning" : "success"}
                                className="mt-1"
                              >
                                {d.status === "overdue"
                                  ? `${Math.abs(d.days_remaining)} days overdue`
                                  : `${d.days_remaining} days remaining`}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Upcoming deadlines sidebar */}
          <div>
            <Card>
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  Upcoming Deadlines
                </h3>
              </div>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {upcoming.map((d, i) => {
                    const config = STATUS_CONFIG[d.status];
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentMonth(startOfMonth(d.due_date));
                          setSelectedDate(d.due_date);
                        }}
                        className="w-full text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("w-1 h-full min-h-[40px] rounded-full shrink-0", config.color)} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                              {d.label}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {format(d.due_date, "MMMM d, yyyy")}
                            </p>
                            <Badge
                              variant={d.status === "overdue" ? "danger" : d.status === "due_soon" ? "warning" : "default"}
                              className="mt-1"
                            >
                              {d.status === "overdue"
                                ? `${Math.abs(d.days_remaining)}d overdue`
                                : `${d.days_remaining}d`}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick reference */}
            <Card className="mt-4">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-text-primary text-sm">Filing Schedule (Guyana)</h3>
              </div>
              <CardContent className="p-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">H1 Report</span>
                    <span className="text-text-primary font-medium">Jul 30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">H2 Report</span>
                    <span className="text-text-primary font-medium">Jan 30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Annual Plan</span>
                    <span className="text-text-primary font-medium">~Nov 1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Performance Report</span>
                    <span className="text-text-primary font-medium">~Feb 14</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
