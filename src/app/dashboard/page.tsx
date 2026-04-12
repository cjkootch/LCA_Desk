"use client";

import { useEffect, useState } from "react";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { ComplianceCalendar } from "@/components/dashboard/ComplianceCalendar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import { ComplianceHealthWidget } from "@/components/dashboard/ComplianceHealthWidget";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { EmptyDashboard } from "@/components/dashboard/EmptyDashboard";
import { DashboardIdentity, DashboardStats, StatusCard, DashboardSection } from "@/components/dashboard/shared/DashboardTemplate";
import { PromoCTA } from "@/components/shared/PromoCTA";
import { ActivationChecklist } from "@/components/shared/ActivationChecklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

import { Building2, Plus, ArrowRight, FileText, Play, AlertTriangle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { calculateDeadlines, enrichDeadline } from "@/lib/compliance/deadlines";
import { fetchEntities, fetchComplianceHealth, fetchUserContext, fetchPlanAndUsage, fetchDraftPeriods } from "@/server/actions";
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
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBriefingCard, setShowBriefingCard] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [drafts, setDrafts] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const completed = localStorage.getItem("filer-briefing-completed");
    if (!completed) setShowBriefingCard(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEntities();
        setEntities(data.map(mapDrizzleEntity));
      } catch {}
      setLoading(false);
      fetchComplianceHealth().then(setHealth).catch(() => {});
      fetchUserContext().then(setCtx).catch(() => {});
      fetchPlanAndUsage().then(p => {
        setIsPro(p.effectivePlan === "pro" || p.effectivePlan === "enterprise");
        setTrialDaysRemaining(p.trialDaysRemaining ?? null);
      }).catch(() => {});
      fetchDraftPeriods().then(setDrafts).catch(() => {});
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

  // Report type labels (match the cron labels)
  const reportTypeLabel = (t: string) => ({
    half_yearly_h1: "H1 Half-Yearly",
    half_yearly_h2: "H2 Half-Yearly",
    annual_plan: "Annual Plan",
    performance_report: "Performance Report",
  }[t] || t);

  const statusLabel = (s: string) => ({
    not_started: "Not Started",
    in_progress: "In Progress",
    in_review: "In Review",
    approved: "Approved — Not Submitted",
  }[s] || s);

  const hasUrgentDrafts = drafts.some(d => d.urgency === "overdue" || d.urgency === "urgent");

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <AnnouncementBanner userRole="filer" />

      {/* Draft submissions banner — surfaces unfinished reports */}
      {drafts.length > 0 && (
        <div className={cn(
          "rounded-2xl border-2 mb-6 overflow-hidden",
          hasUrgentDrafts
            ? "border-warning bg-gradient-to-br from-warning/10 to-transparent"
            : "border-accent/30 bg-gradient-to-br from-accent/5 to-transparent"
        )}>
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                hasUrgentDrafts ? "bg-warning/15" : "bg-accent/10"
              )}>
                {hasUrgentDrafts
                  ? <AlertTriangle className="h-5 w-5 text-warning" />
                  : <FileText className="h-5 w-5 text-accent" />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-heading font-bold text-text-primary">
                    {drafts.length === 1 ? "1 Report in Draft" : `${drafts.length} Reports in Draft`}
                  </h3>
                  {hasUrgentDrafts && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wider">
                      Action Needed
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Complete and submit these before the deadline to stay compliant. We&apos;ll remind you as deadlines approach.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {drafts.slice(0, 4).map(draft => {
                const urgencyClass = {
                  overdue: "border-danger bg-danger/5",
                  urgent: "border-warning bg-warning/5",
                  soon: "border-accent/40 bg-accent/5",
                  normal: "border-border bg-bg-surface",
                }[draft.urgency as string] || "border-border bg-bg-surface";

                const urgencyBadge = {
                  overdue: { cls: "bg-danger text-white", label: `${Math.abs(draft.daysUntilDue)} days overdue` },
                  urgent: { cls: "bg-warning text-white", label: `${draft.daysUntilDue}d left` },
                  soon: { cls: "bg-accent/15 text-accent", label: `${draft.daysUntilDue}d left` },
                  normal: { cls: "bg-bg-primary text-text-muted", label: draft.daysUntilDue !== null ? `${draft.daysUntilDue}d left` : "No deadline" },
                }[draft.urgency as string] || { cls: "bg-bg-primary text-text-muted", label: "" };

                return (
                  <Link
                    key={draft.id}
                    href={`/dashboard/entities/${draft.entityId}/periods/${draft.id}`}
                    className={cn(
                      "block rounded-lg border p-3 hover:shadow-md transition-all group",
                      urgencyClass
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-text-primary truncate">{draft.entityName}</p>
                          <span className="text-xs text-text-muted shrink-0">·</span>
                          <p className="text-xs text-text-secondary shrink-0">{reportTypeLabel(draft.reportType)} {draft.fiscalYear}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {statusLabel(draft.status)}
                          </span>
                          {draft.daysSinceStart > 0 && (
                            <span>Started {draft.daysSinceStart} {draft.daysSinceStart === 1 ? "day" : "days"} ago</span>
                          )}
                        </div>
                      </div>
                      <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold shrink-0", urgencyBadge.cls)}>
                        {urgencyBadge.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </Link>
                );
              })}
              {drafts.length > 4 && (
                <p className="text-xs text-text-muted text-center pt-1">
                  + {drafts.length - 4} more draft{drafts.length - 4 === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Platform Briefing welcome card */}
      {showBriefingCard && (
        <div className="rounded-2xl border-2 border-accent bg-gradient-to-br from-[#19544c] to-[#0d3830] p-8 text-white shadow-xl shadow-accent/10 mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur shrink-0">
              <Play className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent-light bg-white/10 px-2.5 py-1 rounded-full">
                  3-Minute Audio Tour
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-white mb-2">
                Welcome to Your Compliance Dashboard
              </h2>
              <p className="text-sm text-white/70 mb-6 leading-relaxed max-w-lg">
                Take a guided briefing with audio narration to learn how to file your Half-Yearly Reports, use AI narrative drafting, and track deadlines.
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("start-briefing"))}
                  className="flex items-center gap-2 bg-white text-[#19544c] px-6 py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition-all hover:shadow-lg"
                >
                  <Play className="h-4 w-4" />
                  Start Platform Briefing
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("filer-briefing-completed", "true");
                    setShowBriefingCard(false);
                  }}
                  className="text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <EmptyDashboard trialDaysRemaining={trialDaysRemaining} />
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
            info="Your overall compliance rating based on Local Content Rate (expenditure with LCS-certified suppliers), employment percentages, and filing timeliness. Green means you're meeting all requirements."
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
              <div data-briefing="entities">
              <DashboardSection title="Your Entities" info="Each entity represents a company or project that files separately with the Secretariat. Most contractors have one entity, but if you operate multiple subsidiaries each may need its own filing." action={
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
              </div>

              {/* Upcoming deadlines */}
              {upcomingDeadlines.length > 0 && (
                <DashboardSection title="Upcoming Deadlines" info="Filing deadlines for the current and next reporting period. H1 covers January–June (due July 30), H2 covers July–December (due January 30). Click any deadline to start your report." action={
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
              <ActivationChecklist />
              <ComplianceHealthWidget />
              <div data-briefing="deadlines">
                <ComplianceCalendar deadlines={upcomingDeadlines} />
              </div>
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
