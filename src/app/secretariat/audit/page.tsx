"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Search, History, FileText, User, Building2 } from "lucide-react";
import { fetchSecretariatAuditTrail } from "@/server/actions";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-success/10 text-success",
  update: "bg-accent/10 text-accent",
  delete: "bg-danger/10 text-danger",
  submit: "bg-gold/10 text-gold",
  approve: "bg-success/10 text-success",
  reject: "bg-danger/10 text-danger",
  attest: "bg-accent/10 text-accent",
  lock: "bg-warning/10 text-warning",
  cancel_subscription: "bg-danger/10 text-danger",
  delete_account: "bg-danger/10 text-danger",
};

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

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <History className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Audit Trail</h1>
          <p className="text-sm text-text-secondary">Activity log across all platform users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
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
        <Card><CardContent className="py-12 text-center text-sm text-text-muted">No audit records found.</CardContent></Card>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <Card key={log.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className={cn("px-2 py-1 rounded text-xs font-medium shrink-0", ACTION_COLORS[log.action] || "bg-bg-primary text-text-muted")}>
                  {log.action.replace(/_/g, " ")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.userName && <span className="text-sm font-medium text-text-primary flex items-center gap-1"><User className="h-3 w-3" />{log.userName}</span>}
                    {log.tenantName && <span className="text-xs text-text-muted flex items-center gap-1"><Building2 className="h-3 w-3" />{log.tenantName}</span>}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {log.entityType.replace(/_/g, " ")}
                    {log.fieldName && <> · field: <span className="font-mono">{log.fieldName}</span></>}
                    {log.oldValue && <> · from: <span className="text-text-muted">{log.oldValue.slice(0, 30)}</span></>}
                    {log.newValue && <> · to: <span className="text-text-primary font-medium">{log.newValue.slice(0, 30)}</span></>}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
