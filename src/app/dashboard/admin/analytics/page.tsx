"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, Users, Calendar, ArrowRight, BarChart3, Activity,
  Percent, Clock,
} from "lucide-react";
import { fetchAnalyticsFunnel, checkSuperAdmin } from "@/server/actions";
import { cn } from "@/lib/utils";

const FUNNEL_LABELS: Record<string, { label: string; color: string }> = {
  trial_started: { label: "Trial Started", color: "bg-blue-500" },
  entity_created: { label: "Entity Created", color: "bg-accent" },
  first_expenditure_added: { label: "First Expenditure", color: "bg-emerald-500" },
  narrative_generated: { label: "Narrative Generated", color: "bg-purple-500" },
  report_submitted: { label: "Report Submitted", color: "bg-success" },
  plan_upgraded: { label: "Plan Upgraded", color: "bg-gold" },
};

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

type FunnelData = Awaited<ReturnType<typeof fetchAnalyticsFunnel>>;

export default function AnalyticsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FunnelData | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    checkSuperAdmin().then((isAdmin) => {
      if (!isAdmin) { router.replace("/dashboard"); return; }
      setAuthorized(true);
    }).catch(() => router.replace("/dashboard"));
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    fetchAnalyticsFunnel(days)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authorized, days]);

  if (!authorized) return null;

  const maxFunnelCount = data ? Math.max(...data.funnel.map((f) => f.count), 1) : 1;

  return (
    <div>
      <TopBar title="Product Analytics" description="Conversion funnel and growth metrics" />
      <div className="p-4 sm:p-6 max-w-6xl">

        {/* Period selector */}
        <div className="flex items-center gap-2 mb-6">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                days === opt.value
                  ? "bg-accent text-white"
                  : "bg-bg-primary text-text-muted hover:text-text-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
          {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent ml-2" />}
        </div>

        {/* Top metrics */}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: "New Signups",
                value: data.totalSignups,
                icon: Users,
                color: "text-accent",
                sublabel: `Last ${data.days} days`,
              },
              {
                label: "Trial → Paid",
                value: `${data.conversionRate}%`,
                icon: Percent,
                color: "text-gold",
                sublabel: "Conversion rate",
              },
              {
                label: "Active Users",
                value: data.activeUsers,
                icon: Activity,
                color: "text-success",
                sublabel: "Events in last 7d",
              },
              {
                label: "Avg Days to Report",
                value: data.avgDaysToFirstReport !== null ? `${data.avgDaysToFirstReport}d` : "—",
                icon: Clock,
                color: "text-purple-500",
                sublabel: "Signup → first submit",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-bg-primary flex items-center justify-center shrink-0">
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                      <p className="text-xs text-text-muted">{stat.label}</p>
                      <p className="text-[11px] text-text-muted">{stat.sublabel}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Conversion Funnel */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Activation Funnel — Last {days} Days</CardTitle>
            </div>
            <p className="text-xs text-text-muted">Unique users who triggered each event at least once</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
              </div>
            ) : data ? (
              <div className="space-y-3">
                {data.funnel.map((step, i) => {
                  const config = FUNNEL_LABELS[step.eventName] ?? { label: step.eventName, color: "bg-gray-500" };
                  const widthPct = maxFunnelCount > 0 ? (step.count / maxFunnelCount) * 100 : 0;
                  return (
                    <div key={step.eventName}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted w-4">{i + 1}</span>
                          <span className="text-sm font-medium text-text-primary">{config.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-text-primary">{step.count.toLocaleString()}</span>
                          {i > 0 && (
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              step.conversionFromPrev >= 50
                                ? "bg-success/10 text-success"
                                : step.conversionFromPrev >= 25
                                ? "bg-warning/10 text-warning"
                                : "bg-danger/10 text-danger"
                            )}>
                              {step.conversionFromPrev}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-border-light rounded-full h-6 overflow-hidden">
                        <div
                          className={cn("h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2", config.color)}
                          style={{ width: `${Math.max(widthPct, 2)}%` }}
                        >
                          {widthPct > 15 && (
                            <span className="text-[10px] text-white font-medium">{step.count}</span>
                          )}
                        </div>
                      </div>
                      {i < data.funnel.length - 1 && (
                        <div className="flex justify-start pl-4 mt-1">
                          <ArrowRight className="h-3 w-3 text-border" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted text-center py-8">No data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Step-by-step conversion table */}
        {data && data.funnel.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Funnel Step Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Step</th>
                    <th className="text-right py-2 px-3 text-xs text-text-muted font-medium">Users</th>
                    <th className="text-right py-2 px-3 text-xs text-text-muted font-medium">From Prev Step</th>
                    <th className="text-right py-2 px-3 text-xs text-text-muted font-medium">From Top</th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnel.map((step, i) => {
                    const config = FUNNEL_LABELS[step.eventName] ?? { label: step.eventName, color: "bg-gray-500" };
                    const topCount = data.funnel[0].count;
                    const fromTop = topCount > 0 ? Math.round((step.count / topCount) * 100) : 0;
                    return (
                      <tr key={step.eventName} className="border-b border-border-light hover:bg-bg-primary/50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted text-xs">{i + 1}.</span>
                            <span className={cn("h-2 w-2 rounded-full shrink-0", config.color)} />
                            <span className="font-medium text-text-primary">{config.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-text-primary">{step.count.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          {i === 0 ? (
                            <span className="text-text-muted text-xs">—</span>
                          ) : (
                            <span className={cn(
                              "font-medium",
                              step.conversionFromPrev >= 50 ? "text-success" :
                              step.conversionFromPrev >= 25 ? "text-warning" : "text-danger"
                            )}>
                              {step.conversionFromPrev}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={cn(
                            "font-medium",
                            fromTop >= 50 ? "text-success" : fromTop >= 20 ? "text-warning" : "text-danger"
                          )}>
                            {fromTop}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Back to admin */}
        <div className="mt-4">
          <a href="/dashboard/admin" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
            ← Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
