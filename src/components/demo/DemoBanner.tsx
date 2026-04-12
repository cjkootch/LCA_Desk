"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { getEffectivePlan, isInTrial, getTrialDaysRemaining } from "@/lib/plans";
import { fetchPlanAndUsage } from "@/server/actions";
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";

export function DemoBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email;
  const [expanded, setExpanded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [planData, setPlanData] = useState<any>(null);

  const isDemo = !!email && email.endsWith("@lcadesk.com") && email.startsWith("demo-");

  useEffect(() => {
    if (isDemo && !email.includes("secretariat") && !email.includes("seeker")) {
      fetchPlanAndUsage().then(setPlanData).catch(() => {});
    }
  }, [email, isDemo]);

  // Set CSS variable so sidebars and content can offset for the banner
  useEffect(() => {
    document.documentElement.style.setProperty("--demo-banner-h", isDemo ? "28px" : "0px");
    return () => { document.documentElement.style.setProperty("--demo-banner-h", "0px"); };
  }, [isDemo]);

  // Heartbeat — fire every 30s while user is on any authenticated demo page
  // so PLG Demo Visitors can track the full journey (arrival → product exploration)
  useEffect(() => {
    if (!isDemo || !email) return;
    const ping = () => fetch("/api/demo/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: typeof window !== "undefined" ? window.location.pathname : null,
        demoRole: email,
      }),
    }).catch(() => {});
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [isDemo, email]);

  if (!isDemo || !email) return null;

  const viewingAs = email.includes("secretariat") ? "Secretariat" :
    email.includes("seeker") ? "Job Seeker" :
    email.includes("filer-lite") ? "Contractor (Lite)" :
    email.includes("filer-pro") ? "Contractor (Pro)" :
    email.includes("filer-trial") ? "Contractor (Trial)" :
    email.includes("filer-expired") ? "Contractor (Expired)" :
    email.includes("supplier") ? "Supplier" :
    email.includes("admin") ? "Super Admin" : "Demo";

  const isSecretariat = email.includes("secretariat");
  const isSeeker = email.includes("seeker");
  const isFiler = !isSecretariat && !isSeeker && email.includes("filer");

  const effectivePlan = planData ? getEffectivePlan(planData.plan, planData.trialEndsAt) : null;
  const inTrial = planData ? isInTrial(planData.trialEndsAt) : false;
  const trialDays = planData ? getTrialDaysRemaining(planData.trialEndsAt) : null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] h-7 bg-gold text-white py-1 text-sm font-medium tracking-wide select-none flex items-center justify-between px-4">
        <span
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => isFiler && setExpanded(!expanded)}
        >
          <span>Viewing as: <strong>{viewingAs}</strong></span>
          {isFiler && (
            <span className="flex items-center gap-0.5 opacity-80">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
          )}
        </span>

        <a
          href="/demo/select"
          className="text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
        >
          Switch View
        </a>
      </div>

      {expanded && isFiler && effectivePlan && (
        <div className="fixed top-7 right-4 z-[100] w-80 bg-white border border-border rounded-xl shadow-xl overflow-hidden text-xs">
          <div className="bg-bg-primary px-4 py-2 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary">{viewingAs}</span>
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

          <div className="px-4 py-2 bg-bg-primary border-t border-border text-xs text-text-muted">
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
