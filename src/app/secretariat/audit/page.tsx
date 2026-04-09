"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, History, User, Building2, Shield, FileText, AlertTriangle, CheckCircle, XCircle, Lock, Trash2 } from "lucide-react";
import { fetchSecretariatAuditTrail } from "@/server/actions";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<string, { color: string; icon: typeof FileText; label: string }> = {
  create: { color: "bg-success/10 text-success", icon: FileText, label: "Created" },
  update: { color: "bg-accent/10 text-accent", icon: FileText, label: "Updated" },
  delete: { color: "bg-danger/10 text-danger", icon: Trash2, label: "Deleted" },
  submit: { color: "bg-gold/10 text-gold", icon: CheckCircle, label: "Submitted" },
  approve: { color: "bg-success/10 text-success", icon: CheckCircle, label: "Approved" },
  reject: { color: "bg-danger/10 text-danger", icon: XCircle, label: "Rejected" },
  attest: { color: "bg-accent/10 text-accent", icon: Shield, label: "Attested" },
  lock: { color: "bg-warning/10 text-warning", icon: Lock, label: "Locked" },
  cancel_subscription: { color: "bg-danger/10 text-danger", icon: AlertTriangle, label: "Cancelled" },
  delete_account: { color: "bg-danger/10 text-danger", icon: Trash2, label: "Account Deleted" },
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AuditTrailPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const load = () => {
    setLoading(true);
    fetchSecretariatAuditTrail({ search: search || undefined, action: actionFilter !== "all" ? actionFilter : undefined })
      .then(setLogs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [actionFilter]);

  const actions = [...new Set(logs.map(l => l.action))].sort();

  // Compute summary stats from loaded data
  const todayCount = logs.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const uniqueUsers = new Set(logs.map(l => l.userName).filter(Boolean)).size;
  const submitCount = logs.filter(l => l.action === "submit").length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <History className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Audit Trail</h1>
          <p className="text-sm text-text-secondary">Every action taken on the platform — submissions, approvals, amendments, and account changes</p>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-4">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{logs.length}</p>
            <p className="text-xs text-text-muted">Total Events</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-accent">{todayCount}</p>
            <p className="text-xs text-text-muted">Today</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{uniqueUsers}</p>
            <p className="text-xs text-text-muted">Active Users</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-gold">{submitCount}</p>
            <p className="text-xs text-text-muted">Submissions</p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 mt-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search user, company, action..." className="pl-9" />
        </div>
        <Select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          options={[{ value: "all", label: "All Actions" }, ...actions.map(a => ({ value: a, label: a.replace(/_/g, " ") }))]} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit records yet"
          description="This log automatically records every significant action on the platform — report submissions, secretariat reviews, approvals, amendments, and account changes. Events will appear here as users interact with LCA Desk."
        />
      ) : (
        <div className="space-y-1">
          {logs.map(log => {
            const cfg = ACTION_CONFIG[log.action] || { color: "bg-bg-primary text-text-muted", icon: FileText, label: log.action.replace(/_/g, " ") };
            const Icon = cfg.icon;
            return (
              <Card key={log.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", cfg.color.split(" ")[0])}>
                    <Icon className={cn("h-3.5 w-3.5", cfg.color.split(" ")[1])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="default" className="text-xs">{cfg.label}</Badge>
                      <span className="text-xs text-text-muted">{log.entityType.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {log.userName && <span className="text-sm font-medium text-text-primary flex items-center gap-1"><User className="h-3 w-3 text-text-muted" />{log.userName}</span>}
                      {log.tenantName && <span className="text-xs text-text-muted flex items-center gap-1"><Building2 className="h-3 w-3" />{log.tenantName}</span>}
                    </div>
                    {(log.fieldName || log.oldValue || log.newValue) && (
                      <div className="mt-1 text-xs bg-bg-primary rounded-md px-2 py-1 inline-flex items-center gap-1.5 flex-wrap">
                        {log.fieldName && <span className="font-mono text-text-secondary">{log.fieldName}</span>}
                        {log.oldValue && <><span className="text-text-muted">from</span> <span className="line-through text-text-muted">{log.oldValue.slice(0, 40)}</span></>}
                        {log.newValue && <><span className="text-text-muted">{log.oldValue ? "→" : "set to"}</span> <span className="font-medium text-text-primary">{log.newValue.slice(0, 40)}</span></>}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-text-muted shrink-0 mt-1">{log.createdAt ? timeAgo(new Date(log.createdAt)) : ""}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
