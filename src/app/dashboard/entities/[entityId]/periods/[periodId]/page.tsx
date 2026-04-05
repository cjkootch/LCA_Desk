"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { fetchEntity, fetchPeriod } from "@/server/actions";
import type { PeriodStatus } from "@/types/database.types";

export default function PeriodOverviewPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entityName, setEntityName] = useState("");
  const [period, setPeriod] = useState<Awaited<ReturnType<typeof fetchPeriod>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchEntity(entityId), fetchPeriod(periodId)])
      .then(([e, p]) => {
        setEntityName(e?.legalName || "");
        setPeriod(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [entityId, periodId]);

  if (loading || !period) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  return (
    <div>
      <TopBar title={`${entityName} — ${period.reportType.replace(/_/g, " ").toUpperCase()}`} />
      <div className="p-8">
        <PageHeader title="Filing Workflow" breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Entities", href: "/dashboard/entities" },
          { label: entityName, href: `/dashboard/entities/${entityId}` },
          { label: "Filing" },
        ]} />
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="company_info" completedSteps={[]} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Legal Name</span><span className="font-medium">{entityName}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Reporting Period</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Period</span><span>{format(new Date(period.periodStart), "MMM d")} – {format(new Date(period.periodEnd), "MMM d, yyyy")}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Due Date</span><span>{format(new Date(period.dueDate), "MMM d, yyyy")}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Status</span><StatusBadge status={period.status as PeriodStatus} /></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
