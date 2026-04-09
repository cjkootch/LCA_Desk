"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bell, Mail, MailCheck, Clock, AlertTriangle, CheckCircle, UserPlus, Calendar, Shield } from "lucide-react";
import { fetchSecretariatNotifications } from "@/server/actions";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { color: string; variant: "default" | "success" | "warning" | "danger" | "accent" | "gold"; icon: typeof Bell }> = {
  deadline_warning: { color: "text-warning", variant: "warning", icon: Calendar },
  deadline_overdue: { color: "text-danger", variant: "danger", icon: AlertTriangle },
  report_submitted: { color: "text-success", variant: "success", icon: CheckCircle },
  cert_expiring: { color: "text-warning", variant: "warning", icon: Shield },
  welcome: { color: "text-accent", variant: "accent", icon: UserPlus },
  application_received: { color: "text-accent", variant: "accent", icon: UserPlus },
  application_status: { color: "text-accent", variant: "accent", icon: Shield },
  team_invite: { color: "text-accent", variant: "accent", icon: UserPlus },
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetchSecretariatNotifications({ type: typeFilter !== "all" ? typeFilter : undefined })
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [typeFilter]);

  const notifications = data?.notifications || [];
  const emailsSent = notifications.filter((n: { emailSent: boolean }) => n.emailSent).length;
  const todayCount = notifications.filter((n: { createdAt: string }) => n.createdAt && new Date(n.createdAt).toDateString() === new Date().toDateString()).length;
  const overdueCount = notifications.filter((n: { type: string }) => n.type === "deadline_overdue").length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-gold" />
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Notification Center</h1>
            <p className="text-sm text-text-secondary">Platform-wide alerts — deadline reminders, submissions, and system events sent to all users</p>
          </div>
        </div>
        {data?.types && data.types.length > 0 && (
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            options={[{ value: "all", label: "All Types" }, ...data.types.map((t: string) => ({ value: t, label: t.replace(/_/g, " ") }))]} />
        )}
      </div>

      {/* Summary stats */}
      {!loading && notifications.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{data?.total || 0}</p>
            <p className="text-xs text-text-muted">Total Notifications</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-accent">{todayCount}</p>
            <p className="text-xs text-text-muted">Today</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{emailsSent}</p>
            <p className="text-xs text-text-muted">Emails Sent</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-danger">{overdueCount}</p>
            <p className="text-xs text-text-muted">Overdue Alerts</p>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="This center shows all platform notifications sent to users — deadline reminders, overdue alerts, submission confirmations, welcome emails, and system events. Notifications will appear here as they are triggered."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n: { id: string; title: string; message: string; type: string; userName: string; userEmail: string; emailSent: boolean; createdAt: string }) => {
            const cfg = TYPE_CONFIG[n.type] || { color: "text-text-muted", variant: "default" as const, icon: Bell };
            const Icon = cfg.icon;
            return (
              <Card key={n.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg shrink-0", n.emailSent ? "bg-success/10" : "bg-bg-primary")}>
                    <Icon className={cn("h-4 w-4", n.emailSent ? "text-success" : cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-medium text-text-primary">{n.title}</p>
                      <Badge variant={cfg.variant} className="text-xs">{n.type.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-xs text-text-secondary mb-1.5">{n.message}</p>
                    <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                      <span>{n.userName} ({n.userEmail})</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{n.createdAt ? timeAgo(new Date(n.createdAt)) : ""}</span>
                      {n.emailSent && <span className="flex items-center gap-1 text-success"><Mail className="h-3 w-3" />Email sent</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
