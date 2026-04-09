"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  CheckCircle, AlertTriangle, Clock, XCircle, Building2,
} from "lucide-react";
import { fetchFilingCompliance } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default"; icon: typeof CheckCircle }> = {
  submitted: { label: "Submitted", variant: "success", icon: CheckCircle },
  in_progress: { label: "In Progress", variant: "default", icon: Clock },
  not_started: { label: "Not Filed", variant: "warning", icon: AlertTriangle },
  overdue: { label: "Overdue", variant: "danger", icon: XCircle },
};

export default function CompliancePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [reportType, setReportType] = useState("half_yearly_h1");

  const loadData = () => {
    setLoading(true);
    fetchFilingCompliance(parseInt(year), reportType)
      .then(setData)
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [year, reportType]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Filing Compliance</h1>
      <p className="text-sm text-text-secondary mb-6">Track which companies have filed and who is overdue</p>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Select value={reportType} onChange={e => setReportType(e.target.value)} options={[
          { value: "half_yearly_h1", label: "H1 Half-Yearly" },
          { value: "half_yearly_h2", label: "H2 Half-Yearly" },
          { value: "annual_plan", label: "Annual Plan" },
          { value: "performance_report", label: "Performance Report" },
        ]} />
        <Select value={year} onChange={e => setYear(e.target.value)} options={
          [currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => ({ value: String(y), label: String(y) }))
        } />
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{data.stats.total}</p>
            <p className="text-xs text-text-muted">Expected Filers</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{data.stats.submitted}</p>
            <p className="text-xs text-text-muted">Submitted</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-danger">{data.stats.overdue}</p>
            <p className="text-xs text-text-muted">Overdue</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{data.stats.notStarted}</p>
            <p className="text-xs text-text-muted">Not Filed</p>
          </Card>
        </div>
      )}

      {/* Company list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : !data || data.filingStatus.length === 0 ? (
        <EmptyState icon={Building2} title="No registered entities" description="Entities will appear once companies register on LCA Desk." />
      ) : (
        <div className="space-y-2">
          {data.filingStatus.map((f: { entityId: string; entityName: string; companyType: string | null; tenantName: string; status: string; submittedAt: Date | null }) => {
            const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.not_started;
            const Icon = cfg.icon;
            return (
              <Card key={f.entityId} className={cn(f.status === "overdue" ? "border-danger/20" : "")}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={cn("h-4 w-4 shrink-0",
                      f.status === "submitted" ? "text-success" :
                      f.status === "overdue" ? "text-danger" :
                      f.status === "in_progress" ? "text-accent" : "text-warning"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{f.entityName}</p>
                      <p className="text-xs text-text-muted">{f.tenantName} · {f.companyType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.submittedAt && (
                      <span className="text-xs text-text-muted">
                        {new Date(f.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
