"use client";

import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComplianceCalendar } from "@/components/dashboard/ComplianceCalendar";
import { calculateDeadlines, enrichDeadline } from "@/lib/compliance/deadlines";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";

export default function CalendarPage() {
  const currentYear = new Date().getFullYear();
  const deadlines = calculateDeadlines("GY", currentYear);
  const nextYearDeadlines = calculateDeadlines("GY", currentYear + 1);

  const allDeadlines: DeadlineWithStatus[] = [
    ...deadlines.map((d) => enrichDeadline(d, false)),
    ...nextYearDeadlines.map((d) => enrichDeadline(d, false)),
  ].sort((a, b) => a.due_date.getTime() - b.due_date.getTime());

  return (
    <div>
      <TopBar title="Compliance Calendar" />
      <div className="p-8 max-w-4xl">
        <PageHeader
          title="Compliance Calendar"
          description="All filing deadlines for the current and upcoming fiscal year."
        />
        <ComplianceCalendar deadlines={allDeadlines} />
      </div>
    </div>
  );
}
