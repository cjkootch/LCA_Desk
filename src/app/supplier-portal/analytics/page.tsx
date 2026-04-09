"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarChart3, Eye, FileText, TrendingUp, Lock, Sparkles } from "lucide-react";
import { fetchSupplierAnalytics } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AnalyticsData = Awaited<ReturnType<typeof fetchSupplierAnalytics>>;

export default function SupplierAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [proRequired, setProRequired] = useState(false);

  useEffect(() => {
    fetchSupplierAnalytics()
      .then(setData)
      .catch(err => {
        if (err instanceof Error && err.message.includes("Pro plan")) setProRequired(true);
        else toast.error(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  if (proRequired) return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="h-12 w-12 text-text-muted mb-4" />
        <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Analytics — Pro Feature</h2>
        <p className="text-sm text-text-secondary max-w-md mb-6">
          See how many contractors view your profile, track response success rates, and understand which opportunities you win.
        </p>
        <Link href="/supplier-portal/settings">
          <Button><Sparkles className="h-4 w-4 mr-1" /> Upgrade to Pro — $99/mo</Button>
        </Link>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Analytics</h1>
      <p className="text-sm text-text-secondary mb-6">Track your visibility and response performance</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-4 text-center">
          <Eye className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold">{data.profileViews}</p>
          <p className="text-xs text-text-muted">Profile Views</p>
        </Card>
        <Card className="p-4 text-center">
          <FileText className="h-5 w-5 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold">{data.totalResponses}</p>
          <p className="text-xs text-text-muted">Total Responses</p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">{data.awardRate}%</p>
          <p className="text-xs text-text-muted">Award Rate</p>
        </Card>
        <Card className="p-4 text-center">
          <BarChart3 className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold">{data.byMonth.length}</p>
          <p className="text-xs text-text-muted">Active Months</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline by status */}
        <Card><CardContent className="p-4">
          <p className="text-sm font-semibold text-text-primary mb-3">Response Pipeline</p>
          <div className="space-y-2">
            {Object.entries(data.byStatus).map(([status, count]) => {
              const pct = data.totalResponses > 0 ? Math.round((count / data.totalResponses) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-text-secondary">{status.replace(/_/g, " ")}</span>
                    <span className="font-medium">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>

        {/* Activity by month */}
        <Card><CardContent className="p-4">
          <p className="text-sm font-semibold text-text-primary mb-3">Monthly Activity</p>
          {data.byMonth.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">No activity yet</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {data.byMonth.slice(-12).map(([month, count]) => {
                const maxCount = Math.max(...data.byMonth.map(([, c]) => c), 1);
                const height = Math.max((count / maxCount) * 100, 8);
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-xs font-bold text-accent">{count}</span>
                    <div className="w-full rounded-t bg-accent/60" style={{ height: `${height}%` }} />
                    <span className="text-[7px] text-text-muted">{month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
