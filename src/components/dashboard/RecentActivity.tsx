"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, FileText, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { fetchRecentActivity } from "@/server/actions";
import { cn } from "@/lib/utils";

type ActivityItem = Awaited<ReturnType<typeof fetchRecentActivity>>[number];

const STATUS_ICON: Record<string, { icon: typeof FileText; color: string }> = {
  not_started: { icon: Clock, color: "text-text-muted" },
  in_progress: { icon: FileText, color: "text-accent" },
  review: { icon: AlertTriangle, color: "text-warning" },
  submitted: { icon: CheckCircle, color: "text-success" },
  acknowledged: { icon: CheckCircle, color: "text-success" },
};

function formatTimeAgo(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity()
      .then(setActivities)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((item) => {
              const config = STATUS_ICON[item.status || "not_started"] || STATUS_ICON.not_started;
              const Icon = config.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 text-sm">
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary truncate">
                      <span className="font-medium">{item.entityName}</span>
                      {" — "}
                      {item.reportType?.replace(/_/g, " ").toUpperCase()}
                    </p>
                    <p className="text-text-muted text-xs">
                      {item.status?.replace(/_/g, " ")} {formatTimeAgo(item.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
