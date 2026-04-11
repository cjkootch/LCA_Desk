"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Building2, FileText, Briefcase, Shield, TrendingUp,
  CreditCard, Clock, AlertTriangle, BarChart3, MessageSquare,
  Database, Globe, Activity, LogIn, LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkSuperAdmin, fetchAdminStats } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [hideDemo, setHideDemo] = useState(false);
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const router = useRouter();

  useEffect(() => {
    checkSuperAdmin().then((isAdmin) => {
      if (!isAdmin) { router.replace("/dashboard"); return; }
      setAuthorized(true);
      fetchAdminStats().then(setData).catch(() => {}).finally(() => setLoading(false));
    }).catch(() => router.replace("/dashboard"));
  }, [router]);

  if (loading || !authorized) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const impersonate = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await res.json();
      if (result.success) {
        window.location.href = result.redirectTo;
      } else {
        toast.error(result.error || "Failed to impersonate");
      }
    } catch { toast.error("Failed to impersonate"); }
  };

  if (!data) return null;

  const signupDays = Object.entries(data.signupsByDay as Record<string, number>).sort(([a], [b]) => a.localeCompare(b));
  const maxSignups = Math.max(...signupDays.map(([, v]) => v), 1);

  return (
    <div>
      <TopBar title="Admin Dashboard" description="Platform overview and management" />
      <div className="p-4 sm:p-6 max-w-7xl">

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => setHideDemo(!hideDemo)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              hideDemo ? "bg-gold text-white" : "bg-bg-primary text-text-muted hover:text-text-primary"
            )}
          >
            {hideDemo ? "Real Only" : "All (incl. Demo)"}
          </button>
          <div className="h-4 w-px bg-border" />
          {["all", ...Array.from(new Set(data.tenants.list.map((t: { jurisdictionCode: string | null }) => t.jurisdictionCode).filter(Boolean) as string[]))].map((j) => (
            <button key={j}
              onClick={() => setJurisdictionFilter(j)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                jurisdictionFilter === j ? "bg-accent text-white" : "bg-bg-primary text-text-muted hover:text-text-primary"
              )}
            >
              {j === "all" ? "All Jurisdictions" : j}
            </button>
          ))}
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total Users", value: data.users.total, icon: Users, color: "text-accent" },
            { label: "Signups (7d)", value: data.users.recent7d, icon: TrendingUp, color: "text-success" },
            { label: "Paying", value: data.tenants.paying, icon: CreditCard, color: "text-gold" },
            { label: "Trialing", value: data.tenants.trialing, icon: Clock, color: "text-blue-600" },
            { label: "Open Tickets", value: data.support.openTickets, icon: MessageSquare, color: "text-warning", href: "/dashboard/admin/tickets" },
          { label: "Product Analytics", value: "View →", icon: LineChart, color: "text-purple-500", href: "/dashboard/admin/analytics" },
          { label: "PLG Dashboard", value: "View →", icon: TrendingUp, color: "text-green-500", href: "/dashboard/admin/plg" },
          ].map(s => {
            const Inner = (
              <Card key={s.label} className={s.href ? "hover:border-accent/30 transition-colors cursor-pointer" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-bg-primary flex items-center justify-center">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-text-primary">{s.value}</p>
                      <p className="text-xs text-text-muted">{s.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            return s.href ? <Link key={s.label} href={s.href}>{Inner}</Link> : <div key={s.label}>{Inner}</div>;
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* User breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Users by Role</CardTitle></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Filers", count: data.users.filers, color: "bg-accent" },
                { label: "Job Seekers", count: data.users.seekers, color: "bg-blue-500" },
                { label: "Suppliers", count: data.users.suppliers, color: "bg-success" },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary">{r.label}</span>
                    <span className="font-bold text-text-primary">{r.count}</span>
                  </div>
                  <div className="w-full bg-border-light rounded-full h-2">
                    <div className={`${r.color} rounded-full h-2`}
                      style={{ width: `${data.users.total > 0 ? (r.count / data.users.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tenant plans */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Tenants by Status</CardTitle></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Tenants</span>
                <span className="font-bold">{data.tenants.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-gold" /> Paying</span>
                <span className="font-bold text-gold">{data.tenants.paying}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-blue-600" /> Active Trial</span>
                <span className="font-bold text-blue-600">{data.tenants.trialing}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-danger" /> Expired Trial</span>
                <span className="font-bold text-danger">{data.tenants.expired}</span>
              </div>
            </CardContent>
          </Card>

          {/* Content stats */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Platform Data</CardTitle></div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Entities</span><span className="font-medium">{data.content.entities}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Filing Periods</span><span className="font-medium">{data.content.periods}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Reports Submitted</span><span className="font-medium text-success">{data.content.submitted}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Job Postings</span><span className="font-medium">{data.content.jobs}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Applications</span><span className="font-medium">{data.content.applications}</span></div>
              <div className="border-t border-border-light pt-2 mt-2">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Scraped Data</p>
                <div className="flex justify-between"><span className="text-text-muted">LCS Register</span><span className="font-medium">{data.scraped.register}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Opportunities</span><span className="font-medium">{data.scraped.opportunities}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">LCS Jobs</span><span className="font-medium">{data.scraped.lcsJobs}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Company Profiles</span><span className="font-medium">{data.scraped.companyProfiles}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Signup trend */}
        {signupDays.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Signups (Last 30 Days)</CardTitle></div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1" style={{ height: "120px" }}>
                {signupDays.map(([day, count]) => (
                  <div key={day} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                    <span className="text-xs text-text-muted">{count}</span>
                    <div className="w-full bg-accent rounded-t min-h-[2px]"
                      style={{ height: `${(count / maxSignups) * 100}px` }} />
                    <span className="text-[11px] text-text-muted">{day.slice(8)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Recent signups */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Latest Signups</CardTitle></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.users.latest
                  .filter((u: { isDemo: boolean | null }) => hideDemo ? !u.isDemo : true)
                  .map((u: { id: string; name: string | null; email: string; userRole: string | null; createdAt: Date | null; isDemo: boolean | null }) => (
                  <div key={u.id} className={cn("flex items-center justify-between text-xs py-1", u.isDemo && "opacity-60")}>
                    <div className="min-w-0">
                      <p className="text-text-primary font-medium truncate">
                        {u.name || u.email}
                        {u.isDemo && <span className="ml-1.5 text-[10px] text-warning font-normal">demo</span>}
                      </p>
                      <p className="text-text-muted">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={u.userRole?.includes("filer") ? "accent" : u.userRole?.includes("job_seeker") ? "default" : u.userRole?.includes("supplier") ? "success" : u.userRole?.includes("secretariat") ? "gold" : "default"} className="text-xs">
                        {u.userRole?.includes("secretariat") ? "Secretariat" : u.userRole?.includes("filer") ? "Filer" : u.userRole?.includes("job_seeker") ? "Seeker" : u.userRole?.includes("supplier") ? "Supplier" : u.userRole || "Unknown"}
                      </Badge>
                      <button onClick={() => impersonate(u.id)} className="flex items-center gap-1 text-accent hover:text-accent-hover font-medium" title="Sign in as this user">
                        <LogIn className="h-3 w-3" /> View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Recent Activity (All Users)</CardTitle></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recentAudit.map((a: { id: string; userName: string | null; action: string; entityType: string; createdAt: Date | null }) => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-text-primary">
                        <span className="font-medium">{a.userName || "System"}</span>
                        {" "}
                        <Badge variant={a.action === "submit" ? "success" : a.action === "delete" ? "danger" : "default"} className="text-xs">{a.action}</Badge>
                        {" "}
                        <span className="text-text-muted">{a.entityType.replace(/_/g, " ")}</span>
                      </p>
                    </div>
                    <span className="text-text-muted text-xs shrink-0">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /><CardTitle className="text-sm">Tenants</CardTitle></div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Company</th>
                    <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Jurisdiction</th>
                    <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Plan</th>
                    <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-xs text-text-muted font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.list
                    .filter((t: { isDemo: boolean | null; jurisdictionCode: string | null }) => {
                      if (hideDemo && t.isDemo) return false;
                      if (jurisdictionFilter !== "all" && t.jurisdictionCode !== jurisdictionFilter) return false;
                      return true;
                    })
                    .map((t: { id: string; name: string; slug: string | null; plan: string | null; trialEndsAt: Date | null; stripeSubscriptionId: string | null; createdAt: Date | null; isDemo: boolean | null; jurisdictionCode: string | null }) => {
                    const trialActive = t.trialEndsAt && new Date(t.trialEndsAt) > new Date();
                    const trialExpired = t.trialEndsAt && new Date(t.trialEndsAt) <= new Date();
                    return (
                      <tr key={t.id} className={cn("border-b border-border-light", t.isDemo && "opacity-60")}>
                        <td className="py-2 px-3 font-medium text-text-primary">
                          {t.name}
                          {t.isDemo && <span className="ml-1.5 text-[10px] text-warning font-normal">demo</span>}
                        </td>
                        <td className="py-2 px-3">
                          {t.jurisdictionCode
                            ? <Badge variant="default" className="text-xs">{t.jurisdictionCode}</Badge>
                            : <span className="text-text-muted text-xs">—</span>
                          }
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={t.plan === "pro" ? "accent" : t.plan === "enterprise" ? "gold" : "default"} className="text-xs">
                            {t.plan || "lite"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          {t.stripeSubscriptionId
                            ? <Badge variant="success" className="text-xs">Paying</Badge>
                            : trialActive ? <Badge variant="accent" className="text-xs">Trial</Badge>
                            : trialExpired ? <Badge variant="danger" className="text-xs">Expired</Badge>
                            : <span className="text-text-muted text-xs">Free</span>
                          }
                        </td>
                        <td className="py-2 px-3 text-text-muted text-xs">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
