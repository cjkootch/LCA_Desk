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
import { getPlan } from "@/lib/plans";

export default function BillingPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPlanAndUsage>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanAndUsage()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  // ─── Plan definitions matching website ─────────────────────────
  const plans = [
    {
      code: "lite",
      name: "Essentials",
      bestFor: "Small vendors · 1–15 employees",
      monthlyPrice: 199,
      annualEquiv: 159,
      annualTotal: 1908,
      features: [
        "1 entity",
        "3 users",
        "All 6 mandatory submissions",
        "Guided data entry wizard",
        "Deadline alerts & filing calendar",
        "Unlimited report generation",
        "1 year data history",
        "Email support (48hrs)",
      ],
    },
    {
      code: "pro",
      name: "Professional",
      bestFor: "Growing contractors · 15–150 employees",
      monthlyPrice: 399,
      annualEquiv: 319,
      annualTotal: 3828,
      popular: true,
      features: [
        "Up to 5 entities/projects",
        "15 users",
        "Unlimited report generation",
        "AI Narrative Drafting",
        "AI Compliance Gap Detection",
        "Compliance Health Score",
        "Workforce + procurement dashboards",
        "Payment log & audit trail",
        "Unlimited data history",
        "Priority support (24hrs)",
      ],
    },
    {
      code: "enterprise",
      name: "Enterprise",
      bestFor: "Large contractors · multi-entity",
      monthlyPrice: 0,
      annualEquiv: 0,
      annualTotal: 0,
      features: [
        "Unlimited entities",
        "Unlimited users",
        "Role-based permissions",
        "AI-powered reporting",
        "API / ERP integrations",
        "White-glove onboarding",
        "Custom dashboards",
        "SLA support (4hr named CSM)",
      ],
    },
    {
      code: "managed",
      name: "Managed Service",
      bestFor: "Full compliance outsourcing",
      monthlyPrice: 2500,
      annualEquiv: 0,
      annualTotal: 0,
      managed: true,
      features: [
        "Software included",
        "Data collection coordination",
        "Report preparation",
        "AI drafting + human review",
        "Secretariat submission on your behalf",
        "Acknowledgment tracking",
        "Secretariat follow up",
      ],
    },
  ];

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.monthlyPrice === 0) return null;
    return billing === "annual" ? plan.annualEquiv : plan.monthlyPrice;
  };

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
      <div className="p-8 max-w-6xl">
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
                <Badge variant={currentPlan.code === "lite" ? "default" : "accent"}>
                  {currentPlan.displayName} Plan
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

        {/* Plan cards — 4 columns matching website */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {plans.map((plan) => {
            const isCurrent = plan.code === currentPlan.code;
            const price = getPrice(plan);

            return (
              <Card
                key={plan.code}
                className={cn(
                  "relative flex flex-col",
                  plan.popular && "border-accent ring-1 ring-accent",
                  plan.managed && "bg-[#1e293b] text-white border-[#1e293b]",
                  isCurrent && !plan.managed && "bg-accent-light"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="accent" className="px-3">
                      <Crown className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className={cn("text-lg", plan.managed && "text-white")}>{plan.name}</CardTitle>
                  <p className={cn("text-xs mt-0.5", plan.managed ? "text-white/60" : "text-text-muted")}>{plan.bestFor}</p>
                  <div className="mt-3">
                    {plan.code === "enterprise" ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : plan.managed ? (
                      <>
                        <p className="text-xs text-white/60">From</p>
                        <span className="text-3xl font-bold text-white">${plan.monthlyPrice.toLocaleString()}</span>
                        <span className="text-white/60 text-sm">/mo</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">${price}</span>
                        <span className={cn("text-sm", plan.managed ? "text-white/60" : "text-text-muted")}>/mo</span>
                        {billing === "annual" && plan.annualTotal > 0 && (
                          <div className="mt-1">
                            <span className="text-sm text-text-muted line-through">${plan.monthlyPrice}/mo</span>
                            <span className="text-sm text-accent font-medium ml-2">
                              ${(price! * 12).toLocaleString()}/yr
                            </span>
                          </div>
                        )}
                        {billing === "monthly" && plan.annualEquiv > 0 && (
                          <p className="text-xs text-text-muted mt-1">
                            or ${plan.annualEquiv}/mo billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className={cn("text-sm flex items-start gap-2", plan.managed && "text-white/80")}>
                        <Check className={cn("h-4 w-4 shrink-0 mt-0.5", plan.managed ? "text-accent" : "text-success")} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    currentPlan.code !== "lite" ? (
                      <Button variant="outline" className="w-full" onClick={handleManageSubscription}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Manage Subscription
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    )
                  ) : plan.code === "enterprise" ? (
                    <Button variant="outline" className="w-full"
                      onClick={() => window.open("mailto:hello@lcadesk.com?subject=Enterprise%20Plan%20Inquiry", "_blank")}>
                      Contact Us
                    </Button>
                  ) : plan.managed ? (
                    <Button className="w-full bg-accent hover:bg-accent-hover text-white"
                      onClick={() => window.open("mailto:hello@lcadesk.com?subject=Managed%20Service%20Inquiry", "_blank")}>
                      Get a Quote
                    </Button>
                  ) : (
                    <Button
                      variant={plan.popular ? "primary" : "outline"}
                      className="w-full"
                      onClick={() => handleUpgrade(plan.code)}
                      loading={upgrading === plan.code}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      {data?.isInTrial ? "Start 30-Day Trial" : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-text-muted text-center mb-8">
          30-day trial with card collected upfront. Cancel anytime. Data exportable on request.
        </p>

        {/* Feature comparison table — matches website exactly */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-3 pr-4 font-medium text-xs uppercase tracking-wider text-text-muted">Feature</th>
                    <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider text-text-muted">Essentials</th>
                    <th className="text-center py-3 px-2 font-semibold text-xs uppercase tracking-wider text-accent">Professional</th>
                    <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider text-text-muted">Enterprise</th>
                    <th className="text-center py-3 px-2 font-medium text-xs uppercase tracking-wider text-text-muted">Managed</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── CAPACITY ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">Capacity</td></tr>
                  <FeatureRow label="Entities / projects" vals={["1", "Up to 5", "Unlimited", "Unlimited"]} />
                  <FeatureRow label="Users" vals={["3", "10", "Unlimited", "N/A"]} />
                  <FeatureRow label="Data history" vals={["1 year", "Unlimited", "Unlimited", "Unlimited"]} />

                  {/* ── FILING & REPORTING ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">Filing & Reporting</td></tr>
                  <FeatureRow label="All 5 submission types" vals={[true, true, true, true]} />
                  <FeatureRow label="Guided data entry wizard" vals={[true, true, true, true]} />
                  <FeatureRow label="Unlimited report generation" vals={[true, true, true, true]} />
                  <FeatureRow label="Secretariat-ready exports (PDF & Excel)" vals={[true, true, true, true]} />
                  <FeatureRow label="Notice of Submission letter" vals={[true, true, true, true]} />
                  <FeatureRow label="Deadline alerts & filing calendar" vals={[true, true, true, true]} />

                  {/* ── AI FEATURES ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">AI Features</td></tr>
                  <FeatureRow label="AI Narrative Drafting" vals={[false, true, true, true]} />
                  <FeatureRow label="AI Compliance Gap Detection" vals={[false, true, true, true]} />
                  <FeatureRow label="Ask the LCA Expert (AI assistant)" vals={[false, true, true, true]} />
                  <FeatureRow label="Document Intelligence" vals={[false, false, true, true]} />

                  {/* ── ANALYTICS & INSIGHTS ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">Analytics & Insights</td></tr>
                  <FeatureRow label="Compliance Health Score" vals={[true, true, true, true]} />
                  <FeatureRow label="Workforce dashboards" vals={[false, true, true, true]} />
                  <FeatureRow label="Procurement dashboards" vals={[false, true, true, true]} />
                  <FeatureRow label="Payment log" vals={[false, true, true, true]} />
                  <FeatureRow label="Full audit trail" vals={[false, true, true, true]} />

                  {/* ── ADMINISTRATION ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">Administration</td></tr>
                  <FeatureRow label="Role-based permissions" vals={[false, false, true, "N/A"]} />
                  <FeatureRow label="API / ERP integrations" vals={[false, false, true, "N/A"]} />
                  <FeatureRow label="Custom workflows" vals={[false, false, true, "N/A"]} />
                  <FeatureRow label="White-glove onboarding" vals={[false, false, true, true]} />

                  {/* ── MANAGED SERVICES ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">Managed Services</td></tr>
                  <FeatureRow label="Data collection coordination" vals={[false, false, false, true]} />
                  <FeatureRow label="Report preparation" vals={[false, false, false, true]} />
                  <FeatureRow label="AI drafting + human review" vals={[false, false, false, true]} />
                  <FeatureRow label="Secretariat submission on your behalf" vals={[false, false, false, true]} />
                  <FeatureRow label="Acknowledgement tracking" vals={[false, false, false, true]} />
                  <FeatureRow label="Audit defense" vals={[false, false, false, true]} />

                  {/* ── SUPPORT ── */}
                  <tr><td colSpan={5} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-accent">Support</td></tr>
                  <FeatureRow label="Email support" vals={["48hr", "24hr", "4hr SLA", "4hr SLA"]} />
                  <FeatureRow label="Named CSM" vals={[false, false, true, true]} />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureRow({ label, vals }: { label: string; vals: (boolean | string)[] }) {
  return (
    <tr className="border-b border-border-light">
      <td className="py-3 pr-4 text-text-primary">{label}</td>
      {vals.map((v, i) => (
        <td key={i} className="text-center py-3 px-2">
          {typeof v === "boolean" ? (
            v ? <Check className="h-4 w-4 text-accent mx-auto" /> : <span className="text-text-muted">—</span>
          ) : v === "N/A" ? (
            <span className="text-text-muted text-xs">N/A</span>
          ) : (
            <span className="text-text-primary font-medium text-xs">{v}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
