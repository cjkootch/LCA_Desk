"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  FileText, CheckCircle, Search, Shield, Eye,
  AlertTriangle,
} from "lucide-react";
import { fetchSecretariatDashboard, fetchSecretariatAnalytics, fetchSubmissionDetail, acknowledgeSubmission } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACK_STATUS: Record<string, { label: string; variant: "default" | "accent" | "warning" | "success" | "danger" }> = {
  received: { label: "Received", variant: "default" },
  under_review: { label: "Under Review", variant: "accent" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  amendment_required: { label: "Amendment Required", variant: "warning" },
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function SecretariatDashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ackStatus, setAckStatus] = useState("under_review");
  const [ackRef, setAckRef] = useState("");
  const [ackNotes, setAckNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchSecretariatDashboard(), fetchSecretariatAnalytics()])
      .then(([d, a]) => { setData(d); setAnalytics(a); })
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (periodId: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchSubmissionDetail(periodId);
      setDetailData(detail);
      setAckStatus("under_review");
      setAckRef(""); setAckNotes("");
    } catch { toast.error("Failed to load submission"); }
    setDetailLoading(false);
  };

  const handleAcknowledge = async () => {
    if (!detailData) return;
    setSubmitting(true);
    try {
      await acknowledgeSubmission(detailData.period.id, { status: ackStatus, referenceNumber: ackRef || undefined, notes: ackNotes || undefined });
      toast.success(`Submission ${ACK_STATUS[ackStatus]?.label || ackStatus}`);
      setDetailData(null);
      const fresh = await fetchSecretariatDashboard();
      setData(fresh);
    } catch { toast.error("Failed to update"); }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  if (!data) return <div className="p-8 text-center text-text-muted">Unable to load.</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = data.submissions.filter((s: any) => {
    if (statusFilter !== "all") {
      if (statusFilter === "pending" && s.acknowledgment) return false;
      if (statusFilter !== "pending" && s.acknowledgment?.status !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return s.entityName.toLowerCase().includes(q) || s.tenantName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Regulatory Dashboard</h1>
          <p className="text-sm text-text-secondary">Review submissions and monitor sector compliance</p>
        </div>
      </div>

      {/* Sector-wide stats */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <Card className="p-3 text-center"><p className="text-2xl font-bold">{analytics.totalSubmissions}</p><p className="text-[10px] text-text-muted">Submissions</p></Card>
          <Card className="p-3 text-center"><p className="text-2xl font-bold text-accent">{analytics.uniqueFilers}</p><p className="text-[10px] text-text-muted">Filing Companies</p></Card>
          <Card className="p-3 text-center"><p className={cn("text-2xl font-bold", analytics.overallLcRate >= 50 ? "text-success" : "text-warning")}>{analytics.overallLcRate}%</p><p className="text-[10px] text-text-muted">Sector LC Rate</p></Card>
          <Card className="p-3 text-center"><p className="text-2xl font-bold">{formatCurrency(analytics.totalExpenditure)}</p><p className="text-[10px] text-text-muted">Total Expenditure</p></Card>
          <Card className="p-3 text-center"><p className={cn("text-2xl font-bold", analytics.employmentPct >= 60 ? "text-success" : "text-warning")}>{analytics.employmentPct}%</p><p className="text-[10px] text-text-muted">GY Employment</p></Card>
        </div>
      )}

      {/* Queue stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-3 text-center"><p className="text-xl font-bold">{data.stats.total}</p><p className="text-[10px] text-text-muted">Total</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-bold text-warning">{data.stats.pending}</p><p className="text-[10px] text-text-muted">Pending</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-bold text-success">{data.stats.acknowledged}</p><p className="text-[10px] text-text-muted">Reviewed</p></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input placeholder="Search by company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
          { value: "all", label: "All" }, { value: "pending", label: "Pending" },
          { value: "under_review", label: "Under Review" }, { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" }, { value: "amendment_required", label: "Amendment Required" },
        ]} />
      </div>

      {/* Submissions */}
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No submissions" description="Submitted reports will appear here." />
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {filtered.map((s: any) => {
            const ack = s.acknowledgment;
            const ackCfg = ack ? ACK_STATUS[ack.status] : null;
            return (
              <Card key={s.periodId} className="hover:border-accent/20 transition-colors cursor-pointer" onClick={() => openDetail(s.periodId)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text-primary">{s.entityName}</h3>
                      <p className="text-xs text-text-muted">{s.tenantName} · {s.companyType} · {s.reportType.replace(/_/g, " ").toUpperCase()} FY{s.fiscalYear}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Submitted {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        {ack?.referenceNumber && ` · Ref: ${ack.referenceNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ackCfg ? <Badge variant={ackCfg.variant}>{ackCfg.label}</Badge> : <Badge variant="warning">Pending</Badge>}
                      <Eye className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submission detail dialog */}
      <Dialog open={!!detailData} onOpenChange={open => { if (!open) setDetailData(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
          ) : detailData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-gold" />{detailData.entity.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {/* Period info */}
                <div className="bg-bg-primary rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-text-muted">Report</span><span className="font-medium">{detailData.period.reportType.replace(/_/g, " ")} — FY {detailData.period.fiscalYear}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Period</span><span>{detailData.period.periodStart} to {detailData.period.periodEnd}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Submitted</span><span>{detailData.period.submittedAt ? new Date(detailData.period.submittedAt).toLocaleString() : "—"}</span></div>
                  {detailData.attester && <div className="flex justify-between"><span className="text-text-muted">Attested by</span><span>{detailData.attester.name} ({detailData.attester.email})</span></div>}
                </div>

                {/* Compliance metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 text-center">
                    <p className={cn("text-xl font-bold", detailData.metrics.lcRate >= 50 ? "text-success" : "text-danger")}>{detailData.metrics.lcRate}%</p>
                    <p className="text-[10px] text-text-muted">LC Rate</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className={cn("text-xl font-bold", detailData.metrics.employmentPct >= 60 ? "text-success" : "text-danger")}>{detailData.metrics.employmentPct}%</p>
                    <p className="text-[10px] text-text-muted">GY Employment</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-xl font-bold">{formatCurrency(detailData.metrics.totalExpenditure)}</p>
                    <p className="text-[10px] text-text-muted">Total Spend</p>
                  </Card>
                </div>

                {/* Employment breakdown */}
                <Card><CardContent className="p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Employment by Category</p>
                  {[
                    { key: "managerial", label: "Managerial", min: 75 },
                    { key: "technical", label: "Technical", min: 60 },
                    { key: "nonTechnical", label: "Non-Technical", min: 80 },
                  ].map(cat => {
                    const d = detailData.metrics[cat.key];
                    return (
                      <div key={cat.key} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold", d.pct >= cat.min ? "text-success" : "text-danger")}>{d.pct}%</span>
                          <span className="text-text-muted">({d.guyanese}/{d.total})</span>
                          {d.pct >= cat.min ? <CheckCircle className="h-3 w-3 text-success" /> : <AlertTriangle className="h-3 w-3 text-danger" />}
                        </div>
                      </div>
                    );
                  })}
                </CardContent></Card>

                {/* Record summary */}
                <div className="flex flex-wrap gap-3 text-[11px] text-text-muted">
                  <span>{detailData.metrics.expenditureRecords} expenditure records</span>
                  <span>·</span>
                  <span>{detailData.metrics.employmentRecords} employment records</span>
                  <span>·</span>
                  <span>{detailData.metrics.capacityRecords} capacity records</span>
                  <span>·</span>
                  <span>{detailData.metrics.guyaneseSuppliers} GY / {detailData.metrics.internationalSuppliers} intl suppliers</span>
                </div>

                {/* Attestation */}
                {detailData.period.attestation && (
                  <div className="bg-accent-light rounded-lg p-3 border border-accent/20">
                    <p className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1">Attestation</p>
                    <p className="text-xs text-text-secondary italic">{detailData.period.attestation}</p>
                  </div>
                )}

                {/* History */}
                {detailData.history.length > 1 && (
                  <div>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Filing History</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {detailData.history.map((h: { id: string; reportType: string; fiscalYear: number }) => (
                        <Badge key={h.id} variant={h.id === detailData.period.id ? "accent" : "default"} className="text-[10px]">
                          {h.reportType.replace(/_/g, " ")} {h.fiscalYear}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review */}
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-sm font-semibold text-text-primary">Review Decision</p>
                  <Select value={ackStatus} onChange={e => setAckStatus(e.target.value)} options={[
                    { value: "received", label: "Received" }, { value: "under_review", label: "Under Review" },
                    { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
                    { value: "amendment_required", label: "Amendment Required" },
                  ]} />
                  <Input value={ackRef} onChange={e => setAckRef(e.target.value)} placeholder="Reference Number" />
                  <textarea className="w-full h-16 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" value={ackNotes} onChange={e => setAckNotes(e.target.value)} placeholder="Notes or feedback..." />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDetailData(null)}>Cancel</Button>
                    <Button onClick={handleAcknowledge} loading={submitting}><CheckCircle className="h-4 w-4 mr-1" /> Submit Decision</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
