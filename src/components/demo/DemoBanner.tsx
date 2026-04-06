"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { getPlan, getEffectivePlan, isInTrial, getTrialDaysRemaining } from "@/lib/plans";
import { fetchPlanAndUsage } from "@/server/actions";
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";

export function DemoBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const [expanded, setExpanded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [planData, setPlanData] = useState<any>(null);

  useEffect(() => {
    if (email?.startsWith("demo-")) {
      fetchPlanAndUsage().then(setPlanData).catch(() => {});
    }
  }, [email]);

  if (!email?.endsWith("@lcadesk.com") || !email?.startsWith("demo-")) return null;

  const label = email.includes("filer-lite") ? "Filer (Lite)" :
    email.includes("filer-pro") ? "Filer (Pro)" :
    email.includes("filer-trial") ? "Filer (Trial)" :
    email.includes("filer-expired") ? "Filer (Expired Trial)" :
    email.includes("seeker") ? "Job Seeker" :
    email.includes("supplier") ? "Supplier" :
    email.includes("admin") ? "Super Admin" : "Demo";

  const effectivePlan = planData ? getEffectivePlan(planData.plan, planData.trialEndsAt) : null;
  const inTrial = planData ? isInTrial(planData.trialEndsAt) : false;
  const trialDays = planData ? getTrialDaysRemaining(planData.trialEndsAt) : null;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[100] bg-gold text-white text-center py-1 text-[11px] font-medium tracking-wide cursor-pointer select-none flex items-center justify-center gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <span>DEMO MODE — {label}</span>
        <span className="opacity-60">·</span>
        <a href="/demo" className="underline" onClick={e => e.stopPropagation()}>Switch User</a>
        <span className="opacity-60">·</span>
        <span className="flex items-center gap-0.5">
          Info {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </div>

      {expanded && effectivePlan && (
        <div className="fixed top-7 right-4 z-[100] w-80 bg-white border border-border rounded-xl shadow-xl overflow-hidden text-xs">
          <div className="bg-bg-primary px-4 py-2 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary">{label}</span>
              <span className="text-text-muted font-mono">{email}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-text-secondary">
              <span>Plan: <strong className="text-text-primary">{effectivePlan.displayName}</strong></span>
              {inTrial && <span className="text-accent font-medium">(Trial: {trialDays}d left)</span>}
              {planData?.trialEndsAt && !inTrial && trialDays !== null && trialDays <= 0 && (
                <span className="text-danger font-medium">(Trial expired)</span>
              )}
            </div>
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="font-semibold text-text-primary mb-1">Limits</div>
            <Row label="Entities" value={effectivePlan.entityLimit === -1 ? "Unlimited" : String(effectivePlan.entityLimit)} />
            <Row label="Team Members" value={effectivePlan.teamMemberLimit === -1 ? "Unlimited" : String(effectivePlan.teamMemberLimit)} />
            <Row label="AI Drafts/mo" value={effectivePlan.aiDraftsPerMonth === -1 ? "Unlimited" : effectivePlan.aiDraftsPerMonth === 0 ? "None" : String(effectivePlan.aiDraftsPerMonth)} />
            <Row label="AI Chat/mo" value={effectivePlan.aiChatMessagesPerMonth === -1 ? "Unlimited" : effectivePlan.aiChatMessagesPerMonth === 0 ? "None" : String(effectivePlan.aiChatMessagesPerMonth)} />
            {effectivePlan.perReportFee > 0 && <Row label="Export Fee" value={`$${effectivePlan.perReportFee}/report`} />}

            <div className="font-semibold text-text-primary mt-3 mb-1">Features</div>
            {Object.entries(effectivePlan.features).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between py-0.5">
                <span className="text-text-secondary">{formatFeatureName(key)}</span>
                {enabled
                  ? <CheckCircle className="h-3.5 w-3.5 text-success" />
                  : <XCircle className="h-3.5 w-3.5 text-text-muted" />
                }
              </div>
            ))}

            {planData && (
              <>
                <div className="font-semibold text-text-primary mt-3 mb-1">Current Usage</div>
                <Row label="AI Drafts Used" value={String(planData.usage?.aiDraftsUsed || 0)} />
                <Row label="AI Chat Used" value={String(planData.usage?.aiChatMessagesUsed || 0)} />
                <Row label="Entities" value={String(planData.usage?.entityCount || 0)} />
                <Row label="Team Members" value={String(planData.usage?.memberCount || 0)} />
              </>
            )}
          </div>

          <div className="px-4 py-2 bg-bg-primary border-t border-border text-[10px] text-text-muted">
            This panel reads from plans.ts — updates automatically when rules change.
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}

function formatFeatureName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .replace("Qbo", "QBO")
    .replace("Pdf", "PDF")
    .replace("Lcs", "LCS")
    .trim();
}
