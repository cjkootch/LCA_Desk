"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell, Clock, AlertTriangle, CheckCircle, FileText, Mail,
  Briefcase, GraduationCap, Shield, UserPlus,
} from "lucide-react";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from "@/server/actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

const TYPE_ICON: Record<string, React.ElementType> = {
  deadline_warning: Clock,
  deadline_overdue: AlertTriangle,
  cert_expiring: Shield,
  report_submitted: FileText,
  team_invite: UserPlus,
  plan_limit: AlertTriangle,
  application_received: Briefcase,
  application_status: Briefcase,
  welcome: CheckCircle,
};

const TYPE_COLOR: Record<string, string> = {
  deadline_warning: "text-warning",
  deadline_overdue: "text-danger",
  cert_expiring: "text-warning",
  report_submitted: "text-success",
  welcome: "text-accent",
  application_received: "text-accent",
  application_status: "text-accent",
};

export function NotificationsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetchNotifications(100).then(setItems).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const unread = items.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    load();
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Notifications</h1>
            <p className="text-sm text-text-secondary">{unread > 0 ? `${unread} unread` : "All caught up"}</p>
          </div>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>Mark all read</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Bell className="h-10 w-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No notifications yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const Icon = TYPE_ICON[n.type] || Bell;
            const color = TYPE_COLOR[n.type] || "text-text-muted";
            return (
              <Card key={n.id} className={cn(!n.read && "border-accent/20 bg-accent/[0.02]")}
                onClick={() => !n.read && handleMarkRead(n.id)}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg shrink-0", !n.read ? "bg-accent/10" : "bg-bg-primary")}>
                    <Icon className={cn("h-4 w-4", !n.read ? color : "text-text-muted")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn("text-sm font-medium", !n.read ? "text-text-primary" : "text-text-secondary")}>{n.title}</p>
                      {!n.read && <div className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                    </div>
                    <p className="text-xs text-text-muted">{n.message}</p>
                    <p className="text-xs text-text-muted mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</p>
                    {n.link && (
                      <Link href={n.link} className="text-xs text-accent hover:underline mt-1 inline-block">View details</Link>
                    )}
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
