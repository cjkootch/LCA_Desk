"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { checkSuperAdmin, fetchPlgStats, fetchDemoAccessLog, fetchTenantUsers, toggleUserDemo, fetchTenantActivity, fetchTenantReports, fetchRealCompanies } from "@/server/actions";
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
type TenantActivity = Awaited<ReturnType<typeof fetchTenantActivity>>[number];
type TenantReport = Awaited<ReturnType<typeof fetchTenantReports>>[number];
type TenantReportPeriod = TenantReport["periods"][number];

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

function formatDuration(ms: number) {
  if (ms < 1000) return "<1s";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
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

function AccountTypeBadge({ type, reasons }: { type?: string; reasons?: string[] }) {
  const cfg = {
    company: { label: "Company", cls: "bg-success/15 text-success" },
    individual: { label: "Individual", cls: "bg-warning/15 text-warning" },
    unclear: { label: "Unclear", cls: "bg-border text-text-muted" },
  }[type || "unclear"] || { label: "Unclear", cls: "bg-border text-text-muted" };
  return (
    <span
      className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", cfg.cls)}
      title={reasons && reasons.length ? reasons.join(" · ") : undefined}
    >
      {cfg.label}
    </span>
  );
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

function ActivityBadge({ label, kind }: { label: string; kind: "event" | "audit" }) {
  const lower = label.toLowerCase();
  let cls = kind === "audit" ? "bg-accent/10 text-accent" : "bg-bg-primary text-text-muted";
  if (lower.includes("create") || lower.includes("added")) cls = "bg-success/15 text-success";
  else if (lower.includes("delete") || lower.includes("removed")) cls = "bg-danger/15 text-danger";
  else if (lower.includes("submit")) cls = "bg-gold/15 text-gold";
  else if (lower.includes("trial")) cls = "bg-accent/15 text-accent";
  else if (lower.includes("upgrade")) cls = "bg-gold/15 text-gold";
  else if (lower.includes("dismiss") || lower.includes("fail")) cls = "bg-warning/15 text-warning";

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

function formatDay(d: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PeriodStatusBadge({ status }: { status: string | null }) {
  const s = status ?? "not_started";
  const map: Record<string, string> = {
    not_started: "bg-bg-primary text-text-muted",
    in_progress: "bg-accent/15 text-accent",
    in_review: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    submitted: "bg-gold/15 text-gold",
    acknowledged: "bg-success/20 text-success",
  };
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", map[s] ?? "bg-bg-primary text-text-muted")}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

function RecordMiniTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">{title} ({rows.length})</div>
      <div className="overflow-x-auto rounded border border-border-light">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-bg-secondary">
              {headers.map(h => (
                <th key={h} className="text-left py-1 px-2 font-medium text-text-muted whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border-light">
                {r.map((cell, j) => (
                  <td key={j} className="py-1 px-2 text-text-primary align-top">{cell === "" || cell === null ? "—" : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeriodRow({ period }: { period: TenantReportPeriod }) {
  const [open, setOpen] = useState(false);
  const c = period.counts;
  const totalRecords = c.expenditures + c.employment + c.capacity + c.narratives;

  return (
    <div className="border-t border-border-light first:border-t-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-bg-secondary/50 transition-colors"
      >
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-text-muted transition-transform", open && "rotate-180")} />
        <span className="font-medium text-text-primary text-xs whitespace-nowrap">{period.reportType}</span>
        <span className="text-[11px] text-text-muted whitespace-nowrap">{formatDay(period.periodStart)} – {formatDay(period.periodEnd)}</span>
        <PeriodStatusBadge status={period.status} />
        <span className="ml-auto text-[10px] text-text-muted whitespace-nowrap">
          {totalRecords} record{totalRecords === 1 ? "" : "s"}
          {period.submittedAt && <span className="text-gold"> · submitted {formatDay(period.submittedAt)}</span>}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-text-muted mb-1">
            <span>Due {formatDay(period.dueDate)}</span>
            <span>Expenditures: {c.expenditures}</span>
            <span>Employment: {c.employment}</span>
            <span>Capacity: {c.capacity}</span>
            <span>Narratives: {c.narratives}</span>
          </div>
          {totalRecords === 0 ? (
            <div className="text-[11px] text-text-muted italic py-1">No records entered for this period.</div>
          ) : (
            <>
              <RecordMiniTable
                title="Expenditures"
                headers={["Item", "Supplier", "Type", "Actual Payment", "Currency"]}
                rows={period.records.expenditures.map(r => [
                  r.typeOfItemProcured, r.supplierName, r.supplierType ?? "", r.actualPayment ?? "", r.currencyOfPayment ?? "",
                ])}
              />
              <RecordMiniTable
                title="Employment"
                headers={["Job Title", "Category", "Total", "Guyanese", "Remuneration"]}
                rows={period.records.employment.map(r => [
                  r.jobTitle, r.employmentCategory, r.totalEmployees, r.guyaneseEmployed, r.totalRemunerationPaid ?? "",
                ])}
              />
              <RecordMiniTable
                title="Capacity Development"
                headers={["Activity", "Category", "Participants", "Guyanese", "Expenditure"]}
                rows={period.records.capacity.map(r => [
                  r.activity, r.category ?? "", r.totalParticipants ?? 0, r.guyaneseParticipantsOnly ?? 0, r.expenditureOnCapacity ?? "",
                ])}
              />
              <RecordMiniTable
                title="Narratives"
                headers={["Section", "Approved?", "Content"]}
                rows={period.records.narratives.map(r => [
                  r.section, r.isApproved ? "Yes" : "No", r.draftContent.length > 140 ? r.draftContent.slice(0, 140) + "…" : r.draftContent,
                ])}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TenantReports({ reports }: { reports: TenantReport[] | null }) {
  const entityCount = reports?.length ?? 0;
  const periodCount = reports?.reduce((n, e) => n + e.periods.length, 0) ?? 0;

  return (
    <>
      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Reports &amp; Entered Data
        </div>
        <span className="text-[10px] text-text-muted">
          {entityCount} {entityCount === 1 ? "entity" : "entities"} · {periodCount} {periodCount === 1 ? "period" : "periods"}
        </span>
      </div>

      {!reports || reports.length === 0 ? (
        <div className="py-3 px-4 text-xs text-text-muted italic">No entities or reports created yet.</div>
      ) : (
        <div className="px-2 pb-2 space-y-2">
          {reports.map(e => (
            <div key={e.id} className="rounded-lg border border-border-light bg-bg-secondary/30">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                <span className="font-semibold text-text-primary text-xs">{e.legalName}</span>
                {e.tradingName && <span className="text-[11px] text-text-muted">({e.tradingName})</span>}
                {e.registrationNumber && <span className="text-[10px] text-text-muted font-mono">#{e.registrationNumber}</span>}
                {!e.active && <span className="text-[10px] text-danger">inactive</span>}
                <span className="ml-auto text-[10px] text-text-muted">{e.periods.length} {e.periods.length === 1 ? "period" : "periods"}</span>
              </div>
              {e.periods.length === 0 ? (
                <div className="py-2 px-3 text-[11px] text-text-muted italic">No reporting periods yet.</div>
              ) : (
                <div>
                  {e.periods.map(p => <PeriodRow key={p.id} period={p} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
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
  const [activity, setActivity] = useState<TenantActivity[] | null>(null);
  const [reports, setReports] = useState<TenantReport[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchTenantUsers(tenantId),
      fetchTenantActivity(tenantId).catch(() => [] as TenantActivity[]),
      fetchTenantReports(tenantId).catch(() => [] as TenantReport[]),
    ]).then(([u, a, r]) => {
      setUsers(u);
      setActivity(a);
      setReports(r);
    }).finally(() => setLoading(false));
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
            Loading account data…
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="bg-bg-primary border-b border-border mx-2 mb-2 rounded-lg overflow-hidden">
          {/* Users table */}
          {users && users.length > 0 ? (
            <>
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Team</div>
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
            </>
          ) : (
            <div className="py-3 px-4 text-xs text-text-muted italic">No users found for this tenant.</div>
          )}

          {/* Reports — everything the company has entered */}
          <TenantReports reports={reports} />

          {/* Activity timeline */}
          <div className="px-4 pt-4 pb-1 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Recent Activity (last 30 days)
            </div>
            {activity && (
              <span className="text-[10px] text-text-muted">
                {activity.length} {activity.length === 1 ? "action" : "actions"}
              </span>
            )}
          </div>

          {!activity || activity.length === 0 ? (
            <div className="py-3 px-4 text-xs text-text-muted italic">No activity recorded yet.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bg-secondary border-b border-border sticky top-0">
                    <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">When</th>
                    <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">User</th>
                    <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Action</th>
                    <th className="text-left py-2 px-4 text-xs text-text-muted font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map(row => (
                    <tr key={row.id} className="border-b border-border-light last:border-0">
                      <td className="py-2 px-4 text-text-muted whitespace-nowrap">
                        {formatTimeAgo(row.occurredAt)}
                      </td>
                      <td className="py-2 px-4 text-text-primary whitespace-nowrap">
                        {row.userName || row.userEmail || <span className="text-text-muted italic">System</span>}
                      </td>
                      <td className="py-2 px-4">
                        <ActivityBadge label={row.label} kind={row.kind} />
                      </td>
                      <td className="py-2 px-4 text-text-muted font-mono text-[10px] truncate max-w-[280px]">
                        {row.detail || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  const [demoRefreshing, setDemoRefreshing] = useState(false);
  const [showAllTenants, setShowAllTenants] = useState(false);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [realCompanies, setRealCompanies] = useState<Awaited<ReturnType<typeof fetchRealCompanies>> | null>(null);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [d, logs] = await Promise.all([fetchPlgStats(), fetchDemoAccessLog()]);
      setData(d);
      setDemoLogs(logs);
      setLastUpdated(new Date());
      fetchRealCompanies().then(setRealCompanies).catch(() => {});
    } catch {
      // silently fail on refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  const refreshDemoLog = useCallback(async () => {
    setDemoRefreshing(true);
    try {
      const logs = await fetchDemoAccessLog();
      setDemoLogs(logs);
    } catch {
      // silently fail
    } finally {
      setDemoRefreshing(false);
    }
  }, []);

  // Auto-refresh demo log every 30 seconds so active visitors update in near real-time
  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(refreshDemoLog, 30000);
    return () => clearInterval(interval);
  }, [authorized, refreshDemoLog]);

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

        {/* ── Real Companies (from Neon, by actual filing activity) ───── */}
        {realCompanies && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm">Real Companies — by actual product activity</CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-text-muted">{realCompanies.summary.total} total</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-border" /> {realCompanies.summary.createdEntity} created entity</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> <strong className="text-text-primary">{realCompanies.summary.enteredData}</strong> entered data</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> <strong className="text-text-primary">{realCompanies.summary.submitted}</strong> submitted</span>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Source of truth from the app database. &quot;Entered data&quot; = added real expenditure or employment records — these are genuinely engaged companies, not tire-kickers.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {realCompanies.summary.enteredData === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">
                  No company has entered real filing data yet. The number that matters for activation (and for the pitch) is this one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-primary">
                      <tr>
                        <th className="text-left p-3 font-medium text-text-muted">Company</th>
                        <th className="text-left p-3 font-medium text-text-muted">Owner</th>
                        <th className="text-left p-3 font-medium text-text-muted">Stage</th>
                        <th className="text-left p-3 font-medium text-text-muted">Entities</th>
                        <th className="text-left p-3 font-medium text-text-muted">Expenditure</th>
                        <th className="text-left p-3 font-medium text-text-muted">Employment</th>
                        <th className="text-left p-3 font-medium text-text-muted">Submitted</th>
                        <th className="text-left p-3 font-medium text-text-muted">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realCompanies.rows.filter(r => r.level === "entered_data" || r.level === "submitted").map(r => {
                        const stage = r.level === "submitted"
                          ? { label: "Submitted", cls: "bg-success/15 text-success" }
                          : { label: "Entered data", cls: "bg-accent/15 text-accent" };
                        return (
                          <tr key={r.id} className="border-t border-border hover:bg-bg-primary/50">
                            <td className="p-3 font-medium text-text-primary">{r.name}</td>
                            <td className="p-3 text-text-muted">
                              {r.ownerEmail ? <a href={`mailto:${r.ownerEmail}`} className="hover:text-accent">{r.ownerEmail}</a> : "—"}
                            </td>
                            <td className="p-3">
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", stage.cls)}>{stage.label}</span>
                            </td>
                            <td className="p-3 tabular-nums text-text-secondary">{r.entityCount}</td>
                            <td className="p-3 tabular-nums text-text-secondary">{r.expCount}</td>
                            <td className="p-3 tabular-nums text-text-secondary">{r.empCount}</td>
                            <td className="p-3 tabular-nums text-text-secondary">{r.submitted}</td>
                            <td className="p-3">
                              <Badge variant={r.plan === "pro" ? "accent" : r.plan === "enterprise" ? "gold" : "default"} className="text-xs">{r.plan || "lite"}</Badge>
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
        )}

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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Active Trials ({data.trialList.length})</CardTitle>
              </div>
              {data.accountQuality && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-text-muted">Lead quality:</span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="font-medium text-text-primary">{data.accountQuality.trials.company}</span>
                    <span className="text-text-muted">company</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    <span className="font-medium text-text-primary">{data.accountQuality.trials.individual}</span>
                    <span className="text-text-muted">individual</span>
                  </span>
                  {data.accountQuality.trials.unclear > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-border" />
                      <span className="font-medium text-text-primary">{data.accountQuality.trials.unclear}</span>
                      <span className="text-text-muted">unclear</span>
                    </span>
                  )}
                </div>
              )}
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
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Owner</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Type</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Plan</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Days Left</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Trial Started</th>
                      <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trialList.map(t => (
                      <Fragment key={t.id}>
                        <tr
                          className="border-b border-border-light hover:bg-bg-primary/50 cursor-pointer"
                          onClick={() => handleTenantClick(t.id)}
                        >
                          <td className="py-2 px-3 text-text-muted">
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandedTenant === t.id && "rotate-180")} />
                          </td>
                          <td className="py-2 px-3 font-medium text-text-primary">{t.name}</td>
                          <td className="py-2 px-3 text-text-muted text-xs">
                            {t.ownerEmail ? (
                              <a href={`mailto:${t.ownerEmail}`} onClick={e => e.stopPropagation()} className="hover:text-accent">
                                {t.ownerEmail}
                              </a>
                            ) : "—"}
                          </td>
                          <td className="py-2 px-3"><AccountTypeBadge type={t.accountType} reasons={t.qualityReasons} /></td>
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
                            tenantId={t.id}
                            onUserToggle={handleUserToggle}
                          />
                        )}
                      </Fragment>
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
                      <Fragment key={t.id}>
                        <tr
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
                            tenantId={t.id}
                            onUserToggle={handleUserToggle}
                          />
                        )}
                      </Fragment>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Demo Visitors (last 24h)</CardTitle>
                {demoLogs.filter(s => s.status === "active").length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/15 text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    {demoLogs.filter(s => s.status === "active").length} on site now
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshDemoLog}
                disabled={demoRefreshing}
                className="gap-1.5 h-7 text-xs"
              >
                <RefreshCw className={cn("h-3 w-3", demoRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-1">Sessions grouped by IP · auto-refreshes every 30s · your own IP is filtered</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-b-xl">
              <table className="w-full text-xs">
                <thead className="bg-bg-primary">
                  <tr>
                    <th className="text-left p-3 font-medium text-text-muted">Status</th>
                    <th className="text-left p-3 font-medium text-text-muted">Location</th>
                    <th className="text-left p-3 font-medium text-text-muted">Arrived</th>
                    <th className="text-left p-3 font-medium text-text-muted">Last Seen</th>
                    <th className="text-left p-3 font-medium text-text-muted">Time on Site</th>
                    <th className="text-left p-3 font-medium text-text-muted">Role Picked</th>
                    <th className="text-left p-3 font-medium text-text-muted">IP / Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {demoLogs.map(session => {
                    const statusConfig = {
                      active: { label: "On site", cls: "bg-success/15 text-success", dot: "bg-success animate-pulse" },
                      recent: { label: "Recent", cls: "bg-warning/15 text-warning", dot: "bg-warning" },
                      departed: { label: "Left", cls: "bg-border text-text-muted", dot: "bg-text-muted/40" },
                    }[session.status];
                    return (
                      <tr key={session.id} className={cn(
                        "border-t border-border hover:bg-bg-primary/50",
                        session.status === "active" && "bg-success/5"
                      )}>
                        <td className="p-3 whitespace-nowrap">
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium", statusConfig.cls)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dot)} />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="p-3">
                          {session.geo ? (
                            <div>
                              <div className="text-text-primary font-medium">{session.geo.city}</div>
                              <div className="text-text-muted text-[10px]">
                                {session.geo.region && `${session.geo.region}, `}{session.geo.country}
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-muted italic">Unknown</span>
                          )}
                        </td>
                        <td className="p-3 text-text-secondary whitespace-nowrap">{formatTimeAgo(session.firstSeen)}</td>
                        <td className="p-3 text-text-secondary whitespace-nowrap">{formatTimeAgo(session.lastSeen)}</td>
                        <td className="p-3 text-text-primary font-medium tabular-nums">{formatDuration(session.durationMs)}</td>
                        <td className="p-3">
                          {session.rolesSelected.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {session.rolesSelected.map((r, i) => (
                                <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-medium">
                                  {r}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-text-muted/60 text-[10px]">Browsing</span>
                          )}
                          {session.lastPage && (
                            <div className="text-[10px] text-text-muted mt-1 truncate max-w-[160px] font-mono">
                              {session.status === "active" ? "→ " : "last: "}{session.lastPage}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-text-muted text-[11px]">{session.ip}</div>
                          <div className="text-text-muted text-[10px] mt-0.5">{truncateUA(session.userAgent)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {demoLogs.length === 0 && (
                <div className="p-6 text-center text-xs text-text-muted">No demo visits in the last 24 hours</div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
