"use client";

import { useEffect } from "react";
import { X, Sparkles, Check, ArrowRight, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, getPlan } from "@/lib/plans";
import Link from "next/link";

interface UpgradeModalProps {
  reason: string;
  currentLimit?: number;
  usedCount?: number;
  onClose: () => void;
}

const REASON_CONFIG: Record<string, {
  title: string;
  description: string;
  limitLabel: string;
  requiredPlan: "pro" | "enterprise";
}> = {
  ai_narrative: {
    title: "AI Narrative Drafting",
    description: "Your current plan doesn't include AI-powered narrative drafting. Upgrade to Professional to generate compliance narratives automatically.",
    limitLabel: "AI Narrative Drafting",
    requiredPlan: "pro",
  },
  ai_drafts: {
    title: "Monthly AI Draft Limit Reached",
    description: "You've used all your AI narrative drafts for this month. Upgrade to Professional for unlimited AI drafts.",
    limitLabel: "AI Drafts / Month",
    requiredPlan: "pro",
  },
  ai_chat: {
    title: "Chat Message Limit Reached",
    description: "You've reached your monthly AI chat message limit. Upgrade to Professional for unlimited expert chat.",
    limitLabel: "Chat Messages / Month",
    requiredPlan: "pro",
  },
  ai_chat_plan: {
    title: "AI Expert Chat",
    description: "Your current plan doesn't include the AI Expert Chat. Upgrade to Professional to get instant answers to any compliance question.",
    limitLabel: "AI Expert Chat",
    requiredPlan: "pro",
  },
  compliance_scan: {
    title: "AI Compliance Scan",
    description: "Your current plan doesn't include the AI Compliance Scanner. Upgrade to Professional to automatically detect filing issues before submission.",
    limitLabel: "Compliance Scan",
    requiredPlan: "pro",
  },
  compliance_scan_plan: {
    title: "AI Compliance Scan",
    description: "Your current plan doesn't include the AI Compliance Scanner. Upgrade to Professional to automatically detect filing issues before submission.",
    limitLabel: "Compliance Scan",
    requiredPlan: "pro",
  },
  entities: {
    title: "Entity Limit Reached",
    description: "You've reached the entity limit for your current plan. Upgrade to Professional to file for up to 5 entities.",
    limitLabel: "Entities",
    requiredPlan: "pro",
  },
};

const PLAN_FEATURE_HIGHLIGHTS: Record<"pro" | "enterprise", string[]> = {
  pro: [
    "Up to 5 entities",
    "Unlimited AI narrative drafts",
    "AI Compliance Scanner",
    "Unlimited expert chat",
    "QuickBooks integration",
    "Job board & talent pool",
    "Audit trail",
  ],
  enterprise: [
    "Unlimited entities",
    "Unlimited AI features",
    "API access",
    "Priority support & SLA",
    "White-glove onboarding",
    "Custom integrations",
  ],
};

function fireUpgradeEvent(eventName: string, reason: string) {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, properties: { reason } }),
  }).catch(() => {});
}

const SNOOZE_KEY_PREFIX = "upgrade_snooze_";

export function UpgradeModal({ reason, currentLimit, usedCount, onClose }: UpgradeModalProps) {
  const config = REASON_CONFIG[reason] ?? {
    title: "Upgrade Required",
    description: "This feature requires a higher plan.",
    limitLabel: "Feature",
    requiredPlan: "pro" as const,
  };

  const targetPlan = PLANS[config.requiredPlan];
  const highlights = PLAN_FEATURE_HIGHLIGHTS[config.requiredPlan];

  const showUsage = currentLimit !== undefined && usedCount !== undefined;

  // Fire viewed event on mount
  useEffect(() => {
    fireUpgradeEvent("upgrade_prompt_viewed", reason);
  }, [reason]);

  const handleDismiss = () => {
    fireUpgradeEvent("upgrade_prompt_dismissed", reason);
    onClose();
  };

  const handleSnooze = () => {
    const snoozeUntil = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(`${SNOOZE_KEY_PREFIX}${reason}`, String(snoozeUntil));
    fireUpgradeEvent("upgrade_prompt_snoozed", reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-accent to-accent-hover px-6 pt-6 pb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Upgrade to unlock</p>
                <h2 className="text-white font-bold text-lg leading-tight">{config.title}</h2>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showUsage && (
            <div className="mt-4 bg-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-white/80">{config.limitLabel}</span>
                <span className="text-white font-medium">{usedCount} / {currentLimit}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all"
                  style={{ width: `${Math.min((usedCount! / currentLimit!) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-sm text-text-secondary mb-5">{config.description}</p>

          {/* Plan card */}
          <div className="border border-accent/30 rounded-xl p-4 bg-accent-light/40 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                  {targetPlan.displayName} Plan
                </p>
                <p className="text-2xl font-bold text-text-primary">
                  ${targetPlan.price}
                  <span className="text-sm font-normal text-text-muted">/mo</span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-accent-light">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
            </div>

            <div className="space-y-1.5">
              {highlights.slice(0, 5).map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 text-accent" />
                  </div>
                  <span className="text-xs text-text-secondary">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Link href="/dashboard/settings/billing" onClick={onClose}>
              <Button className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                Upgrade Now
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <button
              onClick={handleSnooze}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors flex items-center justify-center gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              Remind me in 3 days
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-1 text-xs text-text-muted/60 hover:text-text-muted transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
