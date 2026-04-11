"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Clock,
  CheckCircle,
  FileText,
  Sparkles,
  Calendar,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyDashboardProps {
  trialDaysRemaining?: number | null;
}

// Hardcoded GY H1/H2 deadlines — H1 due Jul 30, H2 due Jan 30 (next year)
function getNextDeadline(): { label: string; dueDate: Date; daysRemaining: number; periodLabel: string } {
  const now = new Date();
  const year = now.getFullYear();

  const candidates = [
    {
      label: "H1 Half-Yearly Report",
      periodLabel: `Jan 1 – Jun 30, ${year}`,
      dueDate: new Date(year, 6, 30), // July 30
    },
    {
      label: "H2 Half-Yearly Report",
      periodLabel: `Jul 1 – Dec 31, ${year}`,
      dueDate: new Date(year + 1, 0, 30), // Jan 30 next year
    },
    // Also check previous year's H2 in case we're in Jan
    {
      label: "H2 Half-Yearly Report",
      periodLabel: `Jul 1 – Dec 31, ${year - 1}`,
      dueDate: new Date(year, 0, 30), // Jan 30 this year
    },
  ];

  // Find the next upcoming deadline (smallest positive days remaining, or the least overdue)
  const withDays = candidates
    .map((c) => ({
      ...c,
      daysRemaining: Math.ceil((c.dueDate.getTime() - now.getTime()) / 86400000),
    }))
    .sort((a, b) => {
      // Prefer upcoming (positive), then least overdue
      if (a.daysRemaining >= 0 && b.daysRemaining < 0) return -1;
      if (a.daysRemaining < 0 && b.daysRemaining >= 0) return 1;
      return a.daysRemaining - b.daysRemaining;
    });

  return withDays[0];
}

const FILING_STEPS = [
  {
    num: 1,
    label: "Add your entity",
    desc: "Register the company you're filing for",
    time: "2 min",
  },
  {
    num: 2,
    label: "Enter expenditure data",
    desc: "Procurement spend with local vs. foreign breakdown",
    time: "15–30 min",
  },
  {
    num: 3,
    label: "Enter employment data",
    desc: "Headcount by category, Guyanese vs. expatriate",
    time: "10–20 min",
  },
  {
    num: 4,
    label: "Generate AI narrative",
    desc: "AI drafts your Comparative Analysis Report",
    time: "< 1 min",
  },
  {
    num: 5,
    label: "Export & submit",
    desc: "Download Excel + PDF, email to Secretariat",
    time: "5 min",
  },
];

export function EmptyDashboard({ trialDaysRemaining }: EmptyDashboardProps) {
  const deadline = getNextDeadline();
  const days = deadline.daysRemaining;
  const urgent = days <= 14;
  const high = days <= 30 && days > 14;

  const urgencyColor = urgent
    ? { bg: "bg-danger/10", border: "border-danger/30", text: "text-danger", badge: "bg-danger text-white", dot: "bg-danger" }
    : high
    ? { bg: "bg-warning/10", border: "border-warning/30", text: "text-warning", badge: "bg-warning text-white", dot: "bg-warning" }
    : { bg: "bg-accent-light", border: "border-accent/20", text: "text-accent", badge: "bg-accent text-white", dot: "bg-accent" };

  // Fire analytics event on mount
  useEffect(() => {
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "empty_dashboard_viewed",
        properties: { daysUntilDeadline: days, deadlineLabel: deadline.label },
      }),
    }).catch(() => {});
  }, [days, deadline.label]);

  const showTrialBanner =
    trialDaysRemaining !== null &&
    trialDaysRemaining !== undefined &&
    trialDaysRemaining <= 14;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Trial days remaining banner */}
      {showTrialBanner && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 mb-5 flex items-center justify-between gap-4",
            trialDaysRemaining! <= 3
              ? "bg-danger/5 border-danger/30"
              : "bg-warning/5 border-warning/30"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Clock
              className={cn(
                "h-4 w-4 shrink-0",
                trialDaysRemaining! <= 3 ? "text-danger" : "text-warning"
              )}
            />
            <p className="text-sm font-medium text-text-primary">
              {trialDaysRemaining === 0
                ? "Your free trial ends today"
                : `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} left on your free trial`}
            </p>
          </div>
          <Link href="/dashboard/activate">
            <Button
              size="sm"
              variant={trialDaysRemaining! <= 3 ? "danger" : "outline"}
              className="h-7 text-xs px-3 shrink-0"
            >
              Extend to 30 Days
            </Button>
          </Link>
        </div>
      )}

      {/* Deadline hero */}
      <div
        className={cn(
          "rounded-2xl border p-6 mb-5",
          urgencyColor.bg,
          urgencyColor.border
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
                  urgencyColor.badge
                )}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
                {urgent ? "Filing Soon" : high ? "Coming Up" : "Next Deadline"}
              </span>
            </div>
            <h2 className="text-2xl font-heading font-bold text-text-primary">
              {days <= 0
                ? `${deadline.label} is overdue`
                : `${days} day${days !== 1 ? "s" : ""} until ${deadline.label}`}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Reporting period: {deadline.periodLabel} · Due{" "}
              {deadline.dueDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div
            className={cn(
              "p-3 rounded-xl shrink-0",
              urgent ? "bg-danger/10" : high ? "bg-warning/10" : "bg-accent/10"
            )}
          >
            <Calendar className={cn("h-7 w-7", urgencyColor.text)} />
          </div>
        </div>

        {/* Primary CTA */}
        <Link href="/dashboard/entities/new">
          <Button size="lg" className="w-full gap-2 text-base">
            <Building2 className="h-5 w-5" />
            Add Your Entity to Get Started
            <ArrowRight className="h-5 w-5 ml-auto" />
          </Button>
        </Link>
        <p className="text-xs text-text-muted text-center mt-2.5">
          Takes about 2 minutes · No data entry required to start
        </p>
      </div>

      {/* 5-step filing roadmap */}
      <div className="rounded-xl border border-border bg-bg-card p-5 mb-4">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          How filing works — 5 steps, ~45 min total
        </h3>
        <div className="space-y-3">
          {FILING_STEPS.map((step, i) => (
            <div key={step.num} className="flex items-start gap-3">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                  i === 0
                    ? "bg-accent text-white"
                    : "bg-bg-primary border border-border text-text-muted"
                )}
              >
                {i === 0 ? <Building2 className="h-3.5 w-3.5" /> : step.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      i === 0 ? "text-accent" : "text-text-primary"
                    )}
                  >
                    {step.label}
                  </p>
                  <span className="text-xs text-text-muted shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {step.time}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Ask the LCA Expert */}
        <Link href="/dashboard/expert">
          <Card className="h-full hover:border-accent/40 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent-light shrink-0">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">Ask the LCA Expert</p>
                <p className="text-xs text-text-muted mt-0.5">
                  AI assistant trained on the Local Content Act and Version 4.1 guidelines. Get
                  instant answers.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        </Link>

        {/* Referral */}
        <Link href="/dashboard/referrals">
          <Card className="h-full hover:border-accent/40 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-success/10 shrink-0">
                <Gift className="h-4 w-4 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">Refer & Earn</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Know another company that files? Share your referral link and earn a commission.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filing guide link */}
      <div className="rounded-xl border border-border bg-bg-primary px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-text-muted shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-primary">LCA Half-Yearly Report Guide</p>
            <p className="text-xs text-text-muted">
              Step-by-step guide to what data is required and how to complete each section.
            </p>
          </div>
        </div>
        <a
          href="https://lcadesk.com/lca-half-yearly-report-guide"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
            Read Guide <ArrowRight className="h-3 w-3" />
          </Button>
        </a>
      </div>

      {/* Already have an entity notice */}
      <p className="text-xs text-text-muted text-center mt-5">
        Already added your entity?{" "}
        <Link href="/dashboard/entities" className="text-accent hover:underline">
          View your entities →
        </Link>
      </p>
    </div>
  );
}
