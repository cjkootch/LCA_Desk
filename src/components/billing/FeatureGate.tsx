"use client";

import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface FeatureGateProps {
  planRequired: "pro" | "enterprise";
  featureName: string;
  children: React.ReactNode;
  currentPlan: string;
}

export function FeatureGate({
  planRequired,
  featureName,
  children,
  currentPlan,
}: FeatureGateProps) {
  const planRank: Record<string, number> = { free: 0, lite: 1, starter: 1, pro: 2, enterprise: 3 };
  const hasAccess =
    (planRank[currentPlan as keyof typeof planRank] ?? 0) >=
    (planRank[planRequired] ?? 0);

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 blur-[1px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-bg-card border border-border rounded-xl p-6 shadow-lg text-center max-w-sm">
          <div className="p-3 rounded-full bg-accent-light inline-flex mb-3">
            <Lock className="h-5 w-5 text-accent" />
          </div>
          <h3 className="font-heading font-bold text-text-primary mb-1">
            {featureName}
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            This feature requires the{" "}
            <span className="font-semibold text-accent capitalize">
              {planRequired}
            </span>{" "}
            plan.
          </p>
          <Link href="/dashboard/settings/billing">
            <Button size="sm">
              <Sparkles className="h-4 w-4 mr-1" />
              Upgrade to {planRequired === "pro" ? "Pro" : "Enterprise"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
