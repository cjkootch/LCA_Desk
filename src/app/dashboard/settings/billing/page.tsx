"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X, Sparkles, Crown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPlanAndUsage } from "@/server/actions";
import { toast } from "sonner";
import { PLANS, getPlan, type PlanCode } from "@/lib/plans";

const ANNUAL_DISCOUNT = 0.20; // 20% off

export default function BillingPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPlanAndUsage>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    fetchPlanAndUsage()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [upgrading, setUpgrading] = useState<string | null>(null);

  const currentPlan = getPlan(data?.plan);

  const handleUpgrade = async (planCode: string) => {
    setUpgrading(planCode);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planCode, billing }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to start checkout");
      }
    } catch {
      toast.error("Failed to start checkout");
    }
    setUpgrading(null);
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("No active subscription to manage");
      }
    } catch {
      toast.error("Failed to open billing portal");
    }
  };

  const getPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    if (billing === "annual") {
      return Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT));
    }
    return monthlyPrice;
  };

  const features: { label: string; free: boolean | string; lite: boolean | string; pro: boolean | string; enterprise: boolean | string }[] = [
    { label: "Entities", free: "1", lite: "1", pro: "5", enterprise: "Unlimited" },
    { label: "Team Members", free: "1", lite: "2", pro: "10", enterprise: "Unlimited" },
    { label: "Upload & Submit", free: true, lite: true, pro: true, enterprise: true },
    { label: "Platform Submission", free: true, lite: true, pro: true, enterprise: true },
    { label: "Report Generation", free: false, lite: "$25/report", pro: "Included", enterprise: "Included" },
    { label: "Data Entry & Tracking", free: false, lite: true, pro: true, enterprise: true },
    { label: "AI Narrative Drafts", free: false, lite: false, pro: "Unlimited", enterprise: "Unlimited" },
    { label: "AI Expert Chat", free: false, lite: false, pro: "Unlimited", enterprise: "Unlimited" },
    { label: "AI Compliance Scan", free: false, lite: false, pro: true, enterprise: true },
    { label: "Deadline Alerts", free: true, lite: true, pro: true, enterprise: true },
    { label: "QuickBooks Integration", free: false, lite: false, pro: true, enterprise: true },
    { label: "Job Board Access", free: false, lite: false, pro: true, enterprise: true },
    { label: "Supplier Search", free: false, lite: false, pro: true, enterprise: true },
    { label: "Market Intelligence", free: false, lite: false, pro: true, enterprise: true },
    { label: "Audit Trail", free: false, lite: false, pro: true, enterprise: true },
    { label: "Data Extraction (AI)", free: false, lite: false, pro: false, enterprise: true },
    { label: "Priority Support", free: false, lite: false, pro: false, enterprise: true },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Billing & Plans" />
      <div className="p-8 max-w-5xl">
        <PageHeader
          title="Choose Your Plan"
          description="Scale your compliance operations with the right plan."
          breadcrumbs={[
            { label: "Settings", href: "/dashboard/settings" },
            { label: "Billing" },
          ]}
        />

        {/* Current usage */}
        {data && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Current Usage</CardTitle>
                <Badge variant={currentPlan.code === "free" || currentPlan.code === "lite" ? "default" : "accent"}>
                  {currentPlan.name} Plan
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-text-muted mb-1">Entities</p>
                  <p className="text-lg font-bold">
                    {data.usage.entityCount}
                    <span className="text-text-muted font-normal text-sm">
                      /{currentPlan.entityLimit === -1 ? "\u221E" : currentPlan.entityLimit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Team Members</p>
                  <p className="text-lg font-bold">
                    {data.usage.memberCount}
                    <span className="text-text-muted font-normal text-sm">
                      /{currentPlan.teamMemberLimit === -1 ? "\u221E" : currentPlan.teamMemberLimit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">AI Drafts (this month)</p>
                  <p className="text-lg font-bold">
                    {data.usage.aiDraftsUsed}
                    <span className="text-text-muted font-normal text-sm">
                      /{currentPlan.aiDraftsPerMonth === -1 ? "\u221E" : currentPlan.aiDraftsPerMonth}
                    </span>
                  </p>
                  {currentPlan.aiDraftsPerMonth > 0 && (
                    <Progress
                      value={(data.usage.aiDraftsUsed / currentPlan.aiDraftsPerMonth) * 100}
                      className="mt-1"
                      indicatorClassName={
                        data.usage.aiDraftsUsed >= currentPlan.aiDraftsPerMonth ? "bg-warning" : "bg-accent"
                      }
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">AI Chat (this month)</p>
                  <p className="text-lg font-bold">
                    {data.usage.aiChatMessagesUsed}
                    <span className="text-text-muted font-normal text-sm">
                      /{currentPlan.aiChatMessagesPerMonth === -1 ? "\u221E" : currentPlan.aiChatMessagesPerMonth}
                    </span>
                  </p>
                  {currentPlan.aiChatMessagesPerMonth > 0 && (
                    <Progress
                      value={(data.usage.aiChatMessagesUsed / currentPlan.aiChatMessagesPerMonth) * 100}
                      className="mt-1"
                      indicatorClassName={
                        data.usage.aiChatMessagesUsed >= currentPlan.aiChatMessagesPerMonth ? "bg-warning" : "bg-accent"
                      }
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              billing === "monthly"
                ? "bg-accent text-white"
                : "bg-bg-primary text-text-secondary hover:text-text-primary"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              billing === "annual"
                ? "bg-accent text-white"
                : "bg-bg-primary text-text-secondary hover:text-text-primary"
            )}
          >
            Annual
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full font-semibold",
              billing === "annual"
                ? "bg-white/20 text-white"
                : "bg-accent-light text-accent"
            )}>
              Save 20%
            </span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {(Object.values(PLANS) as typeof PLANS[PlanCode][]).map((plan) => {
            const isCurrent = plan.code === currentPlan.code;
            const isPopular = plan.code === "pro";
            const price = getPrice(plan.price);
            const originalPrice = plan.price;

            return (
              <Card
                key={plan.code}
                className={cn(
                  "relative",
                  isPopular && "border-accent ring-1 ring-accent",
                  isCurrent && "bg-accent-light"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="accent" className="px-3">
                      <Crown className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-2">
                    {plan.price === 0 ? (
                      <>
                        <span className="text-3xl font-bold text-text-primary">$0</span>
                        <span className="text-text-muted text-sm ml-1">Free</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-text-primary">${price}</span>
                        <span className="text-text-muted text-sm">/month</span>
                        {billing === "annual" && (
                          <div className="mt-1">
                            <span className="text-sm text-text-muted line-through">${originalPrice}/mo</span>
                            <span className="text-sm text-accent font-medium ml-2">
                              ${price * 12}/year
                            </span>
                          </div>
                        )}
                        {billing === "monthly" && plan.price > 0 && (
                          <p className="text-xs text-text-muted mt-1">
                            or ${getPrice(plan.price) * 10}/yr with annual billing
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    <li className="text-sm flex items-center gap-2">
                      <Check className="h-4 w-4 text-success shrink-0" />
                      {plan.entityLimit === -1 ? "Unlimited" : plan.entityLimit} entit{plan.entityLimit === 1 ? "y" : "ies"}
                    </li>
                    <li className="text-sm flex items-center gap-2">
                      <Check className="h-4 w-4 text-success shrink-0" />
                      {plan.teamMemberLimit === -1 ? "Unlimited" : plan.teamMemberLimit} team member{plan.teamMemberLimit === 1 ? "" : "s"}
                    </li>
                    <li className="text-sm flex items-center gap-2">
                      <Check className="h-4 w-4 text-success shrink-0" />
                      {plan.aiDraftsPerMonth === -1 ? "Unlimited" : `${plan.aiDraftsPerMonth}/mo`} AI drafts
                    </li>
                    <li className="text-sm flex items-center gap-2">
                      {plan.features.excelExport ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-text-muted shrink-0" />
                      )}
                      <span className={!plan.features.excelExport ? "text-text-muted" : ""}>
                        Excel & PDF export
                      </span>
                    </li>
                    <li className="text-sm flex items-center gap-2">
                      {plan.features.qboIntegration ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-text-muted shrink-0" />
                      )}
                      <span className={!plan.features.qboIntegration ? "text-text-muted" : ""}>
                        QuickBooks integration
                      </span>
                    </li>
                    <li className="text-sm flex items-center gap-2">
                      {plan.features.dataExtraction ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-text-muted shrink-0" />
                      )}
                      <span className={!plan.features.dataExtraction ? "text-text-muted" : ""}>
                        AI Data Extraction
                      </span>
                    </li>
                  </ul>
                  {isCurrent ? (
                    currentPlan.code !== "free" && currentPlan.code !== "lite" ? (
                      <Button variant="outline" className="w-full" onClick={handleManageSubscription}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Manage Subscription
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    )
                  ) : plan.code === "free" ? (
                    <Button variant="outline" className="w-full" disabled>
                      Free
                    </Button>
                  ) : (
                    <Button
                      variant={isPopular ? "primary" : "outline"}
                      className="w-full"
                      onClick={() => handleUpgrade(plan.code)}
                      loading={upgrading === plan.code}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Upgrade to {plan.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 pr-4 font-medium text-text-secondary">Feature</th>
                    <th className="text-center py-3 px-2 font-medium text-text-muted">Free</th>
                    <th className="text-center py-3 px-2 font-medium text-text-secondary">Lite</th>
                    <th className="text-center py-3 px-2 font-medium text-accent">Pro</th>
                    <th className="text-center py-3 px-2 font-medium text-text-secondary">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.label} className="border-b border-border-light">
                      <td className="py-3 pr-4 text-text-primary">{f.label}</td>
                      {(["free", "lite", "pro", "enterprise"] as const).map((plan) => (
                        <td key={plan} className="text-center py-3 px-2">
                          {typeof f[plan] === "boolean" ? (
                            f[plan] ? (
                              <Check className="h-4 w-4 text-success mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-text-muted mx-auto" />
                            )
                          ) : (
                            <span className="text-text-primary font-medium text-xs">{f[plan]}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
