"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, CreditCard, Shield, Clock, Sparkles } from "lucide-react";

function ActivateContent() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled");
  const [loading, setLoading] = useState(false);

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/trial-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to start checkout");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Image src="/logo-full.svg" alt="LCA Desk" width={200} height={60} priority />
        </div>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-accent to-accent/80 px-6 py-5 text-white">
            <h1 className="text-xl font-heading font-bold">Unlock Your Full 30-Day Trial</h1>
            <p className="text-sm text-white/80 mt-1">
              Add a payment method to extend to 30 days of Professional access. No charge until your trial ends.
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {canceled && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                <p className="text-sm text-text-primary font-medium">Checkout was canceled</p>
                <p className="text-xs text-text-muted mt-0.5">
                  No worries — you can add your payment method whenever you're ready.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent/10 shrink-0">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">Professional Trial</span>
                  </div>
                  <p className="text-sm font-medium text-text-primary">30 days of full Professional access (from 14 days free)</p>
                  <p className="text-xs text-text-muted">AI narrative drafting, compliance scans, full marketplace access, and more.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success/10 shrink-0">
                  <CreditCard className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">You won't be charged today</p>
                  <p className="text-xs text-text-muted">We collect payment info to extend your trial. Your first charge is after 30 days.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gold/10 shrink-0">
                  <Clock className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Cancel anytime — no charge</p>
                  <p className="text-xs text-text-muted">Cancel before your trial ends and you'll never be billed.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent/10 shrink-0">
                  <Shield className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">Choose your plan after trial: Essentials $199/mo or Professional $399/mo — upgrade or downgrade anytime</p>
                  <p className="text-xs text-text-muted">You select your plan before your trial ends. Change at any time from Settings.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <Button className="w-full" size="lg" onClick={handleStartTrial} loading={loading}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method & Extend to 30 Days
              </Button>

              <p className="text-xs text-text-muted text-center leading-relaxed">
                You select your plan before your trial ends. No charge until then. Cancel anytime. Secure payment by Stripe.
              </p>

              <div className="text-center">
                <a href="/dashboard" className="text-xs text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2">
                  Skip for now
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    }>
      <ActivateContent />
    </Suspense>
  );
}
