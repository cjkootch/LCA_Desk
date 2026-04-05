"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import type { Entity, ReportingPeriod, PeriodStatus } from "@/types/database.types";

export default function PeriodOverviewPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [period, setPeriod] = useState<ReportingPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const [entityRes, periodRes] = await Promise.all([
        supabase.from("entities").select("*").eq("id", entityId).single(),
        supabase.from("reporting_periods").select("*").eq("id", periodId).single(),
      ]);
      setEntity(entityRes.data);
      setPeriod(periodRes.data);
      setLoading(false);
    };
    fetchData();
  }, [entityId, periodId, supabase]);

  if (loading || !entity || !period) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title={`${entity.legal_name} — ${period.report_type.replace(/_/g, " ").toUpperCase()}`} />
      <div className="p-8">
        <PageHeader
          title="Filing Workflow"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Entities", href: "/dashboard/entities" },
            { label: entity.legal_name, href: `/dashboard/entities/${entityId}` },
            { label: "Filing" },
          ]}
        />

        <PeriodChecklist
          entityId={entityId}
          periodId={periodId}
          currentStep="company_info"
          completedSteps={[]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Legal Name</span>
                  <span className="font-medium">{entity.legal_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">LCS Certificate</span>
                  <span className="font-mono text-xs">{entity.lcs_certificate_id || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Company Type</span>
                  <span className="capitalize">{entity.company_type || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Petroleum Agreement</span>
                  <span>{entity.petroleum_agreement_ref || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reporting Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Period</span>
                  <span>
                    {format(new Date(period.period_start), "MMM d")} –{" "}
                    {format(new Date(period.period_end), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Due Date</span>
                  <span>{format(new Date(period.due_date), "MMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Fiscal Year</span>
                  <span>{period.fiscal_year || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Status</span>
                  <StatusBadge status={period.status as PeriodStatus} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
