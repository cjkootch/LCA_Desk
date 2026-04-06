"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPlanAndUsage } from "@/server/actions";
import Link from "next/link";

export function PlanWarningBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetchPlanAndUsage().then(data => {
      // Show warning if on Lite plan (no trial) — exports cost $25/report
      if (!data.isInTrial && data.effectivePlan === "lite") {
        setShow(true);
      }
    }).catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-lg border border-accent/20 bg-accent-light p-3 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
        <p className="text-xs text-text-secondary">
          You&apos;re on the <strong>Lite</strong> plan. Report exports cost $25 each. Upgrade to Pro for unlimited exports and AI features.
        </p>
      </div>
      <Link href="/dashboard/settings/billing">
        <Button variant="outline" size="sm" className="shrink-0 gap-1">
          <Sparkles className="h-3 w-3" /> Upgrade
        </Button>
      </Link>
    </div>
  );
}
