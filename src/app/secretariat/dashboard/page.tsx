"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  FileText, CheckCircle, Search, Shield, Eye,
  AlertTriangle, TrendingUp, TrendingDown, Plus, Trash2, Send, Clock,
} from "lucide-react";
import { fetchSecretariatDashboard, fetchSecretariatAnalytics, fetchSubmissionDetail, acknowledgeSubmission, fetchPeriodComparison, createAmendmentRequest, fetchAmendmentRequests } from "@/server/actions";
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

  // Period comparison
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comparison, setComparison] = useState<any[] | null>(null);

  // Amendment requests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [amendments, setAmendments] = useState<any[]>([]);
  const [showAmendmentForm, setShowAmendmentForm] = useState(false);
  const [amendmentItems, setAmendmentItems] = useState<Array<{ section: string; description: string; severity: "critical" | "major" | "minor" }>>([{ section: "", description: "", severity: "major" }]);
  const [amendmentSummary, setAmendmentSummary] = useState("");
  const [amendmentDeadline, setAmendmentDeadline] = useState("");
  const [amendmentSubmitting, setAmendmentSubmitting] = useState(false);
  const [detailTab, setDetailTab] = useState<"review" | "trend" | "amendments">("review");

  useEffect(() => {
    Promise.all([fetchSecretariatDashboard(), fetchSecretariatAnalytics()])
      .then(([d, a]) => { setData(d); setAnalytics(a); })
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (periodId: string) => {
    setDetailLoading(true);
    setDetailTab("review");
    setComparison(null);
    setAmendments([]);
    setShowAmendmentForm(false);
    try {
      const detail = await fetchSubmissionDetail(periodId);
      setDetailData(detail);
      setAckStatus("under_review");
      setAckRef(""); setAckNotes("");
      // Load comparison and amendments in parallel
      Promise.all([
        fetchPeriodComparison(detail.entity.id).then(setComparison).catch(() => {}),
        fetchAmendmentRequests(periodId).then(setAmendments).catch(() => {}),
      ]);
    } catch { toast.error("Failed to load submission"); }
    setDetailLoading(false);
  };

  const handleAmendmentSubmit = async () => {
    if (!detailData) return;
    const validItems = amendmentItems.filter(i => i.section.trim() && i.description.trim());
    if (validItems.length === 0) { toast.error("Add at least one amendment item"); return; }
    if (!amendmentSummary.trim()) { toast.error("Summary required"); return; }
    if (!amendmentDeadline) { toast.error("Deadline required"); return; }
    setAmendmentSubmitting(true);
    try {
      await createAmendmentRequest({
        periodId: detailData.period.id,
        items: validItems,
        summary: amendmentSummary.trim(),
        responseDeadline: amendmentDeadline,
      });
      toast.success("Amendment request sent to filer");
      setShowAmendmentForm(false);
      setAmendmentItems([{ section: "", description: "", severity: "major" }]);
      setAmendmentSummary(""); setAmendmentDeadline("");
      const fresh = await fetchAmendmentRequests(detailData.period.id);
      setAmendments(fresh);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send"); }
    setAmendmentSubmitting(false);
  };

  const addAmendmentItem = () => setAmendmentItems(prev => [...prev, { section: "", description: "", severity: "major" }]);
  const removeAmendmentItem = (idx: number) => setAmendmentItems(prev => prev.filter((_, i) => i !== idx));
  const updateAmendmentItem = (idx: number, field: string, value: string) => setAmendmentItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

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

                {/* Tabs */}
                <div className="border-t border-border pt-3 flex gap-1">
                  {(["review", "trend", "amendments"] as const).map(tab => (
                    <button key={tab} onClick={() => setDetailTab(tab)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        detailTab === tab ? "bg-accent text-white" : "text-text-muted hover:text-text-primary hover:bg-bg-primary"
                      )}>
                      {tab === "review" ? "Review" : tab === "trend" ? "Compliance Trend" : `Amendments${amendments.length > 0 ? ` (${amendments.length})` : ""}`}
                    </button>
                  ))}
                </div>

                {/* Tab: Review */}
                {detailTab === "review" && (
                  <div className="space-y-3">
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
                )}

                {/* Tab: Compliance Trend */}
                {detailTab === "trend" && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-text-primary">Period-over-Period Comparison</p>
                    {!comparison ? (
                      <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" /></div>
                    ) : comparison.length === 0 ? (
                      <p className="text-xs text-text-muted py-4 text-center">No historical data available.</p>
                    ) : (
                      <>
                        {/* LC Rate trend */}
                        <Card><CardContent className="p-3">
                          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Local Content Rate</p>
                          <div className="flex items-end gap-1 h-24">
                            {comparison.slice().reverse().map((p: { periodId: string; label: string; lcRate: number }, i: number) => {
                              const maxRate = Math.max(...comparison.map((c: { lcRate: number }) => c.lcRate), 1);
                              const height = Math.max((p.lcRate / maxRate) * 100, 4);
                              const prev = i > 0 ? comparison.slice().reverse()[i - 1] : null;
                              const trending = prev ? p.lcRate - prev.lcRate : 0;
                              return (
                                <div key={p.periodId} className="flex-1 flex flex-col items-center gap-0.5">
                                  <span className="text-[9px] font-bold" style={{ color: p.lcRate >= 50 ? "var(--color-success)" : "var(--color-danger)" }}>{p.lcRate}%</span>
                                  <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: p.lcRate >= 50 ? "var(--color-success)" : "var(--color-danger)", opacity: 0.7 }} />
                                  <span className="text-[8px] text-text-muted">{p.label}</span>
                                  {trending !== 0 && (
                                    <span className={cn("text-[8px] flex items-center", trending > 0 ? "text-success" : "text-danger")}>
                                      {trending > 0 ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
                                      {trending > 0 ? "+" : ""}{trending.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent></Card>

                        {/* Employment trend */}
                        <Card><CardContent className="p-3">
                          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Guyanese Employment %</p>
                          <div className="flex items-end gap-1 h-24">
                            {comparison.slice().reverse().map((p: { periodId: string; label: string; employmentPct: number }) => {
                              const maxPct = Math.max(...comparison.map((c: { employmentPct: number }) => c.employmentPct), 1);
                              const height = Math.max((p.employmentPct / maxPct) * 100, 4);
                              return (
                                <div key={p.periodId} className="flex-1 flex flex-col items-center gap-0.5">
                                  <span className="text-[9px] font-bold" style={{ color: p.employmentPct >= 60 ? "var(--color-success)" : "var(--color-warning)" }}>{p.employmentPct}%</span>
                                  <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: p.employmentPct >= 60 ? "var(--color-success)" : "var(--color-warning)", opacity: 0.7 }} />
                                  <span className="text-[8px] text-text-muted">{p.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent></Card>

                        {/* Data table */}
                        <Card><CardContent className="p-3">
                          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Detailed Breakdown</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="border-b border-border text-text-muted">
                                  <th className="text-left py-1 pr-2">Period</th>
                                  <th className="text-right py-1 px-1">LC Rate</th>
                                  <th className="text-right py-1 px-1">Emp %</th>
                                  <th className="text-right py-1 px-1">Expenditure</th>
                                  <th className="text-right py-1 px-1">Employees</th>
                                  <th className="text-right py-1 pl-1">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparison.slice().reverse().map((p: { periodId: string; label: string; lcRate: number; employmentPct: number; totalExpenditure: number; totalEmployees: number; guyaneseEmployees: number; status: string }) => (
                                  <tr key={p.periodId} className="border-b border-border/50">
                                    <td className="py-1.5 pr-2 font-medium">{p.label}</td>
                                    <td className={cn("text-right py-1.5 px-1 font-bold", p.lcRate >= 50 ? "text-success" : "text-danger")}>{p.lcRate}%</td>
                                    <td className={cn("text-right py-1.5 px-1", p.employmentPct >= 60 ? "text-success" : "text-warning")}>{p.employmentPct}%</td>
                                    <td className="text-right py-1.5 px-1">{formatCurrency(p.totalExpenditure)}</td>
                                    <td className="text-right py-1.5 px-1">{p.guyaneseEmployees}/{p.totalEmployees}</td>
                                    <td className="text-right py-1.5 pl-1"><Badge variant={p.status === "submitted" ? "success" : "default"} className="text-[9px]">{p.status}</Badge></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent></Card>
                      </>
                    )}
                  </div>
                )}

                {/* Tab: Amendments */}
                {detailTab === "amendments" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-text-primary">Amendment Requests</p>
                      {!showAmendmentForm && (
                        <Button size="sm" variant="outline" onClick={() => setShowAmendmentForm(true)}>
                          <Plus className="h-3 w-3 mr-1" /> New Request
                        </Button>
                      )}
                    </div>

                    {/* New amendment form */}
                    {showAmendmentForm && (
                      <Card className="border-warning/30">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-xs font-semibold text-warning">New Amendment Request</p>

                          {amendmentItems.map((item, idx) => (
                            <div key={idx} className="bg-bg-primary rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium text-text-muted">Item {idx + 1}</span>
                                {amendmentItems.length > 1 && (
                                  <button onClick={() => removeAmendmentItem(idx)} className="text-text-muted hover:text-danger">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-[1fr_auto] gap-2">
                                <Input placeholder="Section (e.g. Employment Records)" value={item.section} onChange={e => updateAmendmentItem(idx, "section", e.target.value)} className="text-xs" />
                                <Select value={item.severity} onChange={e => updateAmendmentItem(idx, "severity", e.target.value)} options={[
                                  { value: "critical", label: "Critical" },
                                  { value: "major", label: "Major" },
                                  { value: "minor", label: "Minor" },
                                ]} className="w-24" />
                              </div>
                              <textarea className="w-full h-12 px-3 py-2 rounded-lg bg-bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none" value={item.description} onChange={e => updateAmendmentItem(idx, "description", e.target.value)} placeholder="Describe what needs to be corrected..." />
                            </div>
                          ))}

                          <button onClick={addAmendmentItem} className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Add another item
                          </button>

                          <textarea className="w-full h-14 px-3 py-2 rounded-lg bg-bg-primary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-accent resize-none" value={amendmentSummary} onChange={e => setAmendmentSummary(e.target.value)} placeholder="Overall summary of required amendments..." />

                          <div>
                            <label className="text-[10px] text-text-muted font-medium">Response Deadline</label>
                            <Input type="date" value={amendmentDeadline} onChange={e => setAmendmentDeadline(e.target.value)} className="text-xs mt-1" />
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowAmendmentForm(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleAmendmentSubmit} loading={amendmentSubmitting}>
                              <Send className="h-3 w-3 mr-1" /> Send to Filer
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Existing amendments */}
                    {amendments.length === 0 && !showAmendmentForm ? (
                      <p className="text-xs text-text-muted py-4 text-center">No amendment requests for this submission.</p>
                    ) : (
                      amendments.map((a: { id: string; summary: string; items: string; status: string; responseDeadline: string | null; createdAt: string | null; respondedAt: string | null }) => {
                        let items: Array<{ section: string; description: string; severity: string }> = [];
                        try { items = JSON.parse(a.items); } catch { /* empty */ }
                        return (
                          <Card key={a.id} className={cn(a.status === "pending" ? "border-warning/30" : a.status === "resolved" ? "border-success/30" : "")}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant={a.status === "pending" ? "warning" : a.status === "resolved" ? "success" : "default"} className="text-[10px]">
                                  {a.status}
                                </Badge>
                                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                                  <Clock className="h-3 w-3" />
                                  {a.responseDeadline ? `Due ${new Date(a.responseDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No deadline"}
                                </div>
                              </div>
                              <p className="text-xs text-text-secondary">{a.summary}</p>
                              <div className="space-y-1">
                                {items.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-[11px]">
                                    <Badge variant={item.severity === "critical" ? "danger" : item.severity === "major" ? "warning" : "default"} className="text-[9px] shrink-0 mt-0.5">
                                      {item.severity}
                                    </Badge>
                                    <div>
                                      <span className="font-medium text-text-primary">{item.section}:</span>{" "}
                                      <span className="text-text-secondary">{item.description}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {a.createdAt && (
                                <p className="text-[9px] text-text-muted">
                                  Requested {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {a.respondedAt && ` · Responded ${new Date(a.respondedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
