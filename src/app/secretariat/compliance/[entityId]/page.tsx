"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, Shield, ArrowLeft, Mail, Phone, Globe, MapPin,
  FileText, TrendingUp, Users, Calendar, CheckCircle, Clock,
  AlertTriangle, XCircle,
} from "lucide-react";
import { fetchEntityFilingProfile, fetchPeriodComparison } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" | "accent" }> = {
  submitted: { label: "Submitted", variant: "success" },
  acknowledged: { label: "Acknowledged", variant: "success" },
  in_progress: { label: "In Progress", variant: "default" },
  review: { label: "In Review", variant: "accent" },
  not_started: { label: "Not Started", variant: "warning" },
  overdue: { label: "Overdue", variant: "danger" },
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

export default function EntityProfilePage() {
  const { entityId } = useParams<{ entityId: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comparison, setComparison] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    Promise.all([
      fetchEntityFilingProfile(entityId),
      fetchPeriodComparison(entityId).catch(() => null),
    ])
      .then(([profile, comp]) => { setData(profile); setComparison(comp); })
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  if (!data) return <div className="p-8 text-center text-text-muted">Entity not found.</div>;

  const { entity, tenant, filingHistory, latestLcRate, totalFilings, submittedFilings } = data;
  const certExpired = entity.lcsCertificateExpiry && new Date(entity.lcsCertificateExpiry) < new Date();

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Back link */}
      <Link href="/secretariat/compliance" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Filing Compliance
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-text-primary">{entity.legalName}</h1>
              {entity.tradingName && <p className="text-sm text-text-muted">t/a {entity.tradingName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {entity.companyType && <Badge variant="default">{entity.companyType}</Badge>}
            <span className="text-xs text-text-muted">Filed by {tenant.name}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 text-center">
            <p className={cn("text-2xl font-bold", latestLcRate !== null && latestLcRate >= 50 ? "text-success" : "text-warning")}>{latestLcRate !== null ? `${latestLcRate}%` : "—"}</p>
            <p className="text-xs text-text-muted">LC Rate</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-accent">{submittedFilings}/{totalFilings}</p>
            <p className="text-xs text-text-muted">Reports Filed</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{entity.numberOfEmployees || "—"}</p>
            <p className="text-xs text-text-muted">Employees</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{entity.guyanaeseOwnershipPct ? `${entity.guyanaeseOwnershipPct}%` : "—"}</p>
            <p className="text-xs text-text-muted">GY Ownership</p>
          </Card>
        </div>

        {/* Company details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Company Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {entity.lcsCertificateId && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> LCS Certificate</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-primary">{entity.lcsCertificateId}</span>
                    <Badge variant={certExpired ? "danger" : "success"}>{certExpired ? "Expired" : "Active"}</Badge>
                  </div>
                </div>
              )}
              {entity.lcsCertificateExpiry && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Cert Expiry</span>
                  <span className="text-text-primary">{new Date(entity.lcsCertificateExpiry).toLocaleDateString()}</span>
                </div>
              )}
              {entity.registrationNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Registration #</span>
                  <span className="font-mono text-text-primary">{entity.registrationNumber}</span>
                </div>
              )}
              {entity.contactName && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Contact</span>
                  <span className="text-text-primary">{entity.contactName}</span>
                </div>
              )}
              {entity.contactEmail && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</span>
                  <a href={`mailto:${entity.contactEmail}`} className="text-accent hover:text-accent-hover">{entity.contactEmail}</a>
                </div>
              )}
              {entity.contactPhone && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</span>
                  <span className="text-text-primary">{entity.contactPhone}</span>
                </div>
              )}
              {entity.website && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Website</span>
                  <a href={entity.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover truncate max-w-[200px]">{entity.website}</a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Period-by-period comparison */}
        {comparison && comparison.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Period Comparison</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border border-border-light rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-bg-primary text-text-muted">
                      <th className="text-left px-3 py-2 font-medium">Period</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-right px-3 py-2 font-medium">LC Rate</th>
                      <th className="text-right px-3 py-2 font-medium">Expenditure</th>
                      <th className="text-right px-3 py-2 font-medium">Employees</th>
                      <th className="text-right px-3 py-2 font-medium">GY Employment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c: { periodId: string; label: string; status: string; lcRate: number; totalExpenditure: number; totalEmployees: number; employmentPct: number }) => {
                      const cCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.not_started;
                      return (
                        <tr key={c.periodId} className="border-t border-border-light">
                          <td className="px-3 py-2 font-medium text-text-primary">{c.label}</td>
                          <td className="px-3 py-2"><Badge variant={cCfg.variant} className="text-[11px]">{cCfg.label}</Badge></td>
                          <td className={cn("px-3 py-2 text-right font-bold", c.lcRate >= 50 ? "text-success" : "text-danger")}>{c.lcRate}%</td>
                          <td className="px-3 py-2 text-right text-text-primary">{formatCurrency(c.totalExpenditure)}</td>
                          <td className="px-3 py-2 text-right text-text-primary">{c.totalEmployees}</td>
                          <td className={cn("px-3 py-2 text-right font-bold", c.employmentPct >= 60 ? "text-success" : "text-danger")}>{c.employmentPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full filing history */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Filing History ({submittedFilings}/{totalFilings} submitted)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {filingHistory.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">No filing periods found.</p>
            ) : (
              <div className="border border-border-light rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-bg-primary text-text-muted">
                      <th className="text-left px-3 py-2 font-medium">Period</th>
                      <th className="text-left px-3 py-2 font-medium">Report Type</th>
                      <th className="text-left px-3 py-2 font-medium">Date Range</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-right px-3 py-2 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filingHistory.map((h: { id: string; reportType: string; fiscalYear: number; status: string; submittedAt: string | null; periodStart: string | null; periodEnd: string | null; dueDate: string | null }) => {
                      const hCfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.not_started;
                      return (
                        <tr key={h.id} className="border-t border-border-light hover:bg-bg-primary/50">
                          <td className="px-3 py-2 font-medium text-text-primary">FY {h.fiscalYear}</td>
                          <td className="px-3 py-2 text-text-secondary">{REPORT_LABEL[h.reportType] || h.reportType.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2 text-text-muted">
                            {h.periodStart && h.periodEnd
                              ? `${new Date(h.periodStart).toLocaleDateString("en-US", { month: "short", year: "2-digit" })} – ${new Date(h.periodEnd).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`
                              : "—"
                            }
                          </td>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
