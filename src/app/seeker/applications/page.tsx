"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, Clock, CheckCircle, XCircle, Eye, ArrowUpDown } from "lucide-react";
import { fetchMyApplications } from "@/server/actions";

const STATUS_CONFIG: Record<string, { variant: "default" | "accent" | "warning" | "success" | "danger"; icon: typeof Clock; label: string }> = {
  received: { variant: "default", icon: Clock, label: "Received" },
  reviewing: { variant: "accent", icon: Eye, label: "Under Review" },
  shortlisted: { variant: "warning", icon: ArrowUpDown, label: "Shortlisted" },
  interviewed: { variant: "warning", icon: CheckCircle, label: "Interviewed" },
  selected: { variant: "success", icon: CheckCircle, label: "Selected" },
  rejected: { variant: "danger", icon: XCircle, label: "Not Selected" },
};

export default function SeekerApplicationsPage() {
  const [applications, setApplications] = useState<Awaited<ReturnType<typeof fetchMyApplications>>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchMyApplications()
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all"
    ? applications
    : filter === "active"
      ? applications.filter((a) => !["selected", "rejected"].includes(a.status || ""))
      : applications.filter((a) => a.status === filter);

  const statusCounts = applications.reduce((acc, a) => {
    const s = a.status || "received";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <SeekerTopBar title="My Applications" description={`${applications.length} total application${applications.length !== 1 ? "s" : ""}`} />

      <div className="p-4 sm:p-6 max-w-5xl space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No applications yet"
            description="You haven't applied to any jobs. Start browsing open positions to get started."
            actionLabel="Find Jobs"
            onAction={() => window.location.href = "/seeker/jobs"}
          />
        ) : (
          <>
            {/* Status filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === "all" ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
                }`}
              >
                All ({applications.length})
              </button>
              <button
                onClick={() => setFilter("active")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === "active" ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
                }`}
              >
                Active ({applications.filter((a) => !["selected", "rejected"].includes(a.status || "")).length})
              </button>
              {Object.entries(statusCounts).map(([status, count]) => {
                const config = STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filter === status ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
                    }`}
                  >
                    {config?.label || status} ({count})
                  </button>
                );
              })}
            </div>

            {/* Applications list */}
            <div className="space-y-3">
              {filtered.map((app) => {
                const config = STATUS_CONFIG[app.status || "received"] || STATUS_CONFIG.received;
                const StatusIcon = config.icon;

                return (
                  <Card key={app.id}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-bg-primary flex items-center justify-center shrink-0">
                            <StatusIcon className={`h-5 w-5 ${
                              config.variant === "success" ? "text-success" :
                              config.variant === "danger" ? "text-danger" :
                              config.variant === "warning" ? "text-warning" :
                              config.variant === "accent" ? "text-accent" :
                              "text-text-muted"
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary">{app.jobTitle}</p>
                            <p className="text-xs text-text-secondary">{app.companyName}</p>
                            <p className="text-sm text-text-muted mt-1">
                              Applied {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              }) : ""}
                            </p>
                          </div>
                        </div>
                        <Badge variant={config.variant} className="shrink-0">
                          {config.label}
                        </Badge>
                      </div>

                      {/* Progress indicator */}
                      <div className="mt-4 flex items-center gap-1">
                        {["received", "reviewing", "shortlisted", "interviewed", "selected"].map((step, i) => {
                          const steps = ["received", "reviewing", "shortlisted", "interviewed", "selected"];
                          const currentIdx = steps.indexOf(app.status || "received");
                          const isRejected = app.status === "rejected";
                          const isCompleted = !isRejected && i <= currentIdx;
                          const isCurrent = !isRejected && i === currentIdx;

                          return (
                            <div key={step} className="flex items-center flex-1">
                              <div
                                className={`h-1.5 w-full rounded-full ${
                                  isRejected ? "bg-danger/20" :
                                  isCompleted ? "bg-accent" :
                                  "bg-border-light"
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-text-muted">Received</span>
                        <span className="text-xs text-text-muted">Selected</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
