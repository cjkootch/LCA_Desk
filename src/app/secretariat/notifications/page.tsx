"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Bell, Mail, MailCheck, Clock } from "lucide-react";
import { fetchSecretariatNotifications } from "@/server/actions";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  deadline_warning: "text-warning",
  deadline_overdue: "text-danger",
  report_submitted: "text-success",
  cert_expiring: "text-warning",
  welcome: "text-accent",
  application_received: "text-accent",
  application_status: "text-accent",
  team_invite: "text-accent",
};

export default function NotificationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchSecretariatNotifications({ type: typeFilter !== "all" ? typeFilter : undefined })
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-gold" />
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Notification Center</h1>
            <p className="text-sm text-text-secondary">{data?.total || 0} notifications across all users</p>
          </div>
        </div>
        {data?.types && (
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            options={[{ value: "all", label: "All Types" }, ...data.types.map((t: string) => ({ value: t, label: t.replace(/_/g, " ") }))]} />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
      ) : !data || data.notifications.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-text-muted">No notifications found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((n: any) => (
            <Card key={n.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn("p-2 rounded-lg shrink-0", n.emailSent ? "bg-success/10" : "bg-bg-primary")}>
                  {n.emailSent ? <MailCheck className="h-4 w-4 text-success" /> : <Bell className="h-4 w-4 text-text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-text-primary">{n.title}</p>
                    <Badge variant="default" className="text-xs">{n.type.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-text-secondary mb-1">{n.message}</p>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>{n.userName} ({n.userEmail})</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</span>
                    {n.emailSent && <span className="flex items-center gap-1 text-success"><Mail className="h-3 w-3" />Email sent</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
