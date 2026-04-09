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
          <Image src="/logo-full.png" alt="LCA Desk" width={200} height={60} priority />
        </div>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-accent to-accent/80 px-6 py-5 text-white">
            <h1 className="text-xl font-heading font-bold">Start Your 30-Day Free Trial</h1>
            <p className="text-sm text-white/80 mt-1">
              Full access to Professional features. Cancel anytime.
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {canceled && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                <p className="text-sm text-text-primary font-medium">Checkout was canceled</p>
                <p className="text-xs text-text-muted mt-0.5">
                  No worries — you can start your trial whenever you're ready.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent/10 shrink-0">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">30 days of Professional features</p>
                  <p className="text-xs text-text-muted">AI narrative drafting, compliance scans, full marketplace access, and more.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success/10 shrink-0">
                  <CreditCard className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">You won't be charged today</p>
                  <p className="text-xs text-text-muted">We collect payment info to start your trial. Your first charge is in 30 days.</p>
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
                  <p className="text-sm font-medium text-text-primary">Essentials plan at $199/mo after trial</p>
                  <p className="text-xs text-text-muted">You can upgrade or change plans at any time from Settings.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <Button className="w-full" size="lg" onClick={handleStartTrial} loading={loading}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add Payment Method & Start Trial
              </Button>

              <p className="text-xs text-text-muted text-center leading-relaxed">
                By starting your trial, you agree to be charged $199/month after 30 days
                unless you cancel. Secure payment processed by Stripe.
              </p>
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
