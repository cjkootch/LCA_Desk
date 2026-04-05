"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPlanAndUsage } from "@/server/actions";
import { PLANS, getPlan, type PlanCode } from "@/lib/plans";

export default function BillingPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPlanAndUsage>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlanAndUsage()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = getPlan(data?.plan);

  const features: { label: string; starter: boolean | string; pro: boolean | string; enterprise: boolean | string }[] = [
    { label: "Entities", starter: "1", pro: "5", enterprise: "Unlimited" },
    { label: "Team Members", starter: "1", pro: "5", enterprise: "Unlimited" },
    { label: "AI Narrative Drafts", starter: "3/month", pro: "Unlimited", enterprise: "Unlimited" },
    { label: "AI Expert Chat", starter: "10 msgs/month", pro: "Unlimited", enterprise: "Unlimited" },
    { label: "Excel Export", starter: false, pro: true, enterprise: true },
    { label: "PDF Export", starter: false, pro: true, enterprise: true },
    { label: "AI Compliance Scan", starter: false, pro: true, enterprise: true },
    { label: "Deadline Alerts", starter: false, pro: true, enterprise: true },
    { label: "Data Extraction (AI)", starter: false, pro: false, enterprise: true },
    { label: "Priority Support", starter: false, pro: false, enterprise: true },
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
                <Badge variant={currentPlan.code === "starter" ? "default" : "accent"}>
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

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {(Object.values(PLANS) as typeof PLANS[PlanCode][]).map((plan) => {
            const isCurrent = plan.code === currentPlan.code;
            const isPopular = plan.code === "pro";

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
                    <span className="text-3xl font-bold text-text-primary">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-text-muted text-sm">/month</span>
                    )}
                    {plan.price === 0 && (
                      <span className="text-text-muted text-sm ml-1">Free</span>
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
                      {plan.features.complianceScan ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-text-muted shrink-0" />
                      )}
                      <span className={!plan.features.complianceScan ? "text-text-muted" : ""}>
                        AI Compliance Scan
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
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={isPopular ? "primary" : "outline"}
                      className="w-full"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      {plan.price === 0 ? "Downgrade" : "Upgrade"}
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
                    <th className="text-center py-3 px-4 font-medium text-text-secondary">Starter</th>
                    <th className="text-center py-3 px-4 font-medium text-accent">Pro</th>
                    <th className="text-center py-3 px-4 font-medium text-text-secondary">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.label} className="border-b border-border-light">
                      <td className="py-3 pr-4 text-text-primary">{f.label}</td>
                      {(["starter", "pro", "enterprise"] as const).map((plan) => (
                        <td key={plan} className="text-center py-3 px-4">
                          {typeof f[plan] === "boolean" ? (
                            f[plan] ? (
                              <Check className="h-4 w-4 text-success mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-text-muted mx-auto" />
                            )
                          ) : (
                            <span className="text-text-primary font-medium">{f[plan]}</span>
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
