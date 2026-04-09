"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, AlertTriangle, CheckCircle, Clock, FileText,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { fetchSecretariatDeadlines } from "@/server/actions";
import { cn } from "@/lib/utils";

export default function DeadlineCalendarPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(new Date());

  useEffect(() => {
    fetchSecretariatDeadlines().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;
  if (!data) return null;

  const now = new Date();
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Group deadlines by day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byDay: Record<number, any[]> = {};
  data.periods.forEach((p: any) => {
    const d = new Date(p.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(p);
    }
  });

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Filing Deadline Calendar</h1>
          <p className="text-sm text-text-secondary">
            <span className="text-danger font-medium">{data.overdue.length} overdue</span> · {data.upcoming.length} upcoming · {data.submitted.length} submitted
          </p>
        </div>
      </div>

      {/* Overdue alert */}
      {data.overdue.length > 0 && (
        <Card className="border-danger/20 bg-danger/5 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <p className="text-sm font-semibold text-danger">{data.overdue.length} Overdue Filing{data.overdue.length > 1 ? "s" : ""}</p>
            </div>
            <div className="space-y-1.5">
              {data.overdue.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{p.entityName} — {p.reportType.replace(/_/g, " ")} FY{p.fiscalYear}</span>
                  <Badge variant="danger" className="text-xs">Due {new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar header */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-bg-primary"><ChevronLeft className="h-5 w-5" /></button>
            <h2 className="text-lg font-semibold text-text-primary">{monthLabel}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-bg-primary"><ChevronRight className="h-5 w-5" /></button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-text-muted py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const deadlines = byDay[day] || [];
              const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
              const hasOverdue = deadlines.some((d: any) => d.status !== "submitted" && d.status !== "acknowledged" && new Date(d.dueDate) < now);
              const hasUpcoming = deadlines.some((d: any) => d.status !== "submitted" && d.status !== "acknowledged" && new Date(d.dueDate) >= now);
              const hasSubmitted = deadlines.some((d: any) => d.status === "submitted" || d.status === "acknowledged");

              return (
                <div key={day} className={cn(
                  "min-h-[4.5rem] rounded-lg p-1.5 border transition-colors",
                  isToday ? "border-accent bg-accent/5" : "border-transparent hover:bg-bg-primary",
                  hasOverdue && "bg-danger/5 border-danger/20",
                )}>
                  <p className={cn("text-xs font-medium mb-0.5", isToday ? "text-accent" : "text-text-primary")}>{day}</p>
                  {deadlines.slice(0, 3).map((d: any) => (
                    <div key={d.id} className={cn(
                      "text-[10px] leading-tight px-1 py-0.5 rounded mb-0.5 truncate",
                      d.status === "submitted" || d.status === "acknowledged" ? "bg-success/10 text-success" :
                      new Date(d.dueDate) < now ? "bg-danger/10 text-danger" :
                      "bg-warning/10 text-warning"
                    )}>
                      {d.entityName?.split(" ")[0]}
                    </div>
                  ))}
                  {deadlines.length > 3 && <p className="text-[10px] text-text-muted">+{deadlines.length - 3}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming list */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-text-primary mb-3">Upcoming Deadlines</p>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">No upcoming deadlines</p>
          ) : (
            <div className="space-y-2">
              {data.upcoming.slice(0, 20).map((p: any) => {
                const daysLeft = Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{p.entityName}</p>
                      <p className="text-xs text-text-muted">{p.tenantName} · {p.reportType.replace(/_/g, " ")} FY{p.fiscalYear}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={daysLeft <= 7 ? "danger" : daysLeft <= 30 ? "warning" : "default"} className="text-xs">
                        {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                      </Badge>
                      <p className="text-xs text-text-muted mt-0.5">{new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
