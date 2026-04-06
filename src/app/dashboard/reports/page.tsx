"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Users, DollarSign, BarChart3, PieChart, GraduationCap,
  CheckCircle, AlertTriangle, Clock, Briefcase, Building2, Target,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { fetchComplianceAnalytics } from "@/server/actions";
import { cn, formatPercentage } from "@/lib/utils";
import Link from "next/link";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function ReportsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <TopBar title="Reports" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  if (!data) return null;

  const latestLcRate = data.lcRateTrend.length > 0 ? data.lcRateTrend[data.lcRateTrend.length - 1].lcRate : 0;
  const prevLcRate = data.lcRateTrend.length > 1 ? data.lcRateTrend[data.lcRateTrend.length - 2].lcRate : 0;
  const lcTrend = latestLcRate - prevLcRate;

  return (
    <div>
      <TopBar title="Reports" description="Compliance analytics and reporting" />
      <div className="p-4 sm:p-8 max-w-7xl">
        {/* Top Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center">
                  <Target className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{latestLcRate}%</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-text-muted">LC Rate</p>
                    {lcTrend !== 0 && (
                      <span className={cn("flex items-center text-[10px] font-medium", lcTrend > 0 ? "text-success" : "text-danger")}>
                        {lcTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(lcTrend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success-light flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{formatCurrency(data.totalExpenditure)}</p>
                  <p className="text-xs text-text-muted">Total Expenditure</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{data.totalEmployees}</p>
                  <p className="text-xs text-text-muted">Total Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gold-light flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{data.entityCount}</p>
                  <p className="text-xs text-text-muted">Entities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* LC Rate Trend */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Local Content Rate Trend</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.lcRateTrend.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No data yet. Complete your first filing period.</p>
              ) : (
                <div className="space-y-3">
                  {data.lcRateTrend.map((p: { period: string; lcRate: number; totalExpenditure: number; status: string }) => (
                    <div key={p.period}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-text-secondary">{p.period}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold", p.lcRate >= 50 ? "text-success" : "text-warning")}>{p.lcRate}%</span>
                          <Badge variant={p.status === "submitted" ? "success" : "default"} className="text-[9px]">
                            {p.status || "draft"}
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full bg-border-light rounded-full h-2">
                        <div className={cn("rounded-full h-2", p.lcRate >= 50 ? "bg-success" : "bg-warning")}
                          style={{ width: `${Math.min(p.lcRate, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">{formatCurrency(p.totalExpenditure)} total</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employment by Category vs Minimums */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Guyanese Employment vs LCA Minimums</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.empByCategory.every((c: { total: number }) => c.total === 0) ? (
                <p className="text-sm text-text-muted text-center py-8">No employment data yet.</p>
              ) : (
                <div className="space-y-4">
                  {data.empByCategory.map((cat: { category: string; total: number; guyanese: number; pct: number }) => {
                    const min = cat.category === "Managerial" ? data.employmentMinimums.managerial :
                      cat.category === "Technical" ? data.employmentMinimums.technical : data.employmentMinimums.non_technical;
                    const passing = cat.pct >= min;
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-text-secondary">{cat.category}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn("font-bold", passing ? "text-success" : "text-danger")}>{cat.pct}%</span>
                            <span className="text-[10px] text-text-muted">(min {min}%)</span>
                            {passing ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-danger" />}
                          </div>
                        </div>
                        <div className="relative w-full bg-border-light rounded-full h-3">
                          <div className={cn("rounded-full h-3", passing ? "bg-success" : "bg-danger")}
                            style={{ width: `${Math.min(cat.pct, 100)}%` }} />
                          <div className="absolute top-0 h-3 w-0.5 bg-text-muted" style={{ left: `${min}%` }} />
                        </div>
                        <p className="text-[10px] text-text-muted mt-0.5">{cat.guyanese} of {cat.total} employees</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Top Suppliers */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Top Suppliers by Spend</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.topSuppliers.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No expenditure data.</p>
              ) : (
                <div className="space-y-2">
                  {data.topSuppliers.map((s: { name: string; amount: number; guyanese: boolean }, i: number) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary truncate">{s.name}</p>
                      </div>
                      {s.guyanese && <Badge variant="success" className="text-[9px] px-1">LCS</Badge>}
                      <span className="text-text-primary font-medium shrink-0">{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border-light text-xs text-text-muted">
                <span>{data.supplierCount.guyanese} Guyanese suppliers</span>
                <span>{data.supplierCount.international} International</span>
              </div>
            </CardContent>
          </Card>

          {/* Expenditure by Sector */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Expenditure by Sector</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {data.topSectors.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No data.</p>
              ) : (
                <div className="space-y-2">
                  {data.topSectors.map((s: { name: string; amount: number }) => {
                    const pct = data.totalExpenditure > 0 ? (s.amount / data.totalExpenditure) * 100 : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-text-secondary truncate">{s.name}</span>
                          <span className="text-text-primary font-medium shrink-0">{Math.round(pct)}%</span>
                        </div>
                        <div className="w-full bg-border-light rounded-full h-1.5">
                          <div className="bg-accent rounded-full h-1.5" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deadline Compliance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Filing Compliance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-text-secondary">
                    <CheckCircle className="h-3.5 w-3.5 text-success" /> On Time
                  </span>
                  <span className="text-lg font-bold text-success">{data.deadlineCompliance.submittedOnTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-text-secondary">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Late
                  </span>
                  <span className="text-lg font-bold text-warning">{data.deadlineCompliance.submittedLate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-text-secondary">
                    <AlertTriangle className="h-3.5 w-3.5 text-danger" /> Overdue
                  </span>
                  <span className="text-lg font-bold text-danger">{data.deadlineCompliance.overdue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-text-secondary">
                    <Clock className="h-3.5 w-3.5 text-text-muted" /> Upcoming
                  </span>
                  <span className="text-lg font-bold text-text-primary">{data.deadlineCompliance.upcoming}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Capacity Development */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Capacity Development</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-bg-primary rounded-lg">
                  <p className="text-2xl font-bold text-text-primary">{data.capacity.activities}</p>
                  <p className="text-xs text-text-muted">Activities</p>
                </div>
                <div className="text-center p-3 bg-bg-primary rounded-lg">
                  <p className="text-2xl font-bold text-text-primary">{data.capacity.totalParticipants}</p>
                  <p className="text-xs text-text-muted">Participants</p>
                </div>
                <div className="text-center p-3 bg-bg-primary rounded-lg">
                  <p className="text-2xl font-bold text-success">{data.capacity.guyaneseParticipants}</p>
                  <p className="text-xs text-text-muted">Guyanese</p>
                </div>
                <div className="text-center p-3 bg-bg-primary rounded-lg">
                  <p className="text-2xl font-bold text-text-primary">{formatCurrency(data.capacity.totalTrainingSpend)}</p>
                  <p className="text-xs text-text-muted">Investment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hiring Pipeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Hiring Pipeline</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Positions Posted</span>
                  <span className="font-bold text-text-primary">{data.hiringPipeline.totalPosted}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Total Applications</span>
                  <span className="font-bold text-text-primary">{data.hiringPipeline.totalApplications}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Guyanese Applicants</span>
                  <span className="font-bold text-success">{data.hiringPipeline.guyaneseApplications}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Positions Filled</span>
                  <span className="font-bold text-text-primary">{data.hiringPipeline.totalFilled}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Guyanese Hired</span>
                  <span className="font-bold text-success">{data.hiringPipeline.guyaneseHired}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Entity Scorecard */}
        {data.entityScorecard.length > 1 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Entity Compliance Scorecard</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-text-muted font-medium text-xs">Entity</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium text-xs">LC Rate</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium text-xs">Expenditure</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium text-xs">Employees</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium text-xs">GY %</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium text-xs">Filed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entityScorecard.map((e: { entityId: string; entityName: string; lcRate: number; totalExpenditure: number; totalEmployees: number; guyaneseEmployeePct: number; submittedCount: number; periodsCount: number }) => (
                      <tr key={e.entityId} className="border-b border-border-light">
                        <td className="py-2 px-3">
                          <Link href={`/dashboard/entities/${e.entityId}`} className="text-accent hover:text-accent-hover font-medium">
                            {e.entityName}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={cn("font-bold", e.lcRate >= 50 ? "text-success" : "text-warning")}>{e.lcRate}%</span>
                        </td>
                        <td className="py-2 px-3 text-right text-text-primary">{formatCurrency(e.totalExpenditure)}</td>
                        <td className="py-2 px-3 text-right text-text-primary">{e.totalEmployees}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={cn("font-medium", e.guyaneseEmployeePct >= 60 ? "text-success" : "text-danger")}>{e.guyaneseEmployeePct}%</span>
                        </td>
                        <td className="py-2 px-3 text-right text-text-muted">{e.submittedCount}/{e.periodsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank Location Breakdown */}
        {Object.keys(data.bankLocations).length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Payment Flow by Bank Location</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(data.bankLocations as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([loc, amount]) => (
                    <div key={loc} className="bg-bg-primary rounded-lg p-3 text-center min-w-[120px]">
                      <p className="text-sm font-bold text-text-primary">{formatCurrency(amount)}</p>
                      <p className="text-xs text-text-muted">{loc}</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
