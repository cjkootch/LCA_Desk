"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";

export default function TrialExpiredPage() {
  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 rounded-full bg-warning-light mb-4">
          <Sparkles className="h-8 w-8 text-warning" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">
          Your Pro Trial Has Ended
        </h1>
        <p className="text-text-secondary max-w-lg mx-auto">
          You still have full access to the Free tier — upload and submit reports to the Secretariat at no cost.
          Upgrade to unlock report generation, AI features, and market intelligence.
        </p>
      </div>

      {/* What you can still do */}
      <Card className="mb-6 border-success/20">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Badge variant="success">Free Tier</Badge> What you can still do
          </h3>
          <ul className="space-y-2">
            {[
              "Upload your Excel report and submit to the Secretariat",
              "Track 1 entity and manage deadlines",
              "Receive deadline reminder alerts",
              "View your compliance dashboard",
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="h-4 w-4 text-success shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* What you're missing */}
      <Card className="mb-8 border-accent/20">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Badge variant="accent">Pro</Badge> What you had during trial
          </h3>
          <ul className="space-y-2">
            {[
              "Auto-generate Excel & PDF compliance reports",
              "AI Narrative Drafting for all report sections",
              "AI Compliance Scan to catch issues before filing",
              "LCA Expert AI chat with your compliance data",
              "Job board, supplier search, and market intelligence",
              "Up to 5 entities and 10 team members",
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                <X className="h-4 w-4 text-text-muted shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
        <Link href="/dashboard/settings/billing">
          <Button size="lg">
            <Sparkles className="h-5 w-5 mr-2" /> Upgrade Now
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" size="lg">
            <Upload className="h-5 w-5 mr-2" /> Continue with Free
          </Button>
        </Link>
      </div>
    </div>
  );
}
