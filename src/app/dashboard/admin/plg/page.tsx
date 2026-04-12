"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkSuperAdmin, fetchPlgStats, fetchDemoAccessLog, fetchTenantUsers, toggleUserDemo } from "@/server/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp, ArrowLeft, RefreshCw, Clock, CheckCircle,
  AlertTriangle, XCircle, ChevronDown, ChevronUp, Activity, Globe,
} from "lucide-react";

type PlgData = Awaited<ReturnType<typeof fetchPlgStats>>;
type DemoLog = Awaited<ReturnType<typeof fetchDemoAccessLog>>[number];
type TenantUser = Awaited<ReturnType<typeof fetchTenantUsers>>[number];

// Your IP is filtered server-side (see EXCLUDED_IPS in src/server/actions.ts)

function truncateUA(ua?: string) {
  if (!ua || ua === "unknown") return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30) + "...";
}

function formatTimeAgo(date: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

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

function TenantUserRow({
  user,
  onToggle,
}: {
  user: TenantUser;
  onToggle: (userId: string, newValue: boolean) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(user.userId, !user.isDemo);
    } finally {
      setToggling(false);
    }
  }

  return (
    <tr className="border-b border-border-light last:border-0">
      <td className="py-2 px-4 text-sm text-text-primary">{user.userName || "—"}</td>
      <td className="py-2 px-4 text-sm text-text-muted">{user.userEmail}</td>
      <td className="py-2 px-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-border text-text-muted">
          {user.role}
        </span>
      </td>
      <td className="py-2 px-4">
        {user.isDemo ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gold/15 text-gold">
            Demo
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-bg-primary text-text-muted border border-border">
            Real
          </span>
        )}
      </td>
      <td className="py-2 px-4">
        <Button
          size="sm"
          variant="outline"
          onClick={handleToggle}
          disabled={toggling}
          className="h-6 text-xs px-2"
        >
          {toggling ? "..." : user.isDemo ? "Unmark Demo" : "Flag as Demo"}
        </Button>
      </td>
    </tr>
  );
}

function TenantDrillDown({
  tenantId,
  onUserToggle,
}: {
  tenantId: string;
  onUserToggle: (tenantId: string, userId: string, newValue: boolean) => void;
}) {
  const [users, setUsers] = useState<TenantUser[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenantUsers(tenantId).then(setUsers).finally(() => setLoading(false));
  }, [tenantId]);

  async function handleToggle(userId: string, newValue: boolean) {
    await toggleUserDemo(userId, newValue);
    setUsers(prev =>
      prev
        ? prev.map(u => u.userId === userId ? { ...u, isDemo: newValue } : u)
        : prev
    );
    onUserToggle(tenantId, userId, newValue);
  }

  if (loading) {
    return (
      <tr>
        <td colSpan={10} className="py-4 px-4">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-accent" />
            Loading users…
          </div>
        </td>
      </tr>
    );
  }

  if (!users || users.length === 0) {
    return (
      <tr>
        <td colSpan={10} className="py-3 px-4 text-xs text-text-muted italic">No users found for this tenant.</td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="bg-bg-primary border-b border-border mx-2 mb-2 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border">
                <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Name</th>
                <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Email</th>
                <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Role</th>
                <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Demo?</th>
                <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <TenantUserRow key={u.userId} user={u} onToggle={handleToggle} />
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function PlgPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlgData | null>(null);
  const [demoLogs, setDemoLogs] = useState<DemoLog[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllTenants, setShowAllTenants] = useState(false);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [d, logs] = await Promise.all([fetchPlgStats(), fetchDemoAccessLog()]);
      setData(d);
      setDemoLogs(logs);
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

  function handleTenantClick(tenantId: string) {
    setExpandedTenant(prev => prev === tenantId ? null : tenantId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleUserToggle(_tenantId: string, _userId: string, _newValue: boolean) {
    // Local state is updated within TenantDrillDown; nothing needed at page level
  }

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
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
        <p className="text-xs text-text-muted mb-6">
          Stats exclude demo accounts. Flag users as demo from the tenant drill-down to keep data clean.
        </p>

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
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium w-6" />
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Company</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Plan</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Days Left</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Trial Started</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trialList.map(t => (
                      <>
                        <tr
                          key={t.id}
                          className="border-b border-border-light hover:bg-bg-primary/50 cursor-pointer"
                          onClick={() => handleTenantClick(t.id)}
                        >
                          <td className="py-2 px-3 text-text-muted">
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandedTenant === t.id && "rotate-180")} />
                          </td>
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
                        {expandedTenant === t.id && (
                          <TenantDrillDown
                            key={`drill-${t.id}`}
                            tenantId={t.id}
                            onUserToggle={handleUserToggle}
                          />
                        )}
                      </>
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
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium w-6" />
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
                      <>
                        <tr
                          key={t.id}
                          className="border-b border-border-light hover:bg-bg-primary/50 cursor-pointer"
                          onClick={() => handleTenantClick(t.id)}
                        >
                          <td className="py-2 px-3 text-text-muted">
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandedTenant === t.id && "rotate-180")} />
                          </td>
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
                        {expandedTenant === t.id && (
                          <TenantDrillDown
                            key={`drill-${t.id}`}
                            tenantId={t.id}
                            onUserToggle={handleUserToggle}
                          />
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Recent Events Feed ─────────────────────────────────────── */}
        <Card className="mb-4">
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
              <div className="space-y-1 max-h-[28rem] overflow-y-auto">
                {data.recentEvents.map(ev => {
                  const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
                  const isAnon = ev.userId === ZERO_UUID;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const props = ev.properties as any;
                  const detail = props?.role
                    ? `as ${props.label || props.role}`
                    : props?.ip && props.ip !== "unknown"
                    ? `from ${props.ip}`
                    : null;
                  return (
                    <div key={ev.id} className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded hover:bg-bg-primary border-b border-border-light last:border-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                          EVENT_BADGE_VARIANT[ev.eventName] ?? "bg-bg-primary text-text-muted"
                        )}>
                          {ev.eventName.replace(/_/g, " ")}
                        </span>
                        <div className="min-w-0 flex-1 truncate">
                          {isAnon ? (
                            <span className="text-text-muted italic">Anonymous visitor</span>
                          ) : (
                            <>
                              <span className="font-medium text-text-primary">{ev.userName || ev.userEmail || "Unknown user"}</span>
                              {ev.tenantName && <span className="text-text-muted"> · {ev.tenantName}</span>}
                            </>
                          )}
                          {detail && <span className="text-text-muted"> · {detail}</span>}
                        </div>
                      </div>
                      <span className="text-text-muted shrink-0 text-[11px]">
                        {ev.occurredAt
                          ? new Date(ev.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Demo Access Log ───────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Demo Access Log</CardTitle>
            </div>
            <p className="text-xs text-text-muted mt-1">External visitors to /try — your own IP is filtered out</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-b-xl">
              <table className="w-full text-xs">
                <thead className="bg-bg-primary">
                  <tr>
                    <th className="text-left p-3 font-medium text-text-muted">Time</th>
                    <th className="text-left p-3 font-medium text-text-muted">Event</th>
                    <th className="text-left p-3 font-medium text-text-muted">Location</th>
                    <th className="text-left p-3 font-medium text-text-muted">IP / Browser</th>
                    <th className="text-left p-3 font-medium text-text-muted">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {demoLogs.map(log => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const props = log.properties as any;
                    const ip = props?.ip as string | undefined;
                    const geo = props?.geo as { city: string; country: string; region?: string } | null;
                    return (
                      <tr key={log.id} className="border-t border-border hover:bg-bg-primary/50">
                        <td className="p-3 text-text-secondary whitespace-nowrap">{formatTimeAgo(log.occurredAt)}</td>
                        <td className="p-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-medium",
                            log.eventName === "demo_login_requested" ? "bg-accent/10 text-accent" : "bg-gold/10 text-gold"
                          )}>
                            {log.eventName === "demo_login_requested" ? "Page Visit" : "Role Selected"}
                          </span>
                        </td>
                        <td className="p-3">
                          {geo ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-text-primary font-medium">{geo.city}</span>
                              <span className="text-text-muted">·</span>
                              <span className="text-text-muted">{geo.country}</span>
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Unknown</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-text-muted text-[11px]">{ip || "—"}</div>
                          <div className="text-text-muted text-[10px] mt-0.5">{truncateUA(props?.userAgent as string | undefined)}</div>
                        </td>
                        <td className="p-3 text-text-muted">
                          {props?.role ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-medium">
                              {props.label || props.role}
                            </span>
                          ) : (
                            <span className="text-text-muted/60">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {demoLogs.length === 0 && (
                <div className="p-6 text-center text-xs text-text-muted">No demo visits yet</div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
