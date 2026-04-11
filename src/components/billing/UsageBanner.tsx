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
      <div className="rounded-xl border border-danger/30 bg-gradient-to-r from-danger/5 to-transparent px-4 py-3 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-1.5 rounded-lg bg-danger/10 shrink-0">
              <AlertTriangle className="h-4 w-4 text-danger" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-danger">Payment failed</p>
              <p className="text-xs text-text-muted mt-0.5 hidden sm:block">Update your payment method to avoid losing access.</p>
            </div>
          </div>
          <Link href="/dashboard/settings/billing" className="shrink-0">
            <Button size="sm" variant="danger" className="h-7 text-xs px-3 gap-1">
              <CreditCard className="h-3 w-3" /> Fix Payment
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  // ── Trial banner ──
  if (data.isInTrial && data.trialDaysRemaining !== null) {
    const days = data.trialDaysRemaining;
    const urgent = days <= 3;
    const canDismiss = days > 7;

    return (
      <div className={cn(
        "rounded-xl border px-4 py-3 mb-4",
        urgent
          ? "bg-gradient-to-r from-warning/5 to-transparent border-warning/20"
          : "bg-gradient-to-r from-accent/5 to-transparent border-accent/20"
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("p-1.5 rounded-lg shrink-0", urgent ? "bg-warning/10" : "bg-accent/10")}>
              {urgent ? <Clock className="h-4 w-4 text-warning" /> : <Sparkles className="h-4 w-4 text-accent" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {days === 0 ? "Trial ends today" : `Professional Trial — ${days} day${days !== 1 ? "s" : ""} left`}
              </p>
              <p className="text-xs text-text-muted mt-0.5 hidden sm:block">
                {urgent
                  ? `Only ${days === 0 ? "today" : `${days} day${days !== 1 ? "s" : ""}`} left — AI narrative drafting, compliance scanner, and unlimited reports will be locked when your trial ends.`
                  : "AI narrative drafting, compliance scanner, and unlimited reports — all locked when trial ends."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard/settings/billing">
              <Button size="sm" variant={urgent ? "primary" : "outline"} className="h-7 text-xs px-3 gap-1">
                <Sparkles className="h-3 w-3" /> Upgrade
              </Button>
            </Link>
            {canDismiss && (
              <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text-secondary p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
      "rounded-xl border px-4 py-3 mb-4",
      isAtLimit
        ? "bg-gradient-to-r from-warning/5 to-transparent border-warning/20"
        : "bg-gradient-to-r from-accent/5 to-transparent border-accent/20"
    )}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn("p-1.5 rounded-lg shrink-0", isAtLimit ? "bg-warning/10" : "bg-accent/10")}>
            <AlertTriangle className={cn("h-4 w-4", isAtLimit ? "text-warning" : "text-accent")} />
          </div>
          <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
            <p className="text-sm font-medium text-text-primary whitespace-nowrap">
              {isAtLimit ? "Plan limit reached" : "Approaching limits"}
            </p>
            <div className="flex items-center gap-4">
              {warnings.map((w) => {
                const pct = Math.min((w.used / w.limit) * 100, 100);
                return (
                  <div key={w.label} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted whitespace-nowrap">{w.label}</span>
                    <div className="w-20 h-1.5 bg-border-light rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", w.used >= w.limit ? "bg-warning" : "bg-accent")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={cn("text-xs font-medium whitespace-nowrap", w.used >= w.limit ? "text-warning" : "text-text-secondary")}>
                      {w.used}/{w.limit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/settings/billing">
            <Button size="sm" variant={isAtLimit ? "primary" : "outline"} className="h-7 text-xs px-3 gap-1">
              <Sparkles className="h-3 w-3" /> Upgrade
            </Button>
          </Link>
          <button onClick={() => setDismissed(true)} className="text-text-muted hover:text-text-secondary p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
