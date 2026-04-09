"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Download, Settings2, X, Check, GripVertical,
  DollarSign, Users, Clock, TrendingUp, Briefcase, Shield,
  GraduationCap, Building2, FileText, PieChart, Sparkles, Copy,
} from "lucide-react";
import { fetchSecretariatAnalytics, fetchSecretariatDashboard, fetchSecretariatMarketIntel } from "@/server/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Widget Definitions ─────────────────────────────────────────

interface WidgetDef {
  id: string;
  label: string;
  category: "kpi" | "compliance" | "workforce" | "market";
  icon: typeof DollarSign;
  defaultEnabled: boolean;
}

const WIDGETS: WidgetDef[] = [
  { id: "local_spend", label: "Local Content Spend", category: "kpi", icon: DollarSign, defaultEnabled: true },
  { id: "jobs_created", label: "Jobs Created", category: "workforce", icon: Users, defaultEnabled: true },
  { id: "staff_hours", label: "Staff Hours Saved", category: "kpi", icon: Clock, defaultEnabled: true },
  { id: "economic_impact", label: "Economic Impact", category: "kpi", icon: TrendingUp, defaultEnabled: true },
  { id: "lc_rate", label: "Sector LC Rate", category: "compliance", icon: PieChart, defaultEnabled: true },
  { id: "employment_breakdown", label: "Employment by Category", category: "workforce", icon: Users, defaultEnabled: true },
  { id: "filing_status", label: "Filing Status", category: "compliance", icon: FileText, defaultEnabled: true },
  { id: "training_capacity", label: "Training & Capacity", category: "workforce", icon: GraduationCap, defaultEnabled: true },
  { id: "top_filers", label: "Top Filers by Expenditure", category: "compliance", icon: Building2, defaultEnabled: false },
  { id: "supplier_stats", label: "Supplier Breakdown", category: "market", icon: Briefcase, defaultEnabled: false },
  { id: "opportunities", label: "Opportunity Stats", category: "market", icon: Briefcase, defaultEnabled: false },
  { id: "submission_method", label: "Submission Methods", category: "compliance", icon: Shield, defaultEnabled: false },
];

const CATEGORY_LABELS: Record<string, string> = {
  kpi: "Key Performance Indicators",
  compliance: "Compliance & Filing",
  workforce: "Workforce & Employment",
  market: "Market & Suppliers",
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function getStoredWidgets(): string[] {
  if (typeof window === "undefined") return WIDGETS.filter(w => w.defaultEnabled).map(w => w.id);
  try {
    const stored = localStorage.getItem("secretariat_report_widgets");
    if (stored) return JSON.parse(stored);
  } catch {}
  return WIDGETS.filter(w => w.defaultEnabled).map(w => w.id);
}

function storeWidgets(ids: string[]) {
  try { localStorage.setItem("secretariat_report_widgets", JSON.stringify(ids)); } catch {}
}

export default function SecretariatReportsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dashboard, setDashboard] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [marketIntel, setMarketIntel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(getStoredWidgets());
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchSecretariatAnalytics(),
      fetchSecretariatDashboard(),
      fetchSecretariatMarketIntel().catch(() => null),
    ])
      .then(([a, d, m]) => { setAnalytics(a); setDashboard(d); setMarketIntel(m); })
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setEnabledWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id];
      storeWidgets(next);
      return next;
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/secretariat-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics, widgets: enabledWidgets }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LCA_Desk_Sector_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch { toast.error("Failed to export report"); }
    setExporting(false);
  };

  const generateAiSummary = async () => {
    if (!analytics) return;
    setGeneratingSummary(true);
    setAiSummary("");
    try {
      const res = await fetch("/api/ai/secretariat-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Write a concise executive summary (150-250 words) of the current Local Content sector performance for the Director to share with the Minister or include in a quarterly report. Use these exact figures:

- Local Content Rate: ${analytics.overallLcRate}%
- Guyanese Expenditure: $${(analytics.localSpend || 0).toLocaleString()} of $${(analytics.economicImpact || 0).toLocaleString()} total
- Guyanese Employment: ${(analytics.jobsCreated || 0).toLocaleString()} of ${(analytics.totalEmployees || 0).toLocaleString()} total (${analytics.employmentPct}%)
- Filing Companies: ${analytics.uniqueFilers}
- Submissions Processed: ${analytics.totalSubmissions}
- Training Participants: ${(analytics.totalTrainingParticipants || 0).toLocaleString()}
- Training Days: ${(analytics.totalTrainingDays || 0).toLocaleString()}
- Capacity Investment: $${(analytics.totalCapacitySpend || 0).toLocaleString()}
- Staff Hours Saved: ${analytics.staffHoursSaved}

Write in formal government report style. Open with the headline metric (LC rate), cover employment compliance, training investment, and close with the platform efficiency gain (staff hours saved). Do not use bullet points — write flowing paragraphs.`,
          }],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAiSummary(accumulated);
      }
    } catch {
      setAiSummary("Failed to generate summary. Please try again.");
    }
    setGeneratingSummary(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiSummary);
    toast.success("Summary copied to clipboard");
  };

  const isEnabled = (id: string) => enabledWidgets.includes(id);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;
  if (!analytics) return <div className="p-8 text-center text-text-muted">Unable to load report data.</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-gold" />
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Sector Report</h1>
            <p className="text-sm text-text-secondary">Customizable compliance and impact metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(!configOpen)} className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Configure
          </Button>
          <Button size="sm" onClick={handleExport} loading={exporting} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* AI Executive Summary */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <p className="text-sm font-semibold text-text-primary">AI Executive Summary</p>
            </div>
            <div className="flex items-center gap-2">
              {aiSummary && !generatingSummary && (
                <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1 text-xs">
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              )}
              <Button size="sm" onClick={generateAiSummary} loading={generatingSummary} className="gap-1 text-xs">
                <Sparkles className="h-3 w-3" /> {aiSummary ? "Regenerate" : "Generate Summary"}
              </Button>
            </div>
          </div>
          {aiSummary ? (
            <div className="bg-bg-primary rounded-lg p-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {aiSummary}
              {generatingSummary && <span className="inline-block w-2 h-4 bg-gold animate-pulse ml-1" />}
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              Generate an AI-written executive summary from your current sector data. Ready to paste into emails, quarterly reports, or ministerial briefings.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Widget configurator */}
      {configOpen && (
        <Card className="mb-6 border-gold/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text-primary">Choose which metrics to display</p>
              <button onClick={() => setConfigOpen(false)} className="text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
            </div>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {WIDGETS.filter(w => w.category === cat).map(w => (
                    <button key={w.id} onClick={() => toggleWidget(w.id)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        isEnabled(w.id) ? "bg-gold/10 border-gold/30 text-gold" : "bg-bg-primary border-border text-text-muted hover:border-gold/20"
                      )}>
                      {isEnabled(w.id) ? <Check className="h-3 w-3" /> : <w.icon className="h-3 w-3" />}
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Widget grid */}
      <div className="space-y-4" id="report-content">
        {/* KPI Row */}
        {(isEnabled("local_spend") || isEnabled("jobs_created") || isEnabled("staff_hours") || isEnabled("economic_impact")) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {isEnabled("local_spend") && (
              <Card className="p-4 bg-gradient-to-br from-success/5 to-transparent border-success/20 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/secretariat/market")}>
                <p className="text-xs font-semibold text-success uppercase tracking-wider mb-1">Local Spend</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(analytics.localSpend)}</p>
                <p className="text-xs text-text-muted mt-0.5">{analytics.guyaneseSupplierCount} suppliers · {analytics.overallLcRate}% LC rate</p>
              </Card>
            )}
            {isEnabled("jobs_created") && (
              <Card className="p-4 bg-gradient-to-br from-accent/5 to-transparent border-accent/20 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/secretariat/market")}>
                <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">Jobs Created</p>
                <p className="text-2xl font-bold text-accent">{analytics.jobsCreated.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-0.5">{analytics.totalEmployees.toLocaleString()} total · {analytics.employmentPct}% Guyanese</p>
              </Card>
            )}
            {isEnabled("staff_hours") && (
              <Card className="p-4 bg-gradient-to-br from-gold/5 to-transparent border-gold/20 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/secretariat/dashboard")}>
                <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-1">Staff Hours Saved</p>
                <p className="text-2xl font-bold text-gold">{analytics.staffHoursSaved.toLocaleString()}</p>
                <p className="text-xs text-text-muted mt-0.5">{analytics.totalSubmissions} submissions processed</p>
              </Card>
            )}
            {isEnabled("economic_impact") && (
              <Card className="p-4 bg-gradient-to-br from-text-primary/5 to-transparent cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push("/secretariat/compliance")}>
                <p className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-1">Economic Impact</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.economicImpact)}</p>
                <p className="text-xs text-text-muted mt-0.5">{analytics.uniqueFilers} companies filing</p>
              </Card>
            )}
          </div>
        )}

        {/* LC Rate + Filing Status */}
        {(isEnabled("lc_rate") || isEnabled("filing_status")) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isEnabled("lc_rate") && (
              <Card><CardContent className="p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Sector Local Content Rate</p>
                <div className="flex items-end gap-4">
                  <p className={cn("text-4xl font-bold", analytics.overallLcRate >= 50 ? "text-success" : "text-warning")}>{analytics.overallLcRate}%</p>
                  <div className="text-xs text-text-muted pb-1">
                    <p>Guyanese: {formatCurrency(analytics.guyaneseExpenditure)}</p>
                    <p>Total: {formatCurrency(analytics.totalExpenditure)}</p>
                  </div>
                </div>
                <div className="mt-3 h-3 bg-bg-primary rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(analytics.overallLcRate, 100)}%` }} />
                </div>
              </CardContent></Card>
            )}
            {isEnabled("filing_status") && dashboard && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/secretariat/dashboard")}><CardContent className="p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Submission Queue</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{dashboard.stats.total}</p>
                    <p className="text-xs text-text-muted">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{dashboard.stats.pending}</p>
                    <p className="text-xs text-text-muted">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{dashboard.stats.acknowledged}</p>
                    <p className="text-xs text-text-muted">Reviewed</p>
                  </div>
                </div>
              </CardContent></Card>
            )}
          </div>
        )}

        {/* Employment + Training */}
        {(isEnabled("employment_breakdown") || isEnabled("training_capacity")) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isEnabled("employment_breakdown") && (
              <Card><CardContent className="p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Guyanese Employment</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Total Workforce</span>
                    <span className="font-bold">{analytics.totalEmployees.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Guyanese Nationals</span>
                    <span className="font-bold text-success">{analytics.guyaneseEmployees.toLocaleString()}</span>
                  </div>
                  <div className="h-3 bg-bg-primary rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${analytics.employmentPct}%` }} />
                  </div>
                  <p className={cn("text-xs font-medium text-center", analytics.employmentPct >= 60 ? "text-success" : "text-warning")}>
                    {analytics.employmentPct}% Guyanese
                  </p>
                </div>
              </CardContent></Card>
            )}
            {isEnabled("training_capacity") && (
              <Card><CardContent className="p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Training & Capacity Development</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-bold">{analytics.totalTrainingParticipants.toLocaleString()}</p>
                    <p className="text-xs text-text-muted">Participants Trained</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.totalTrainingDays.toLocaleString()}</p>
                    <p className="text-xs text-text-muted">Training Days</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-lg font-bold text-accent">{formatCurrency(analytics.totalCapacitySpend)}</p>
                    <p className="text-xs text-text-muted">Investment in Capacity Building</p>
                  </div>
                </div>
              </CardContent></Card>
            )}
          </div>
        )}

        {/* Market widgets */}
        {(isEnabled("supplier_stats") || isEnabled("opportunities")) && marketIntel && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isEnabled("supplier_stats") && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/secretariat/market")}><CardContent className="p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Supplier Ecosystem</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-2xl font-bold text-success">{analytics.guyaneseSupplierCount}</p><p className="text-xs text-text-muted">Guyanese Suppliers</p></div>
                  <div><p className="text-2xl font-bold">{marketIntel.seekers?.total || 0}</p><p className="text-xs text-text-muted">Registered Job Seekers</p></div>
                  <div><p className="text-2xl font-bold">{marketIntel.seekers?.inTalentPool || 0}</p><p className="text-xs text-text-muted">In Talent Pool</p></div>
                  <div><p className="text-2xl font-bold">{marketIntel.applications?.total || 0}</p><p className="text-xs text-text-muted">Job Applications</p></div>
                </div>
              </CardContent></Card>
            )}
            {isEnabled("opportunities") && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/secretariat/market")}><CardContent className="p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Procurement Opportunities</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-2xl font-bold">{marketIntel.opportunities?.total || 0}</p><p className="text-xs text-text-muted">Total Notices</p></div>
                  <div><p className="text-2xl font-bold text-success">{marketIntel.opportunities?.active || 0}</p><p className="text-xs text-text-muted">Active</p></div>
                  <div><p className="text-2xl font-bold">{marketIntel.jobs?.total || 0}</p><p className="text-xs text-text-muted">Employment Notices</p></div>
                  <div><p className="text-2xl font-bold text-accent">{marketIntel.opportunities?.totalSaves || 0}</p><p className="text-xs text-text-muted">Saves by Filers</p></div>
                </div>
              </CardContent></Card>
            )}
          </div>
        )}

        {/* Submission methods */}
        {isEnabled("submission_method") && dashboard && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/secretariat/dashboard")}><CardContent className="p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Submission Methods</p>
            <div className="grid grid-cols-3 gap-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(() => { const subs = dashboard.submissions || []; const platform = subs.filter((s: any) => s.submissionMethod === "platform").length; const upload = subs.filter((s: any) => s.submissionMethod === "upload").length; const email = subs.filter((s: any) => s.submissionMethod === "email" || !s.submissionMethod).length; return (<>
                <div className="text-center"><p className="text-2xl font-bold text-accent">{platform}</p><p className="text-xs text-text-muted">Via LCA Desk</p></div>
                <div className="text-center"><p className="text-2xl font-bold">{upload}</p><p className="text-xs text-text-muted">File Upload</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-text-muted">{email}</p><p className="text-xs text-text-muted">Email</p></div>
              </>); })()}
            </div>
          </CardContent></Card>
        )}

        {/* Top filers */}
        {isEnabled("top_filers") && dashboard && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/secretariat/dashboard")}><CardContent className="p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Recent Submissions</p>
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(dashboard.submissions || []).slice(0, 10).map((s: any) => (
                <div key={s.periodId} className="flex items-center justify-between text-xs py-1 border-b border-border-light last:border-0">
                  <div>
                    <span className="font-medium text-text-primary">{s.entityName}</span>
                    <span className="text-text-muted ml-2">{s.reportType?.replace(/_/g, " ")} FY{s.fiscalYear}</span>
                  </div>
                  <Badge variant={s.submissionMethod === "platform" ? "accent" : "default"} className="text-xs">
                    {s.submissionMethod === "platform" ? "Platform" : s.submissionMethod === "upload" ? "Upload" : "Email"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </div>

      {/* Report date stamp */}
      <p className="text-xs text-text-muted text-center mt-6">
        Report generated {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · LCA Desk Secretariat Portal
      </p>
    </div>
  );
}
