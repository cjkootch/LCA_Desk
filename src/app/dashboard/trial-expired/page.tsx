import Image from "next/image";
import Link from "next/link";
import { CheckCircle, Sparkles, Lock, ArrowRight } from "lucide-react";

const ESSENTIALS_FEATURES = [
  "1 entity",
  "3 users",
  "All 5 mandatory submission types",
  "Excel + PDF export (2 included/yr, $25 each after)",
  "Compliance Health Score",
  "Deadline alerts & filing calendar",
  "Email support (48hr)",
];

const PRO_FEATURES = [
  "Up to 5 entities",
  "15 users",
  "Unlimited report generation",
  "AI Narrative Drafting",
  "AI Compliance Gap Detection",
  "Talent Pool access",
  "Supplier search + contacts",
  "Market intelligence + opportunities",
  "Audit log",
  "QuickBooks integration",
  "Priority support (24hr)",
];

export default function TrialExpiredPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <Image src="/logo-full.svg" alt="LCA Desk" width={160} height={48} className="mx-auto mb-6" />
          <div className="inline-flex items-center gap-2 bg-warning-light border border-warning/20 text-warning text-sm font-medium px-4 py-2 rounded-full mb-4">
            <Lock className="h-4 w-4" />
            Your 30-day free trial has ended
          </div>
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-3">
            Choose a plan to continue
          </h1>
          <p className="text-text-secondary max-w-lg mx-auto text-sm">
            Your data is safe and waiting. You now have read-only Essentials access.
            Select a plan to regain full access to your compliance dashboard and filing tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Essentials */}
          <div className="rounded-2xl border border-border bg-bg-card p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-xl font-heading font-bold text-text-primary">Essentials</h2>
              <p className="text-sm text-text-muted mt-0.5">Small vendors / 1-15 employees</p>
            </div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-text-primary">$199</span>
              <span className="text-text-muted text-sm ml-1">/mo</span>
            </div>
            <p className="text-xs text-text-muted mb-6">2 report exports included · $25 each after · or $159/mo billed annually</p>
            <ul className="space-y-2.5 mb-8 flex-1">
              {ESSENTIALS_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/settings/billing?plan=lite"
              className="block w-full text-center rounded-xl border-2 border-accent text-accent px-6 py-3 text-sm font-semibold hover:bg-accent/5 transition-colors">
              Choose Essentials <ArrowRight className="inline h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Professional */}
          <div className="rounded-2xl border-2 border-accent bg-bg-card p-6 flex flex-col relative shadow-lg shadow-accent/10">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
              What you had in your trial
            </span>
            <div className="mb-4">
              <h2 className="text-xl font-heading font-bold text-text-primary">Professional</h2>
              <p className="text-sm text-text-muted mt-0.5">Growing contractors / 15-150 employees</p>
            </div>
            <div className="mb-1">
              <span className="text-4xl font-bold text-text-primary">$399</span>
              <span className="text-text-muted text-sm ml-1">/mo</span>
            </div>
            <p className="text-xs text-text-muted mb-6">Unlimited reports · or $319/mo billed annually · save $960/yr</p>
            <ul className="space-y-2.5 mb-8 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                  <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/settings/billing?plan=pro"
              className="block w-full text-center rounded-xl bg-gradient-to-r from-accent to-teal text-white px-6 py-3 text-sm font-semibold hover:shadow-lg hover:shadow-accent/20 transition-all">
              <Sparkles className="inline h-4 w-4 mr-1.5" /> Upgrade to Professional
            </Link>
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-text-muted">
            Need unlimited entities or a custom contract?{" "}
            <Link href="/dashboard/settings/billing" className="text-accent hover:underline font-medium">View Enterprise →</Link>
          </p>
          <p className="text-xs text-text-muted">
            Your data is never deleted. <a href="mailto:support@lcadesk.com" className="text-accent hover:underline">Contact support</a> if you need help.
          </p>
        </div>
      </div>
    </div>
  );
}
