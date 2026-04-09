"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, Building2, FileText, Clock,
  ArrowLeft, Sparkles, PieChart,
} from "lucide-react";
import { fetchOpportunityAnalytics } from "@/server/actions";
import Link from "next/link";
import { CompanyLogo } from "@/components/shared/CompanyLogo";

export default function OpportunityAnalyticsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpportunityAnalytics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <TopBar title="Market Intelligence" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  if (!data) return null;

  const sortedMonths = Object.entries(data.monthlyTrend as Record<string, number>)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
  const maxMonthly = Math.max(...sortedMonths.map(([, v]) => v), 1);

  return (
    <div>
      <TopBar title="Market Intelligence" />
      <div className="p-4 sm:p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard/opportunities" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mb-2">
              <ArrowLeft className="h-4 w-4" /> Back to Opportunities
            </Link>
            <h1 className="text-xl font-heading font-bold text-text-primary">Market Intelligence</h1>
            <p className="text-sm text-text-secondary">Analytics from {data.totalNotices} procurement notices</p>
          </div>
          <Badge variant="accent" className="gap-1">
            <Sparkles className="h-3 w-3" /> AI-Powered
          </Badge>
        </div>

        {/* Top-level stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Notices", value: data.totalNotices, icon: FileText, color: "text-accent" },
            { label: "Active", value: data.active, icon: TrendingUp, color: "text-success" },
            { label: "AI Analyzed", value: data.withAiSummary, icon: Sparkles, color: "text-accent" },
            { label: "Avg Response Window", value: data.avgDeadlineDays ? `${data.avgDeadlineDays}d` : "N/A", icon: Clock, color: "text-warning" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-bg-primary flex items-center justify-center">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                    <p className="text-xs text-text-muted">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Top Contractors */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Top Contractors by Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topContractors.map((c: { name: string; count: number }, i: number) => (
                  <Link key={c.name} href={`/dashboard/opportunities/contractor/${encodeURIComponent(c.name)}`}>
                    <div className="flex items-center gap-3 py-1.5 hover:bg-bg-primary rounded px-2 -mx-2 transition-colors cursor-pointer">
                      <span className="text-xs text-text-muted w-5 text-right">{i + 1}</span>
                      <CompanyLogo companyName={c.name} size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{c.name}</p>
                        <div className="w-full bg-border-light rounded-full h-1.5 mt-1">
                          <div
                            className="bg-accent rounded-full h-1.5 transition-all"
                            style={{ width: `${(c.count / data.topContractors[0].count) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-text-primary">{c.count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notice Type Distribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Notice Types</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.typeCounts as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const pct = Math.round((count / data.totalNotices) * 100);
                    const colors: Record<string, string> = { EOI: "bg-accent", RFQ: "bg-gold", RFP: "bg-warning", RFI: "bg-blue-500" };
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-text-primary font-medium">{type}</span>
                          <span className="text-text-muted">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-border-light rounded-full h-2">
                          <div className={`${colors[type] || "bg-text-muted"} rounded-full h-2`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trend */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Monthly Activity (Last 12 Months)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1" style={{ height: "160px" }}>
              {sortedMonths.map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-xs text-text-muted font-medium">{count}</span>
                  <div
                    className="w-full bg-accent rounded-t min-h-[4px]"
                    style={{ height: `${(count / maxMonthly) * 130}px` }}
                  />
                  <span className="text-xs text-text-muted">{month.slice(5)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Top Procurement Categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.topCategories.map((c: { name: string; count: number }) => (
                <Badge key={c.name} variant="default" className="text-xs py-1 px-3">
                  {c.name} <span className="ml-1 text-text-muted">({c.count})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
