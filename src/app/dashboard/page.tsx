"use client";

import { useEffect, useState } from "react";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { ComplianceCalendar } from "@/components/dashboard/ComplianceCalendar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import { ComplianceHealthWidget } from "@/components/dashboard/ComplianceHealthWidget";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { DashboardIdentity, DashboardStats, StatusCard, DashboardSection } from "@/components/dashboard/shared/DashboardTemplate";
import { PromoCTA } from "@/components/shared/PromoCTA";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

import { Building2, Plus, GraduationCap, ArrowRight, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { calculateDeadlines, enrichDeadline } from "@/lib/compliance/deadlines";
import { fetchEntities, fetchComplianceHealth, fetchUserContext, fetchPlanAndUsage } from "@/server/actions";
import { mapDrizzleEntity } from "@/lib/mappers";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";
import type { Entity } from "@/types/database.types";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function DashboardPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [health, setHealth] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ctx, setCtx] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEntities();
        setEntities(data.map(mapDrizzleEntity));
      } catch {}
      setLoading(false);
      fetchComplianceHealth().then(setHealth).catch(() => {});
      fetchUserContext().then(setCtx).catch(() => {});
      fetchPlanAndUsage().then(p => setIsPro(p.effectivePlan === "pro" || p.effectivePlan === "enterprise")).catch(() => {});
    };
    load();
  }, []);

  const currentYear = new Date().getFullYear();
  const deadlines: DeadlineWithStatus[] = entities.flatMap((entity) => {
    const jCode = (entity as unknown as Record<string, string>).country || "GY";
    const rawDeadlines = calculateDeadlines(jCode, currentYear);
    return rawDeadlines.map((d) => enrichDeadline(d, false, entity.id, entity.legal_name));
  });

  const upcomingDeadlines = deadlines
    .filter((d) => d.status !== "completed" && d.days_remaining > -30)
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
    .slice(0, 10);

  const overdueCount = deadlines.filter((d) => d.status === "overdue").length;
  const dueSoonCount = deadlines.filter((d) => d.status === "due_soon").length;

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const lcRate = health?.lcRate || 0;
  const billingState = ctx?.billing?.state;

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <AnnouncementBanner userRole="filer" />

      {/* Identity header */}
      <DashboardIdentity
        name={ctx?.tenant?.name || "Your Company"}
        subtitle={[
          entities.length > 0 ? `${entities.length} entit${entities.length === 1 ? "y" : "ies"}` : null,
          ctx?.tenant?.jurisdiction?.name || "Guyana",
          entities[0]?.lcs_certificate_id || null,
        ].filter(Boolean).join(" · ")}
        status={
          billingState === "active" ? { label: "Active", variant: "success" } :
          billingState === "trial" ? { label: "Trial", variant: "accent" } :
          billingState === "locked" ? { label: "Expired", variant: "danger" } :
          { label: "Active", variant: "success" }
        }
        badge={ctx?.plan ? ctx.plan.charAt(0).toUpperCase() + ctx.plan.slice(1) : undefined}
      />

      {entities.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No entities yet"
          description="Add your first company or entity to start tracking local content compliance."
          actionLabel="Add Entity"
          onAction={() => router.push("/dashboard/entities/new")}
          secondaryLabel="Take the Onboarding Course"
          secondaryOnAction={() => router.push("/dashboard/training")}
        />
      ) : (
        <>
          {/* KPI stats row */}
          <DashboardStats items={[
            { label: "LC Rate", value: `${lcRate.toFixed(1)}%`, color: lcRate >= 50 ? "success" : "warning", sublabel: lcRate >= 50 ? "Meeting target" : "Below 50% target" },
            { label: "Entities", value: String(entities.length), color: "accent", sublabel: `${entities.length} active` },
            { label: "Due Soon", value: String(dueSoonCount), color: dueSoonCount > 0 ? "warning" : "success", sublabel: dueSoonCount > 0 ? "Action needed" : "All clear", onClick: () => router.push("/dashboard/calendar") },
            { label: "Overdue", value: String(overdueCount), color: overdueCount > 0 ? "danger" : "success", sublabel: overdueCount > 0 ? "Immediate attention" : "None", onClick: () => router.push("/dashboard/calendar") },
          ]} />

          {/* Compliance status card */}
          <StatusCard
            title="LCS Compliance Status"
            status={lcRate >= 50 ? "Compliant" : overdueCount > 0 ? "Action Required" : "Below Target"}
            statusVariant={lcRate >= 50 && overdueCount === 0 ? "success" : overdueCount > 0 ? "danger" : "warning"}
            details={[
              { label: "Local Content Rate", value: `${lcRate.toFixed(1)}%`, benchmark: "50% min", met: lcRate >= 50 },
              { label: "Overdue Reports", value: String(overdueCount), met: overdueCount === 0 },
              { label: "Next Deadline", value: upcomingDeadlines[0] ? `${upcomingDeadlines[0].days_remaining}d` : "None" },
            ]}
            footer={health ? `Based on ${formatCurrency(health.totalExpenditure || 0)} total expenditure across ${entities.length} entit${entities.length === 1 ? "y" : "ies"}` : undefined}
          />

          {/* Start Filing CTA */}
          {upcomingDeadlines.length > 0 && entities.length > 0 && (
            <div className="mb-3">
              <Link href={`/dashboard/entities/${upcomingDeadlines[0].entity_id}`}>
                <Card className="border-accent/20 hover:border-accent/40 hover:shadow-md transition-all cursor-pointer bg-accent-light/30">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Start Next Report</p>
                        <p className="text-xs text-text-muted">
                          {upcomingDeadlines[0].label} — {upcomingDeadlines[0].entity_name}
                          {upcomingDeadlines[0].days_remaining > 0
                            ? ` · Due in ${upcomingDeadlines[0].days_remaining} days`
                            : ` · ${Math.abs(upcomingDeadlines[0].days_remaining)} days overdue`
                          }
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="gap-1.5 shrink-0">
                      Begin Filing <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-3">
              <DashboardSection title="Your Entities" action={
                <Link href="/dashboard/entities/new">
                  <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Entity</Button>
                </Link>
              }>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {entities.map((entity) => (
                    <PortfolioCard key={entity.id} entity={entity} />
                  ))}
                </div>
              </DashboardSection>

              {/* Upcoming deadlines */}
              {upcomingDeadlines.length > 0 && (
                <DashboardSection title="Upcoming Deadlines" action={
                  <Link href="/dashboard/calendar" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
                    View Calendar <ArrowRight className="h-3 w-3" />
                  </Link>
                }>
                  <div className="space-y-2">
                    {upcomingDeadlines.slice(0, 5).map((d, i) => (
                      <Link key={i} href={d.entity_id ? `/dashboard/entities/${d.entity_id}` : "/dashboard/entities"}>
                        <Card className={cn("border-0 shadow-sm hover:shadow-md transition-all cursor-pointer", d.status === "overdue" ? "bg-danger/5" : d.status === "due_soon" ? "bg-warning/5" : "")}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("h-2 w-2 rounded-full shrink-0",
                                d.status === "overdue" ? "bg-danger" : d.status === "due_soon" ? "bg-warning" : "bg-accent"
                              )} />
                              <div>
                                <p className="text-sm font-medium text-text-primary">{d.label}</p>
                                <p className="text-xs text-text-muted">{d.entity_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={cn("text-xs font-medium",
                                  d.status === "overdue" ? "text-danger" : d.status === "due_soon" ? "text-warning" : "text-text-secondary"
                                )}>
                                  {d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}d overdue` : d.days_remaining === 0 ? "Due today" : `${d.days_remaining}d left`}
                                </p>
                                <p className="text-xs text-text-muted">{d.due_date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                              </div>
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 shrink-0">File</Button>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </DashboardSection>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-3">
              <ComplianceHealthWidget />
              <ComplianceCalendar deadlines={upcomingDeadlines} />
              <RecentActivity />
            </div>
          </div>

          {/* CTA tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {!isPro && (
              <PromoCTA
                variant="accent"
                title="Unlock AI Compliance Tools"
                description="AI Narrative Drafting, Compliance Gap Detection, and unlimited expert chat."
                tags={["AI Drafts", "Compliance Scan", "Expert Chat"]}
                buttonText="Upgrade to Professional"
                buttonHref="/dashboard/settings/billing"
              />
            )}
            <PromoCTA
              variant="gold"
              title="Refer & Earn 14 Extra Days"
              description="Share LCA Desk with colleagues. When they sign up and file, you both earn bonus trial days."
              tags={["Share Link", "They Sign Up", "+14 Days Each"]}
              buttonText="Start Referring"
              buttonHref="/dashboard/referrals"
            />
            <PromoCTA
              variant="dark"
              title="Managed Compliance Service"
              description="Let our team handle data collection, report preparation, and Secretariat submission."
              tags={["Report Preparation", "Submission Handling", "Audit Defense"]}
              buttonText="Get a Quote"
              onButtonClick={() => window.open("mailto:hello@lcadesk.com?subject=Managed%20Service%20Inquiry", "_blank")}
            />
          </div>

          {/* News */}
          <div className="mt-4">
            <IndustryNewsFeed userType="filer" />
          </div>
        </>
      )}
    </div>
  );
}
