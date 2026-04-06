"use client";
import { useStepCompletion } from "@/hooks/useStepCompletion";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowRight, Receipt, Users, GraduationCap, FileText, Send } from "lucide-react";
import { format } from "date-fns";
import { fetchEntity, fetchPeriod } from "@/server/actions";
import Link from "next/link";
import type { PeriodStatus } from "@/types/database.types";

export default function PeriodOverviewPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const completedSteps = useStepCompletion(periodId);
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
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="company_info" completedSteps={completedSteps} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

        {/* Next Steps */}
        <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">Next Steps</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Expenditure", description: "Record supplier payments", icon: Receipt, href: "expenditure", step: "expenditure" },
            { label: "Employment", description: "Enter workforce data", icon: Users, href: "employment", step: "employment" },
            { label: "Capacity", description: "Log training activities", icon: GraduationCap, href: "capacity", step: "capacity" },
            { label: "Review & Export", description: "Validate and submit", icon: Send, href: "review", step: "review" },
          ].map((item) => {
            const done = completedSteps.includes(item.step);
            return (
              <Link key={item.href} href={`/dashboard/entities/${entityId}/periods/${periodId}/${item.href}`}>
                <Card className={`hover:border-accent/30 transition-colors cursor-pointer h-full ${done ? "border-success/20 bg-success-light/30" : ""}`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${done ? "bg-success-light" : "bg-bg-primary"}`}>
                      <item.icon className={`h-5 w-5 ${done ? "text-success" : "text-text-muted"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-muted">{item.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-text-muted shrink-0 mt-1" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
