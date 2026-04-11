"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  CheckCircle, AlertTriangle, Clock, XCircle, Building2,
  ChevronRight, ExternalLink, Shield, Mail, Phone, Globe,
  FileText, TrendingUp,
} from "lucide-react";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { fetchFilingCompliance, fetchEntityFilingProfile } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" | "accent"; icon: typeof CheckCircle }> = {
  submitted: { label: "Submitted", variant: "success", icon: CheckCircle },
  acknowledged: { label: "Acknowledged", variant: "success", icon: CheckCircle },
  in_progress: { label: "In Progress", variant: "default", icon: Clock },
  review: { label: "In Review", variant: "accent", icon: Clock },
  not_started: { label: "Not Filed", variant: "warning", icon: AlertTriangle },
  overdue: { label: "Overdue", variant: "danger", icon: XCircle },
};

const REPORT_LABEL: Record<string, string> = {
  half_yearly_h1: "H1 Half-Yearly",
  half_yearly_h2: "H2 Half-Yearly",
  annual_plan: "Annual Plan",
  performance_report: "Performance Report",
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

type FilingItem = { entityId: string; entityName: string; companyType: string | null; tenantName: string; status: string; periodId: string | null; submittedAt: Date | null };

export default function CompliancePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [reportType, setReportType] = useState("half_yearly_h1");

  // Expanded entity detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [entityDetail, setEntityDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    setExpandedId(null);
    setEntityDetail(null);
    fetchFilingCompliance(parseInt(year), reportType)
      .then(setData)
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [year, reportType]);

  const toggleEntity = async (entityId: string) => {
    if (expandedId === entityId) {
      setExpandedId(null);
      setEntityDetail(null);
      return;
    }
    setExpandedId(entityId);
    setEntityDetail(null);
    setDetailLoading(true);
    try {
      const detail = await fetchEntityFilingProfile(entityId);
      setEntityDetail(detail);
    } catch { toast.error("Failed to load entity details"); }
    setDetailLoading(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-heading font-bold text-text-primary">Filing Compliance</h1>
        <InfoTooltip title="Filing Compliance" content="All registered entities (contractors, sub-contractors, licensees) in your jurisdiction and their filing status for the selected period. Click any entity to see their full filing history and compliance details." />
      </div>
      <p className="text-sm text-text-secondary mb-4">Track which companies have filed and who is overdue</p>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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
          {data.filingStatus.map((f: FilingItem) => {
            const cfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.not_started;
            const Icon = cfg.icon;
            const isExpanded = expandedId === f.entityId;

            return (
              <div key={f.entityId}>
                <Card
                  className={cn(
                    "cursor-pointer transition-all hover:border-accent/30",
                    f.status === "overdue" && "border-danger/20",
                    isExpanded && "border-accent/40 shadow-md"
                  )}
                  onClick={() => toggleEntity(f.entityId)}
                >
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
                      <ChevronRight className={cn("h-4 w-4 text-text-muted transition-transform", isExpanded && "rotate-90")} />
                    </div>
                  </CardContent>
                </Card>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <Card className="mt-1 border-accent/20">
                    <CardContent className="p-4">
                      {detailLoading ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
                        </div>
                      ) : entityDetail ? (
                        <div className="space-y-4">
                          {/* Company overview row */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-semibold text-text-primary">{entityDetail.entity.legalName}</h3>
                                {entityDetail.entity.companyType && (
                                  <Badge variant="default" className="text-xs">{entityDetail.entity.companyType}</Badge>
                                )}
                              </div>
                              {entityDetail.entity.tradingName && (
                                <p className="text-xs text-text-muted mt-0.5">t/a {entityDetail.entity.tradingName}</p>
                              )}
                              <p className="text-xs text-text-muted mt-0.5">Filed by {entityDetail.tenant.name}</p>
                            </div>
                            <Link href={`/secretariat/compliance/${f.entityId}`}>
                              <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                                <ExternalLink className="h-3.5 w-3.5" /> View Full Profile
                              </Button>
                            </Link>
                          </div>

                          {/* Key details grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {entityDetail.entity.lcsCertificateId && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Shield className="h-3.5 w-3.5 text-accent" />
                                <span className="text-text-muted">LCS:</span>
                                <span className="font-medium text-text-primary font-mono">{entityDetail.entity.lcsCertificateId}</span>
                              </div>
                            )}
                            {entityDetail.latestLcRate !== null && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                                <span className="text-text-muted">LC Rate:</span>
                                <span className={cn("font-bold", entityDetail.latestLcRate >= 50 ? "text-success" : "text-danger")}>{entityDetail.latestLcRate}%</span>
                              </div>
                            )}
                            {entityDetail.entity.contactEmail && (
                              <div className="flex items-center gap-1.5 text-xs truncate">
                                <Mail className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                <span className="truncate text-text-secondary">{entityDetail.entity.contactEmail}</span>
                              </div>
                            )}
                            {entityDetail.entity.contactPhone && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="h-3.5 w-3.5 text-text-muted" />
                                <span className="text-text-secondary">{entityDetail.entity.contactPhone}</span>
                              </div>
                            )}
                          </div>

                          {/* Filing history */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-3.5 w-3.5 text-text-muted" />
                              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Filing History ({entityDetail.submittedFilings}/{entityDetail.totalFilings} submitted)
                              </p>
                            </div>
                            {entityDetail.filingHistory.length === 0 ? (
                              <p className="text-xs text-text-muted py-2">No filing periods found for this entity.</p>
                            ) : (
                              <div className="border border-border-light rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-bg-primary text-text-muted">
                                      <th className="text-left px-3 py-2 font-medium">Period</th>
                                      <th className="text-left px-3 py-2 font-medium">Type</th>
                                      <th className="text-left px-3 py-2 font-medium">Status</th>
                                      <th className="text-right px-3 py-2 font-medium">Submitted</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entityDetail.filingHistory.map((h: { id: string; reportType: string; fiscalYear: number; status: string; submittedAt: string | null; dueDate: string | null }) => {
                                      const hCfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.not_started;
                                      return (
                                        <tr key={h.id} className="border-t border-border-light hover:bg-bg-primary/50">
                                          <td className="px-3 py-2 font-medium text-text-primary">FY {h.fiscalYear}</td>
                                          <td className="px-3 py-2 text-text-secondary">{REPORT_LABEL[h.reportType] || h.reportType.replace(/_/g, " ")}</td>
                                          <td className="px-3 py-2"><Badge variant={hCfg.variant} className="text-[11px]">{hCfg.label}</Badge></td>
                                          <td className="px-3 py-2 text-right text-text-muted">
                                            {h.submittedAt
                                              ? new Date(h.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                              : h.dueDate ? `Due ${new Date(h.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "—"
                                            }
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted text-center py-4">Unable to load details.</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
