"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import Link from "next/link";
import {
  Shield, Briefcase, FileText, TrendingUp, ArrowRight,
  CheckCircle, AlertTriangle, XCircle, Eye, Sparkles, Lock,
} from "lucide-react";
import { fetchSupplierDashboard } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DashboardData = Awaited<ReturnType<typeof fetchSupplierDashboard>>;

export default function SupplierDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSupplierDashboard()
      .then(setData)
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  if (!data) return <div className="p-8 text-center text-text-muted">Unable to load dashboard.</div>;

  const { profile, stats, matchingOpportunities, recentResponses } = data;
  const isExpired = profile.lcsExpirationDate && new Date(profile.lcsExpirationDate) < new Date();
  const isExpiring = profile.lcsExpirationDate && !isExpired &&
    new Date(profile.lcsExpirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isPro = profile.tier === "pro";

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <AnnouncementBanner userRole="supplier" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">{profile.legalName || "Supplier Dashboard"}</h1>
          <p className="text-sm text-text-secondary">{profile.tradingName ? `t/a ${profile.tradingName} · ` : ""}{profile.serviceCategories.join(", ") || "No categories set"}</p>
        </div>
        <Badge variant={isPro ? "accent" : "default"} className="text-xs">{isPro ? "Supplier Pro" : "Starter"}</Badge>
      </div>

      {/* Upgrade banner for free users */}
      {!isPro && (
        <Card className="mb-6 border-accent/20 bg-accent-light">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Upgrade to Supplier Pro — $99/mo</p>
                <p className="text-xs text-text-secondary">Unlimited responses, bid tracker, analytics, priority placement</p>
              </div>
            </div>
            <Link href="/supplier-portal/settings"><Button size="sm"><Sparkles className="h-3 w-3 mr-1" /> Upgrade</Button></Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 text-center">
          <Shield className={cn("h-5 w-5 mx-auto mb-1", isExpired ? "text-danger" : isExpiring ? "text-warning" : "text-success")} />
          <p className="text-lg font-bold font-mono">{profile.lcsCertId || "—"}</p>
          <Badge variant={isExpired ? "danger" : profile.lcsVerified ? "success" : "warning"} className="text-xs">
            {isExpired ? "Expired" : profile.lcsVerified ? "LCS Verified" : profile.lcsCertId ? "Pending" : "Not Registered"}
          </Badge>
        </Card>
        <Card className="p-4 text-center">
          <Briefcase className="h-5 w-5 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold">{matchingOpportunities.length}</p>
          <p className="text-xs text-text-muted">Matching Opportunities</p>
        </Card>
        <Card className="p-4 text-center">
          <FileText className="h-5 w-5 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold">{stats.totalResponses}</p>
          <p className="text-xs text-text-muted">Total Responses</p>
        </Card>
        <Card className="p-4 text-center">
          {isPro ? (
            <>
              <Eye className="h-5 w-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-bold">{profile.profileViews}</p>
              <p className="text-xs text-text-muted">Profile Views</p>
            </>
          ) : (
            <>
              <Lock className="h-5 w-5 text-text-muted mx-auto mb-1" />
              <p className="text-lg font-bold text-text-muted">Upgrade</p>
              <p className="text-xs text-text-muted">Profile Analytics</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matching opportunities */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text-primary">Matching Opportunities</p>
              <Link href="/supplier-portal/opportunities" className="text-xs text-accent hover:text-accent-hover">View All</Link>
            </div>
            {matchingOpportunities.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No matching opportunities. Update your service categories in Profile.</p>
            ) : (
              <div className="space-y-2">
                {matchingOpportunities.map(opp => (
                  <div key={opp.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-primary">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-xs font-medium text-text-primary truncate">{opp.title}</p>
                      <p className="text-xs text-text-muted">{opp.company} · {opp.deadline ? `Due ${opp.deadline}` : "No deadline"}</p>
                    </div>
                    {opp.responded ? (
                      <Badge variant="success" className="text-xs shrink-0">Responded</Badge>
                    ) : (
                      <Link href="/supplier-portal/opportunities"><ArrowRight className="h-3.5 w-3.5 text-accent shrink-0" /></Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response pipeline */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text-primary">Response Pipeline</p>
              {isPro && <Link href="/supplier-portal/responses" className="text-xs text-accent hover:text-accent-hover">View All</Link>}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Interested", count: stats.interested, color: "text-accent" },
                { label: "Contacted", count: stats.contacted, color: "text-warning" },
                { label: "Shortlisted", count: stats.shortlisted, color: "text-gold" },
                { label: "Awarded", count: stats.awarded, color: "text-success" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={cn("text-xl font-bold", s.color)}>{s.count}</p>
                  <p className="text-xs text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
            {!isPro && recentResponses.length > 0 && (
              <div className="bg-bg-primary rounded-lg p-3 text-center">
                <Lock className="h-4 w-4 text-text-muted mx-auto mb-1" />
                <p className="text-xs text-text-muted">Upgrade to Pro to track individual responses</p>
              </div>
            )}
            {isPro && recentResponses.length > 0 && (
              <div className="space-y-2">
                {recentResponses.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary truncate mr-2">{r.opportunityTitle}</span>
                    <Badge variant={r.status === "awarded" ? "success" : r.status === "shortlisted" ? "gold" : "default"} className="text-xs shrink-0">{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Free tier response counter */}
      {!isPro && (
        <div className="mt-6 text-center text-xs text-text-muted">
          {profile.responsesThisMonth}/3 responses used this month · <Link href="/supplier-portal/settings" className="text-accent hover:text-accent-hover">Upgrade for unlimited</Link>
        </div>
      )}

      {/* Industry News */}
      <IndustryNewsFeed userType="supplier" />
    </div>
  );
}
