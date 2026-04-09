"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Clock, Users, DollarSign, Calendar, Megaphone, ArrowRight,
} from "lucide-react";
import { fetchComplianceHealth } from "@/server/actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function ComplianceHealthWidget() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceHealth().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const scoreColor = data.complianceScore >= 75 ? "text-success" : data.complianceScore >= 50 ? "text-warning" : "text-danger";
  const scoreLabel = data.complianceScore >= 75 ? "Strong" : data.complianceScore >= 50 ? "Needs Attention" : "At Risk";
  const lcTrend = data.lcRateTrend.length >= 2
    ? data.lcRateTrend[data.lcRateTrend.length - 1].rate - data.lcRateTrend[data.lcRateTrend.length - 2].rate
    : 0;

  return (
    <div className="space-y-4">
      {/* Compliance Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">Compliance Health</h3>
            </div>
            <Badge variant={data.complianceScore >= 75 ? "success" : data.complianceScore >= 50 ? "warning" : "danger"}>
              {scoreLabel}
            </Badge>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className={cn("text-3xl font-bold", scoreColor)}>{data.complianceScore}</span>
            <span className="text-sm text-text-muted mb-1">/ 100</span>
          </div>
          <Progress value={data.complianceScore} className="h-2" />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="text-center p-2 bg-bg-primary rounded-lg">
              <p className={cn("text-lg font-bold", data.lcRate >= 50 ? "text-success" : "text-warning")}>{data.lcRate}%</p>
              <p className="text-xs text-text-muted">LC Rate</p>
              {lcTrend !== 0 && (
                <span className={cn("flex items-center justify-center gap-0.5 text-xs", lcTrend > 0 ? "text-success" : "text-danger")}>
                  {lcTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(lcTrend).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-center p-2 bg-bg-primary rounded-lg">
              <p className="text-lg font-bold text-text-primary">{data.totalEmployees}</p>
              <p className="text-xs text-text-muted">Employees</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment vs Minimums */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            <CardTitle className="text-xs">Employment Compliance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Managerial", ...data.employment.managerial, min: data.employment.minimums.managerial },
            { label: "Technical", ...data.employment.technical, min: data.employment.minimums.technical },
            { label: "Non-Technical", ...data.employment.nonTechnical, min: data.employment.minimums.non_technical },
          ].map(cat => (
            <div key={cat.label} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary w-24">{cat.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={cn("font-bold", cat.pct >= cat.min ? "text-success" : "text-danger")}>{cat.pct}%</span>
                <span className="text-text-muted">/ {cat.min}%</span>
                {cat.pct >= cat.min ? <CheckCircle className="h-3 w-3 text-success" /> : <AlertTriangle className="h-3 w-3 text-danger" />}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alerts */}
      {(data.overduePeriods.length > 0 || data.expiringCerts.length > 0) && (
        <Card className="border-danger/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <CardTitle className="text-xs text-danger">Action Required</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.overduePeriods.map((p: { periodId: string; entityName: string; reportType: string; daysOverdue: number }) => (
              <div key={p.periodId} className="flex items-center justify-between text-xs">
                <span className="text-text-primary">{p.entityName} — {p.reportType.replace(/_/g, " ")}</span>
                <Badge variant="danger" className="text-xs">{p.daysOverdue}d overdue</Badge>
              </div>
            ))}
            {data.expiringCerts.map((c: { certId: string; supplierName: string; daysLeft: number }) => (
              <div key={c.certId} className="flex items-center justify-between text-xs">
                <span className="text-text-primary truncate">{c.supplierName}</span>
                <Badge variant={c.daysLeft <= 30 ? "danger" : "warning"} className="text-xs">
                  Cert {c.daysLeft <= 0 ? "expired" : `expires ${c.daysLeft}d`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Deadlines */}
      {data.upcomingDeadlines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              <CardTitle className="text-xs">Upcoming Deadlines</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingDeadlines.map((d: { periodId: string; entityId: string; entityName: string; reportType: string; daysLeft: number; dueDate: string }) => (
              <Link key={d.periodId} href={`/dashboard/entities/${d.entityId}/periods/${d.periodId}`}>
                <div className="flex items-center justify-between text-xs hover:bg-bg-primary rounded p-1 -mx-1 transition-colors cursor-pointer">
                  <div>
                    <p className="text-text-primary font-medium">{d.entityName}</p>
                    <p className="text-text-muted">{d.reportType.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold", d.daysLeft <= 14 ? "text-danger" : d.daysLeft <= 30 ? "text-warning" : "text-text-primary")}>{d.daysLeft}d</p>
                    <p className="text-xs text-text-muted">{new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Matching Opportunities */}
      {data.matchingOpportunities > 0 && (
        <Link href="/dashboard/opportunities">
          <Card className="hover:border-accent/30 transition-colors cursor-pointer">
            <CardContent className="p-3 flex items-center gap-3">
              <Megaphone className="h-4 w-4 text-accent shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-text-primary">{data.matchingOpportunities} opportunities match your categories</p>
                <p className="text-xs text-text-muted">Based on your procurement history</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
