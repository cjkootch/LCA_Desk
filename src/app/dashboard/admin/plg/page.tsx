"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkSuperAdmin, fetchPlgStats } from "@/server/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp, ArrowLeft, RefreshCw, Clock, CheckCircle,
  AlertTriangle, XCircle, ChevronDown, ChevronUp, Activity,
} from "lucide-react";

type PlgData = Awaited<ReturnType<typeof fetchPlgStats>>;

const FUNNEL_LABELS: Record<string, string> = {
  trial_started: "Trial Started",
  entity_created: "Entity Created",
  first_expenditure_added: "Expenditure Added",
  narrative_generated: "Narrative Generated",
  report_submitted: "Report Submitted",
};

const EVENT_BADGE_VARIANT: Record<string, string> = {
  trial_started: "bg-gold/20 text-gold",
  entity_created: "bg-accent/20 text-accent",
  report_submitted: "bg-success/20 text-success",
  upgrade_prompt_viewed: "bg-warning/20 text-warning",
  upgrade_prompt_dismissed: "bg-danger/20 text-danger",
};

function stateBadge(state: string) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Paying", cls: "bg-success/15 text-success" },
    trial: { label: "Trial", cls: "bg-accent/15 text-accent" },
    trial_expired: { label: "Expired", cls: "bg-danger/15 text-danger" },
    past_due: { label: "Past Due", cls: "bg-warning/15 text-warning" },
    locked: { label: "Locked", cls: "bg-danger/15 text-danger" },
    setup_required: { label: "No Billing", cls: "bg-border text-text-muted" },
  };
  const v = map[state] ?? { label: state, cls: "bg-border text-text-muted" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", v.cls)}>
      {v.label}
    </span>
  );
}

function daysColor(days: number | null | undefined) {
  if (days === null || days === undefined) return "text-text-muted";
  if (days <= 7) return "text-danger font-semibold";
  if (days <= 14) return "text-warning font-semibold";
  return "text-success";
}

export default function PlgPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlgData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllTenants, setShowAllTenants] = useState(false);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await fetchPlgStats();
      setData(d);
      setLastUpdated(new Date());
    } catch {
      // silently fail on refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkSuperAdmin().then((isAdmin) => {
      if (!isAdmin) { router.replace("/dashboard"); return; }
      setAuthorized(true);
      load().finally(() => setLoading(false));
    }).catch(() => router.replace("/dashboard"));
  }, [router, load]);

  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!data) return null;

  // Funnel bars
  const maxFunnelCount = Math.max(...data.funnel.map(f => f.count), 1);

  // Cron staleness threshold: 25 hours
  const STALE_MS = 25 * 60 * 60 * 1000;

  return (
    <div>
      <TopBar title="PLG Dashboard" description="Trial funnel, activation rates, cron health, event stream" />
      <div className="p-4 sm:p-6 max-w-7xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link href="/dashboard/admin" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-text-muted">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── KPI Strip ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Active Trials", value: data.activeTrials, cls: "text-accent" },
            { label: "Expired", value: data.expiredTrials, cls: "text-warning" },
            { label: "Paying", value: data.paying, cls: "text-success" },
            { label: "Past Due", value: data.pastDue, cls: "text-danger" },
            { label: "Signups 7d", value: data.recentSignups7, cls: "text-text-primary" },
            { label: "Signups 30d", value: data.recentSignups30, cls: "text-text-primary" },
          ].map(k => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <p className={cn("text-2xl font-bold", k.cls)}>{k.value}</p>
                <p className="text-xs text-text-muted mt-0.5">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          {/* ── Activation Funnel ─────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Activation Funnel</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.funnel.map((step, i) => {
                const prev = i > 0 ? data.funnel[i - 1].count : step.count;
                const pct = prev > 0 ? Math.round((step.count / prev) * 100) : 100;
                const dropOff = i > 0 && pct < 40;
                const barPct = maxFunnelCount > 0 ? (step.count / maxFunnelCount) * 100 : 0;
                return (
                  <div key={step.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-secondary font-medium">{FUNNEL_LABELS[step.name] ?? step.name}</span>
                      <div className="flex items-center gap-2">
                        {i > 0 && (
                          <span className={cn("text-xs", dropOff ? "text-danger" : "text-text-muted")}>
                            {pct}% of prev
                          </span>
                        )}
                        <span className="font-bold text-text-primary w-8 text-right">{step.count}</span>
                      </div>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className={cn("rounded-full h-2 transition-all", dropOff ? "bg-danger" : "bg-accent")}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {data.funnel.every(f => f.count === 0) && (
                <p className="text-sm text-text-muted text-center py-4">No events recorded yet</p>
              )}
            </CardContent>
          </Card>

          {/* ── Referral Stats ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Referral Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Pending", value: data.referralStats.pending, cls: "text-text-muted" },
                  { label: "Signed Up", value: data.referralStats.signedUp, cls: "text-accent" },
                  { label: "Qualified", value: data.referralStats.qualified, cls: "text-warning" },
                  { label: "Rewarded", value: data.referralStats.rewarded, cls: "text-success" },
                ].map(r => (
                  <div key={r.label} className="rounded-lg border border-border p-3">
                    <p className={cn("text-2xl font-bold", r.cls)}>{r.value}</p>
                    <p className="text-xs text-text-muted mt-0.5">{r.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Active Trials Table ────────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Active Trials ({data.trialList.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.trialList.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No active trials</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Company</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Plan</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Days Left</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Trial Started</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trialList.map(t => (
                      <tr key={t.id} className="border-b border-border-light hover:bg-bg-primary/50">
                        <td className="py-2 px-3 font-medium text-text-primary">{t.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant={t.plan === "pro" ? "accent" : t.plan === "enterprise" ? "gold" : "default"} className="text-xs">
                            {t.plan || "lite"}
                          </Badge>
                        </td>
                        <td className={cn("py-2 px-3 tabular-nums", daysColor(t.daysRemaining))}>
                          {t.daysRemaining !== null && t.daysRemaining !== undefined ? `${t.daysRemaining}d` : "—"}
                        </td>
                        <td className="py-2 px-3 text-text-muted text-xs">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 px-3">{stateBadge(t.billingState)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Cron Health ───────────────────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Cron Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.cronHealth.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No cron runs recorded yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Job</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Last Run</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Status</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Duration</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Records</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cronHealth.map(run => {
                      const isStale = run.startedAt
                        ? Date.now() - new Date(run.startedAt).getTime() > STALE_MS
                        : false;
                      const isFailed = run.status === "failed";
                      const rowCls = isFailed || isStale ? "bg-danger/5" : "";
                      return (
                        <tr key={run.id} className={cn("border-b border-border-light", rowCls)}>
                          <td className="py-2 px-3 font-mono text-xs text-text-primary">{run.jobName}</td>
                          <td className="py-2 px-3 text-xs text-text-muted">
                            {run.startedAt
                              ? new Date(run.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                              : "—"}
                            {isStale && <span className="ml-1.5 text-warning text-[10px] font-medium">STALE</span>}
                          </td>
                          <td className="py-2 px-3">
                            {run.status === "success" ? (
                              <span className="flex items-center gap-1 text-success text-xs"><CheckCircle className="h-3 w-3" /> success</span>
                            ) : run.status === "failed" ? (
                              <span className="flex items-center gap-1 text-danger text-xs"><XCircle className="h-3 w-3" /> failed</span>
                            ) : run.status === "running" ? (
                              <span className="flex items-center gap-1 text-warning text-xs"><Clock className="h-3 w-3" /> running</span>
                            ) : (
                              <span className="flex items-center gap-1 text-warning text-xs"><AlertTriangle className="h-3 w-3" /> {run.status}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-xs text-text-muted tabular-nums">
                            {run.durationMs !== null && run.durationMs !== undefined ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                          </td>
                          <td className="py-2 px-3 text-xs text-text-muted tabular-nums">
                            {run.recordsProcessed ?? "—"}
                          </td>
                          <td className="py-2 px-3 text-xs text-danger max-w-[200px] truncate">
                            {run.errorMessage || "—"}
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

        {/* ── All Tenants (collapsible) ──────────────────────────────── */}
        <Card className="mb-4">
          <CardHeader>
            <button
              className="flex items-center justify-between w-full"
              onClick={() => setShowAllTenants(v => !v)}
            >
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">All Tenants ({data.allTenants.length})</CardTitle>
              </div>
              {showAllTenants ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
            </button>
          </CardHeader>
          {showAllTenants && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Company</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Plan</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">State</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Days Left</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Created</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Stripe ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.allTenants.map(t => (
                      <tr key={t.id} className="border-b border-border-light hover:bg-bg-primary/50">
                        <td className="py-2 px-3 font-medium text-text-primary">{t.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant={t.plan === "pro" ? "accent" : t.plan === "enterprise" ? "gold" : "default"} className="text-xs">
                            {t.plan || "lite"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{stateBadge(t.billingState)}</td>
                        <td className={cn("py-2 px-3 tabular-nums text-xs", daysColor(t.daysRemaining))}>
                          {t.daysRemaining !== null && t.daysRemaining !== undefined ? `${t.daysRemaining}d` : "—"}
                        </td>
                        <td className="py-2 px-3 text-text-muted text-xs">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 px-3 text-text-muted text-xs font-mono truncate max-w-[140px]">
                          {t.stripeSubscriptionId || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Recent Events Feed ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Events (last 50)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing} className="gap-1.5 h-7 text-xs">
                <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentEvents.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No events recorded yet</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {data.recentEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border-light last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                        EVENT_BADGE_VARIANT[ev.eventName] ?? "bg-bg-primary text-text-muted"
                      )}>
                        {ev.eventName.replace(/_/g, " ")}
                      </span>
                      <span className="text-text-muted truncate font-mono text-[11px]">{ev.userId.slice(0, 8)}…</span>
                    </div>
                    <span className="text-text-muted shrink-0">
                      {ev.occurredAt
                        ? new Date(ev.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
