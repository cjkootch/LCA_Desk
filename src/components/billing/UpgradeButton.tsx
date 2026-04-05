"use client";

import { Lock, Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import Link from "next/link";

interface UpgradeButtonProps extends Omit<ButtonProps, "children"> {
  currentPlan: string;
  requiredPlan: "pro" | "enterprise";
  children: React.ReactNode;
  onClick?: () => void;
}

export function UpgradeButton({
  currentPlan,
  requiredPlan,
  children,
  onClick,
  ...props
}: UpgradeButtonProps) {
  const planRank = { starter: 0, pro: 1, enterprise: 2 };
  const hasAccess =
    (planRank[currentPlan as keyof typeof planRank] ?? 0) >=
    (planRank[requiredPlan] ?? 0);

  if (hasAccess) {
    return (
      <Button onClick={onClick} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <Link href="/dashboard/settings/billing">
      <Button variant="outline" {...props}>
        <Lock className="h-4 w-4 mr-1" />
        {children}
        <span className="ml-1 text-xs text-accent">({requiredPlan})</span>
      </Button>
    </Link>
  );
}
