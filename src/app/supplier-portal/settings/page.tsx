"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Crown } from "lucide-react";
import { fetchMySupplierProfile } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEATURES = [
  { label: "Browse opportunities", free: true, pro: true },
  { label: "Basic company profile", free: true, pro: true },
  { label: "LCS cert management", free: true, pro: true },
  { label: "Express interest", free: "3/month", pro: "Unlimited" },
  { label: "Bid/response tracker", free: false, pro: true },
  { label: "Profile analytics", free: false, pro: true },
  { label: "Priority placement in directory", free: false, pro: true },
  { label: "Capability statement", free: false, pro: true },
  { label: "Direct contact visibility", free: false, pro: true },
];

export default function SupplierSettingsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMySupplierProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    try {
      const res = await fetch("/api/stripe/supplier-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "supplier_pro" }),
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
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  const isPro = profile?.tier === "pro";

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Settings</h1>
      <p className="text-sm text-text-secondary mb-6">Manage your subscription and preferences</p>

      {/* Current plan */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Current Plan</CardTitle>
            <Badge variant={isPro ? "accent" : "default"}>{isPro ? "Supplier Pro" : "Free"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isPro ? (
            <p className="text-sm text-text-secondary">You have full access to all supplier features.</p>
          ) : (
            <p className="text-sm text-text-secondary">Upgrade to unlock unlimited responses, analytics, and priority placement.</p>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <p className="text-2xl font-bold mt-1">$0<span className="text-sm text-text-muted font-normal">/month</span></p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FEATURES.map(f => (
                <li key={f.label} className="flex items-center gap-2 text-sm">
                  {f.free ? <Check className="h-4 w-4 text-success shrink-0" /> : <X className="h-4 w-4 text-text-muted shrink-0" />}
                  <span className={!f.free ? "text-text-muted" : ""}>{f.label}</span>
                  {typeof f.free === "string" && <span className="text-xs text-text-muted ml-auto">{f.free}</span>}
                </li>
              ))}
            </ul>
            {!isPro && <Button variant="outline" className="w-full mt-4" disabled>Current Plan</Button>}
          </CardContent>
        </Card>

        <Card className={cn("border-accent ring-1 ring-accent relative")}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge variant="accent" className="px-3"><Crown className="h-3 w-3 mr-1" />Recommended</Badge>
          </div>
          <CardHeader>
            <CardTitle>Supplier Pro</CardTitle>
            <p className="text-2xl font-bold mt-1">$99<span className="text-sm text-text-muted font-normal">/month</span></p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FEATURES.map(f => (
                <li key={f.label} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success shrink-0" />
                  <span>{f.label}</span>
                  {typeof f.pro === "string" && <span className="text-xs text-accent ml-auto font-medium">{f.pro}</span>}
                </li>
              ))}
            </ul>
            {isPro ? (
              <Button variant="outline" className="w-full mt-4" disabled>Current Plan</Button>
            ) : (
              <Button onClick={handleUpgrade} className="w-full mt-4">
                <Sparkles className="h-4 w-4 mr-1" /> Upgrade to Pro
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
