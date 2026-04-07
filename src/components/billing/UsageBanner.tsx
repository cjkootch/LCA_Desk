"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Sparkles, X, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { fetchPlanAndUsage } from "@/server/actions";
import { getEffectivePlan, type BillingAccess } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface UsageBannerProps {
  billingAccess?: BillingAccess;
}

export function UsageBanner({ billingAccess }: UsageBannerProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPlanAndUsage>> | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchPlanAndUsage().then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const access = billingAccess ?? data.billingAccess;

  // ── PAST DUE — non-dismissable, payment action required ───────
  if (access?.state === "past_due") {
    return (
      <div className="rounded-lg border-2 border-danger bg-danger-light p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-danger" />
          <div className="flex-1">
            <p className="font-semibold text-danger text-sm">
              Payment failed — update your payment method now
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Your payment could not be processed. We&apos;re retrying automatically, but please update your payment method to avoid losing access.
            </p>
            <Link href="/dashboard/settings/billing" className="inline-block mt-2">
              <Button size="sm" variant="primary">
                <CreditCard className="h-4 w-4 mr-1" />
                Update Payment Method
              </Button>
            </Link>
          </div>
          {/* No dismiss button — past_due banner cannot be dismissed */}
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  // ── Trial banner ──
  if (data.isInTrial && data.trialDaysRemaining !== null) {
    const days = data.trialDaysRemaining;
    const urgent = days <= 3;

    return (
      <div className={cn(
        "rounded-lg border p-4 mb-6",
        urgent ? "bg-warning-light border-warning/20" : "bg-accent-light border-accent/20"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {urgent
              ? <Clock className="h-5 w-5 mt-0.5 shrink-0 text-warning" />
              : <Sparkles className="h-5 w-5 mt-0.5 shrink-0 text-accent" />
            }
            <div>
              <p className="font-medium text-text-primary text-sm">
                {days === 0
                  ? "Your Professional trial ends today"
                  : `Professional Trial — ${days} day${days !== 1 ? "s" : ""} remaining`}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {urgent
                  ? "Upgrade now to keep AI Narrative Drafting, unlimited reports, and the full marketplace layer."
                  : "You have full Professional access. Upgrade before your trial ends to keep these features."}
              </p>
              <Link href="/dashboard/settings/billing" className="inline-block mt-2">
                <Button size="sm" variant={urgent ? "primary" : "outline"}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Upgrade to Professional
                </Button>
              </Link>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Post-trial / usage limits banner ──
  const plan = getEffectivePlan(data.plan, data.trialEndsAt);
  if (plan.code === "enterprise") return null;

  const warnings: { label: string; used: number; limit: number }[] = [];

  if (plan.aiDraftsPerMonth > 0) {
    const pct = (data.usage.aiDraftsUsed / plan.aiDraftsPerMonth) * 100;
    if (pct >= 60) warnings.push({ label: "AI Drafts", used: data.usage.aiDraftsUsed, limit: plan.aiDraftsPerMonth });
  }

  if (plan.aiChatMessagesPerMonth > 0) {
    const pct = (data.usage.aiChatMessagesUsed / plan.aiChatMessagesPerMonth) * 100;
    if (pct >= 60) warnings.push({ label: "AI Chat Messages", used: data.usage.aiChatMessagesUsed, limit: plan.aiChatMessagesPerMonth });
  }

  if (plan.entityLimit > 0 && data.usage.entityCount >= plan.entityLimit) {
    warnings.push({ label: "Entities", used: data.usage.entityCount, limit: plan.entityLimit });
  }

  if (warnings.length === 0) return null;

  const isAtLimit = warnings.some((w) => w.used >= w.limit);

  return (
    <div className={cn(
      "rounded-lg border p-4 mb-6",
      isAtLimit ? "bg-warning-light border-warning/20" : "bg-accent-light border-accent/20"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className={cn("h-5 w-5 mt-0.5 shrink-0", isAtLimit ? "text-warning" : "text-accent")} />
          <div>
            <p className="font-medium text-text-primary text-sm">
              {isAtLimit ? "You've reached your plan limit" : "Approaching plan limits"}
            </p>
            <div className="mt-2 space-y-2">
              {warnings.map((w) => (
                <div key={w.label} className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-text-secondary">{w.label}</span>
                    <span className="text-text-primary font-medium">{w.used} / {w.limit}</span>
                  </div>
                  <Progress value={Math.min((w.used / w.limit) * 100, 100)}
                    indicatorClassName={w.used >= w.limit ? "bg-warning" : "bg-accent"} />
                </div>
              ))}
            </div>
            <Link href="/dashboard/settings/billing" className="inline-block mt-3">
              <Button size="sm" variant={isAtLimit ? "primary" : "outline"}>
                <Sparkles className="h-4 w-4 mr-1" />
                Upgrade Plan
              </Button>
            </Link>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
