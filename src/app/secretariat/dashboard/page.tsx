"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  FileText, CheckCircle, Search, Shield, Eye, Mail,
  AlertTriangle, TrendingUp, TrendingDown, Plus, Trash2, Send, Clock, Download, Play,
} from "lucide-react";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { PlatformBriefing } from "@/components/onboarding/PlatformBriefing";
import { fetchSecretariatDashboard, fetchSecretariatAnalytics, fetchSubmissionDetail, acknowledgeSubmission, fetchPeriodComparison, createAmendmentRequest, fetchAmendmentRequests, fetchSecretariatOfficeSettings } from "@/server/actions";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import { DashboardIdentity, DashboardStats, StatusCard } from "@/components/dashboard/shared/DashboardTemplate";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
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
  const { data: session } = useSession();

  // Briefing state
  const [showBriefingCard, setShowBriefingCard] = useState(false);
  const [briefingActive, setBriefingActive] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("secretariat-briefing-completed");
    const isDemo = session?.user?.email?.includes("demo-");
    if (!completed || isDemo) setShowBriefingCard(true);
  }, [session]);

  const completeBriefing = () => {
    localStorage.setItem("secretariat-briefing-completed", "true");
    setBriefingActive(false);
    setShowBriefingCard(false);
    window.dispatchEvent(new CustomEvent("open-contact-card"));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [office, setOffice] = useState<any>(null);
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
    Promise.all([fetchSecretariatDashboard(), fetchSecretariatAnalytics(), fetchSecretariatOfficeSettings().catch(() => null)])
      .then(([d, a, o]) => { setData(d); setAnalytics(a); if (o) setOffice(o); })
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
    <div className="p-4 sm:p-6 max-w-6xl space-y-5">
      <AnnouncementBanner userRole="secretariat" />

      {/* Platform Briefing welcome card — prominent hero */}
      {showBriefingCard && !briefingActive && (
        <div className="rounded-2xl border-2 border-accent bg-gradient-to-br from-[#19544c] to-[#0d3830] p-8 text-white shadow-xl shadow-accent/10 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur shrink-0">
              <Play className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent-light bg-white/10 px-2.5 py-1 rounded-full">
                  3-Minute Audio Tour
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-white mb-2">
                Welcome to Your Secretariat Dashboard
              </h2>
              <p className="text-sm text-white/70 mb-6 leading-relaxed max-w-lg">
                Take a guided briefing with audio narration to learn how to review filings, monitor compliance, and manage the LCS Register.
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setBriefingActive(true)}
                  className="flex items-center gap-2 bg-white text-[#19544c] px-6 py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-all hover:shadow-lg"
                  style={{ animation: "pulse 2s ease-in-out infinite" }}
                >
                  <Play className="h-4 w-4" />
                  Start Platform Briefing
                </button>
                <button
                  onClick={completeBriefing}
                  className="text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
              50% { box-shadow: 0 0 20px 4px rgba(255,255,255,0.15); }
            }
          `}</style>
        </div>
      )}

      {/* Platform Briefing overlay */}
      {briefingActive && (
        <PlatformBriefing onComplete={completeBriefing} />
      )}

      {/* Identity */}
      <DashboardIdentity
        name={office?.name || "Local Content Secretariat"}
        subtitle={`Regulatory Dashboard · ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
        avatarUrl={office?.logoUrl || undefined}
        status={{ label: "Monitoring", variant: "success" }}
        badge="Secretariat"
      />

      {/* KPI stats */}
      {analytics && (
        <DashboardStats items={[
          { label: "Local Spend", value: formatCurrency(analytics.localSpend), color: "success", sublabel: `${analytics.overallLcRate}% LC rate` },
          { label: "Guyanese Jobs", value: analytics.jobsCreated.toLocaleString(), color: "accent", sublabel: `${analytics.employmentPct}% Guyanese` },
          { label: "Staff Hours Saved", value: analytics.staffHoursSaved.toLocaleString(), color: "gold", sublabel: `${analytics.totalSubmissions} submissions` },
          { label: "Economic Impact", value: formatCurrency(analytics.economicImpact), sublabel: `${analytics.uniqueFilers} companies` },
        ]} />
      )}

      {/* Sector compliance status */}
      {analytics && (
        <StatusCard
          title="Sector Compliance Overview"
          info="A snapshot of aggregate compliance across all companies in your jurisdiction. LC Rate is the percentage of total expenditure spent with LCS-certified local suppliers. Red means the sector average is below the 50% minimum requirement."
          status={analytics.overallLcRate >= 50 ? "Meeting Target" : "Below Target"}
          statusVariant={analytics.overallLcRate >= 50 ? "success" : "warning"}
          details={[
            { label: "Overall LC Rate", value: `${analytics.overallLcRate}%`, benchmark: "50% min", met: analytics.overallLcRate >= 50 },
            { label: "GY Employment (Mgmt)", value: `${analytics.employmentPct}%`, benchmark: "75% min", met: analytics.employmentPct >= 75 },
            { label: "Companies Filing", value: String(analytics.uniqueFilers) },
            { label: "Pending Reviews", value: String(data.stats.pending) },
            { label: "GY Suppliers", value: String(analytics.guyaneseSupplierCount) },
            { label: "Capacity Investment", value: formatCurrency(analytics.totalCapacitySpend) },
          ]}
        />
      )}

      {/* ── Submission Queue ─────────────────────────────────── */}
      <section data-briefing="submissions">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-heading font-semibold text-text-primary">Submission Queue</h2>
          <InfoTooltip title="Submission Queue" content="These are Half-Yearly Reports submitted by contractors and sub-contractors awaiting your review. Click any submission to open the full report, verify data, and approve or request corrections." />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span className="text-sm font-medium text-warning">{data.stats.pending} pending</span>
          </div>
          <span className="text-text-muted">·</span>
          <span className="text-sm text-text-muted">{data.stats.acknowledged} reviewed</span>
          <span className="text-text-muted">·</span>
          <span className="text-sm text-text-muted">{data.stats.total} total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
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
                      <p className="text-xs text-text-muted mt-0.5">
                        Submitted {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        {s.submissionMethod === "platform" && " · via LCA Desk"}
                        {ack?.referenceNumber && ` · Ref: ${ack.referenceNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.submissionMethod === "platform" && <Badge variant="accent" className="text-xs">Platform</Badge>}
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

      </section>

      {/* Industry News + Demo contact card */}
      <div className={session?.user?.email?.includes("demo-") ? "flex flex-col lg:flex-row gap-4 items-start" : undefined}>
        <div className="flex-1 min-w-0">
          <IndustryNewsFeed userType="secretariat" />
        </div>

        {/* Demo-only: contact card */}
        {session?.user?.email?.includes("demo-") && (
          <div data-briefing="contact-card" className="rounded-2xl border border-border bg-bg-card shadow-lg p-5 w-full lg:w-[300px] shrink-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-lg font-bold text-accent shrink-0">
                CK
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Cole Kutschinski</p>
                <p className="text-xs text-text-muted">Founder, LCA Desk</p>
              </div>
            </div>

            {/* Email */}
            <a
              href="mailto:Cole@lcadesk.com"
              className="flex items-center gap-2.5 text-sm text-text-secondary hover:text-accent transition-colors mb-4"
            >
              <Mail className="h-4 w-4 text-text-muted shrink-0" />
              Cole@lcadesk.com
            </a>

            {/* Action buttons */}
            <div className="space-y-2">
              <a
                href="/proposal"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-accent text-accent text-sm font-semibold hover:bg-accent hover:text-white transition-colors"
              >
                <FileText className="h-4 w-4" />
                View My Proposal
              </a>

              <a
                href="https://teams.microsoft.com/l/chat/0/0?users=Cole@lcadesk.com&message=Hi%20Cole%2C%20I%27d%20like%20to%20schedule%20a%20demo%20meeting."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#5B5FC7] text-white text-sm font-medium hover:bg-[#4B4FB7] transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M19.24 6.76h-4.48V4.24A2.24 2.24 0 0012.52 2h-4.8a2.24 2.24 0 00-2.24 2.24v2.52H1.24A1.24 1.24 0 000 8v8.76a1.24 1.24 0 001.24 1.24h4.24v2.76A1.24 1.24 0 006.72 22h10.56a1.24 1.24 0 001.24-1.24V18h.72A2.76 2.76 0 0022 15.24V9.52a2.76 2.76 0 00-2.76-2.76zM7.72 4.24a.24.24 0 01.24-.24h4.8a.24.24 0 01.24.24v2.52H7.72zM2 8.76h10v7H2zM16.52 20H8.72v-2.24h4a1.24 1.24 0 001.24-1.24v-3h2.56zm3.48-4.76a.76.76 0 01-.76.76H16.52v-5.24a1.24 1.24 0 00-1.24-1.24H14V8.76h5.24a.76.76 0 01.76.76z" />
                </svg>
                Schedule a Meeting
              </a>

              <a
                href="https://wa.me/18324927169?text=Hi%20Cole%2C%20I%20just%20tried%20the%20LCA%20Desk%20demo%20and%20I%27d%20like%20to%20learn%20more."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:bg-[#1DA851] transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Message on WhatsApp
              </a>
            </div>

            <p className="text-[10px] text-text-muted text-center mt-3">
              Questions about the platform? I&apos;m here to help.
            </p>
          </div>
        )}
      </div>

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
                  <div className="flex justify-between"><span className="text-text-muted">Method</span><span>{
                    detailData.submissionMethod === "platform" ? <Badge variant="accent" className="text-xs">LCA Desk Platform</Badge> :
                    detailData.submissionMethod === "upload" ? <Badge variant="accent" className="text-xs">File Upload</Badge> :
                    <Badge variant="default" className="text-xs">Email</Badge>
                  }</span></div>
                  {detailData.attester && <div className="flex justify-between"><span className="text-text-muted">Attested by</span><span>{detailData.attester.name} ({detailData.attester.email})</span></div>}
                  {detailData.uploadedFile && (
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Attached File</span>
                      <a href={`/api/submission/download?key=${encodeURIComponent(detailData.uploadedFile.key)}&name=${encodeURIComponent(detailData.uploadedFile.name)}`}
                        className="flex items-center gap-1 text-accent hover:text-accent-hover text-xs font-medium">
                        <Download className="h-3 w-3" /> {detailData.uploadedFile.name}
                      </a>
                    </div>
                  )}
                </div>

                {/* Compliance metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 text-center">
                    <p className={cn("text-xl font-bold", detailData.metrics.lcRate >= 50 ? "text-success" : "text-danger")}>{detailData.metrics.lcRate}%</p>
                    <p className="text-xs text-text-muted">LC Rate</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className={cn("text-xl font-bold", detailData.metrics.employmentPct >= 60 ? "text-success" : "text-danger")}>{detailData.metrics.employmentPct}%</p>
                    <p className="text-xs text-text-muted">GY Employment</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-xl font-bold">{formatCurrency(detailData.metrics.totalExpenditure)}</p>
                    <p className="text-xs text-text-muted">Total Spend</p>
                  </Card>
                </div>

                {/* Employment breakdown */}
                <Card><CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Employment by Category</p>
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
                <div className="flex flex-wrap gap-3 text-sm text-text-muted">
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
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">Attestation</p>
                    <p className="text-xs text-text-secondary italic">{detailData.period.attestation}</p>
                  </div>
                )}

                {/* History */}
                {detailData.history.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Filing History</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {detailData.history.map((h: { id: string; reportType: string; fiscalYear: number }) => (
                        <Badge key={h.id} variant={h.id === detailData.period.id ? "accent" : "default"} className="text-xs">
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
                  <div className="space-y-4">
                    <p className="text-base font-semibold text-text-primary">Period-over-Period Comparison</p>
                    {!comparison ? (
                      <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" /></div>
                    ) : comparison.length === 0 ? (
                      <p className="text-sm text-text-muted py-4 text-center">No historical data available.</p>
                    ) : (
                      <>
                        {/* LC Rate trend */}
                        <Card><CardContent className="p-4">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Local Content Rate</p>
                          <div className="flex items-end gap-2 h-32">
                            {comparison.slice().reverse().map((p: { periodId: string; label: string; lcRate: number }, i: number) => {
                              const maxRate = Math.max(...comparison.map((c: { lcRate: number }) => c.lcRate), 1);
                              const height = Math.max((p.lcRate / maxRate) * 100, 4);
                              const prev = i > 0 ? comparison.slice().reverse()[i - 1] : null;
                              const trending = prev ? p.lcRate - prev.lcRate : 0;
                              return (
                                <div key={p.periodId} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-sm font-bold" style={{ color: p.lcRate >= 50 ? "var(--color-success)" : "var(--color-danger)" }}>{p.lcRate}%</span>
                                  <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: p.lcRate >= 50 ? "var(--color-success)" : "var(--color-danger)", opacity: 0.7 }} />
                                  <span className="text-xs text-text-muted">{p.label}</span>
                                  {trending !== 0 && (
                                    <span className={cn("text-xs flex items-center", trending > 0 ? "text-success" : "text-danger")}>
                                      {trending > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                      {trending > 0 ? "+" : ""}{trending.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent></Card>

                        {/* Employment trend */}
                        <Card><CardContent className="p-4">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Guyanese Employment %</p>
                          <div className="flex items-end gap-2 h-32">
                            {comparison.slice().reverse().map((p: { periodId: string; label: string; employmentPct: number }) => {
                              const maxPct = Math.max(...comparison.map((c: { employmentPct: number }) => c.employmentPct), 1);
                              const height = Math.max((p.employmentPct / maxPct) * 100, 4);
                              return (
                                <div key={p.periodId} className="flex-1 flex flex-col items-center gap-1">
                                  <span className="text-sm font-bold" style={{ color: p.employmentPct >= 60 ? "var(--color-success)" : "var(--color-warning)" }}>{p.employmentPct}%</span>
                                  <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: p.employmentPct >= 60 ? "var(--color-success)" : "var(--color-warning)", opacity: 0.7 }} />
                                  <span className="text-xs text-text-muted">{p.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent></Card>

                        {/* Data table */}
                        <Card><CardContent className="p-4">
                          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Detailed Breakdown</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border text-text-muted text-xs">
                                  <th className="text-left py-2 pr-3">Period</th>
                                  <th className="text-right py-2 px-2">LC Rate</th>
                                  <th className="text-right py-2 px-2">Emp %</th>
                                  <th className="text-right py-2 px-2">Expenditure</th>
                                  <th className="text-right py-2 px-2">Employees</th>
                                  <th className="text-right py-2 pl-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparison.slice().reverse().map((p: { periodId: string; label: string; lcRate: number; employmentPct: number; totalExpenditure: number; totalEmployees: number; guyaneseEmployees: number; status: string }) => (
                                  <tr key={p.periodId} className="border-b border-border/50">
                                    <td className="py-2.5 pr-3 font-medium">{p.label}</td>
                                    <td className={cn("text-right py-2.5 px-2 font-bold", p.lcRate >= 50 ? "text-success" : "text-danger")}>{p.lcRate}%</td>
                                    <td className={cn("text-right py-2.5 px-2", p.employmentPct >= 60 ? "text-success" : "text-warning")}>{p.employmentPct}%</td>
                                    <td className="text-right py-2.5 px-2">{formatCurrency(p.totalExpenditure)}</td>
                                    <td className="text-right py-2.5 px-2">{p.guyaneseEmployees}/{p.totalEmployees}</td>
                                    <td className="text-right py-2.5 pl-2"><Badge variant={p.status === "submitted" ? "success" : "default"} className="text-xs">{p.status}</Badge></td>
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
                                <span className="text-xs font-medium text-text-muted">Item {idx + 1}</span>
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
                            <label className="text-xs text-text-muted font-medium">Response Deadline</label>
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
                                <Badge variant={a.status === "pending" ? "warning" : a.status === "resolved" ? "success" : "default"} className="text-xs">
                                  {a.status}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-text-muted">
                                  <Clock className="h-3 w-3" />
                                  {a.responseDeadline ? `Due ${new Date(a.responseDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No deadline"}
                                </div>
                              </div>
                              <p className="text-xs text-text-secondary">{a.summary}</p>
                              <div className="space-y-1">
                                {items.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-sm">
                                    <Badge variant={item.severity === "critical" ? "danger" : item.severity === "major" ? "warning" : "default"} className="text-xs shrink-0 mt-0.5">
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
                                <p className="text-xs text-text-muted">
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
