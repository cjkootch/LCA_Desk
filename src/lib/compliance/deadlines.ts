import type { ComplianceDeadline, DeadlineWithStatus, DeadlineStatus } from "@/types/jurisdiction.types";
import { differenceInDays } from "date-fns";

export function calculateDeadlines(
  jurisdictionCode: string,
  year: number
): ComplianceDeadline[] {
  if (jurisdictionCode === "GY") {
    return [
      {
        type: "half_yearly_h1",
        label: "H1 Half-Yearly Report",
        period_start: new Date(year, 0, 1),
        period_end: new Date(year, 5, 30),
        due_date: new Date(year, 6, 30),
        days_warning: 30,
      },
      {
        type: "half_yearly_h2",
        label: "H2 Half-Yearly Report",
        period_start: new Date(year, 6, 1),
        period_end: new Date(year, 11, 31),
        due_date: new Date(year + 1, 0, 30),
        days_warning: 30,
      },
      {
        type: "annual_plan",
        label: "Annual Local Content Plan",
        period_start: new Date(year, 0, 1),
        period_end: new Date(year, 11, 31),
        due_date: new Date(year - 1, 10, 1),
        days_warning: 45,
      },
      {
        type: "performance_report",
        label: "Annual Performance Report",
        period_start: new Date(year - 1, 0, 1),
        period_end: new Date(year - 1, 11, 31),
        due_date: new Date(year, 1, 14),
        days_warning: 21,
      },
    ];
  }

  if (jurisdictionCode === "NG") {
    return [
      {
        type: "annual_nigerian_content",
        label: "Annual Nigerian Content Report",
        period_start: new Date(year, 0, 1),
        period_end: new Date(year, 11, 31),
        due_date: new Date(year + 1, 2, 31), // March 31 following year
        days_warning: 45,
      },
      {
        type: "quarterly_q1",
        label: "Q1 Quarterly Report",
        period_start: new Date(year, 0, 1),
        period_end: new Date(year, 2, 31),
        due_date: new Date(year, 3, 30), // April 30
        days_warning: 21,
      },
      {
        type: "quarterly_q2",
        label: "Q2 Quarterly Report",
        period_start: new Date(year, 3, 1),
        period_end: new Date(year, 5, 30),
        due_date: new Date(year, 6, 31), // July 31
        days_warning: 21,
      },
      {
        type: "quarterly_q3",
        label: "Q3 Quarterly Report",
        period_start: new Date(year, 6, 1),
        period_end: new Date(year, 8, 30),
        due_date: new Date(year, 9, 31), // October 31
        days_warning: 21,
      },
      {
        type: "quarterly_q4",
        label: "Q4 Quarterly Report",
        period_start: new Date(year, 9, 1),
        period_end: new Date(year, 11, 31),
        due_date: new Date(year + 1, 0, 31), // January 31
        days_warning: 21,
      },
    ];
  }

  return [];
}

export function getDeadlineStatus(dueDate: Date, isCompleted: boolean): DeadlineStatus {
  if (isCompleted) return "completed";

  const today = new Date();
  const daysRemaining = differenceInDays(dueDate, today);

  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 14) return "due_soon";
  return "on_track";
}

export function enrichDeadline(
  deadline: ComplianceDeadline,
  isCompleted: boolean,
  entityId?: string,
  entityName?: string
): DeadlineWithStatus {
  const today = new Date();
  const days_remaining = differenceInDays(deadline.due_date, today);
  const status = getDeadlineStatus(deadline.due_date, isCompleted);

  return {
    ...deadline,
    status,
    days_remaining,
    entity_id: entityId,
    entity_name: entityName,
  };
}

export function getUpcomingDeadlines(
  jurisdictionCode: string,
  year: number,
  daysAhead: number = 90
): ComplianceDeadline[] {
  const deadlines = calculateDeadlines(jurisdictionCode, year);
  const today = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return deadlines.filter(
    (d) => d.due_date >= today && d.due_date <= cutoff
  );
}
