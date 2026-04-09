"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { DashboardIdentity, DashboardStats, StatusCard, DashboardSection } from "@/components/dashboard/shared/DashboardTemplate";
import { PromoCTA } from "@/components/shared/PromoCTA";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { fetchSupplierDashboard } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { decodeHtml } from "@/lib/utils/decode-html";

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
  const isPro = profile.tier === "pro";

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <AnnouncementBanner userRole="supplier" />

      {/* Identity */}
      <DashboardIdentity
        name={profile.legalName || "Your Company"}
        subtitle={[
          profile.tradingName ? `t/a ${profile.tradingName}` : null,
          profile.lcsCertId,
          profile.serviceCategories?.slice(0, 2).join(", "),
        ].filter(Boolean).join(" · ")}
        avatarUrl={profile.logoUrl || undefined}
        status={
          isExpired ? { label: "LCS Expired", variant: "danger" } :
          profile.lcsVerified ? { label: "LCS Verified", variant: "success" } :
          { label: "Pending Verification", variant: "warning" }
        }
        badge={isPro ? "Supplier Pro" : "Starter"}
      />

      {/* Stats */}
      <DashboardStats items={[
        { label: "LCS Certificate", value: profile.lcsCertId || "—", color: isExpired ? "danger" : profile.lcsVerified ? "success" : "warning", sublabel: isExpired ? "Expired" : profile.lcsVerified ? "Verified" : "Not verified" },
        { label: "Matching Opportunities", value: String(matchingOpportunities.length), color: "accent", onClick: () => window.location.href = "/supplier-portal/opportunities" },
        { label: "Total Responses", value: String(stats.totalResponses), color: "gold" },
        { label: isPro ? "Profile Views" : "Plan", value: isPro ? String(profile.profileViews) : "Upgrade", color: isPro ? "accent" : "warning", sublabel: isPro ? "This month" : "For analytics", onClick: !isPro ? () => window.location.href = "/supplier-portal/settings" : undefined },
      ]} />

      {/* LCS Status */}
      <StatusCard
        title="LCS Registration Status"
        status={isExpired ? "Expired" : profile.lcsVerified ? "Active" : "Pending"}
        statusVariant={isExpired ? "danger" : profile.lcsVerified ? "success" : "warning"}
        details={[
          { label: "Certificate ID", value: profile.lcsCertId || "Not registered" },
          { label: "Expiration", value: profile.lcsExpirationDate ? new Date(profile.lcsExpirationDate).toLocaleDateString() : "—" },
          { label: "Service Categories", value: String(profile.serviceCategories?.length || 0) },
          { label: "Employee Count", value: profile.employeeCount ? String(profile.employeeCount) : "—" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Matching opportunities */}
        <DashboardSection title="Matching Opportunities" action={
          <Link href="/supplier-portal/opportunities" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        }>
          {matchingOpportunities.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-text-muted">No matching opportunities. Update your service categories in Profile.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {matchingOpportunities.slice(0, 5).map(opp => (
                <Card key={opp.id} className="hover:border-accent/20 transition-colors">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm font-medium text-text-primary truncate">{decodeHtml(opp.title)}</p>
                      <p className="text-xs text-text-muted">{opp.company} · {opp.deadline ? `Due ${opp.deadline}` : "No deadline"}</p>
                    </div>
                    {opp.responded ? (
                      <Badge variant="success" className="text-xs shrink-0">Responded</Badge>
                    ) : (
                      <Link href="/supplier-portal/opportunities"><ArrowRight className="h-3.5 w-3.5 text-accent shrink-0" /></Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DashboardSection>

        {/* Response pipeline */}
        <DashboardSection title="Response Pipeline">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-4 gap-3 mb-4">
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
              {!isPro && (
                <div className="bg-bg-primary rounded-lg p-3 text-center">
                  <Lock className="h-4 w-4 text-text-muted mx-auto mb-1" />
                  <p className="text-xs text-text-muted">Upgrade to Pro to track individual responses</p>
                </div>
              )}
              {isPro && recentResponses.length > 0 && (
                <div className="space-y-2 mt-2">
                  {recentResponses.slice(0, 4).map(r => (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-border-light last:border-0">
                      <span className="text-text-secondary truncate mr-2">{r.opportunityTitle}</span>
                      <Badge variant={r.status === "awarded" ? "success" : r.status === "shortlisted" ? "gold" : "default"} className="text-xs shrink-0">{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </DashboardSection>
      </div>

      {/* CTA tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {!isPro && (
          <PromoCTA
            variant="accent"
            title="Upgrade to Supplier Pro"
            description="Unlimited responses, profile analytics, priority placement, and direct contact visibility."
            tags={["Unlimited Responses", "Analytics", "Priority Placement"]}
            buttonText="Upgrade Now"
            buttonHref="/supplier-portal/settings"
          />
        )}
        <PromoCTA
          variant="dark"
          title="Complete Your Profile"
          description="Companies with complete profiles get 3x more visibility from contractors."
          buttonText="Edit Profile"
          buttonHref="/supplier-portal/profile"
        />
      </div>

      {/* News */}
      <div className="mt-8">
        <IndustryNewsFeed userType="supplier" />
      </div>
    </div>
  );
}
