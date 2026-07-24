"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchRegisterCompany } from "@/server/actions";
import { AlertTriangle, MapPin, Phone, CheckCircle2, ShieldCheck, Clock } from "lucide-react";

type RegisterCompany = {
  slug: string;
  legalName: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  status: string | null;
};

// H1 2026 local content filing deadline.
const H1_DEADLINE = new Date("2026-07-30T23:59:59");

function daysUntilDeadline(): number {
  const ms = H1_DEADLINE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function ClaimReportPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [company, setCompany] = useState<RegisterCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const daysLeft = daysUntilDeadline();

  useEffect(() => {
    fetchRegisterCompany(slug)
      .then((c) => {
        if (c) {
          setCompany(c as RegisterCompany);
          setCompanyName(c.legalName);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = passwordRef.current?.value || "";
    if (!fullName.trim()) { toast.error("Please enter your name"); return; }
    if (!email.trim()) { toast.error("Please enter your email"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          companyName: companyName || company?.legalName || undefined,
          accountType: "self",
          role: "filer",
          registerSlug: company?.slug || slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error === "Email already registered"
          ? "That email is already registered — please sign in."
          : (data.error || "Sign-up failed"));
        setSubmitting(false);
        return;
      }

      // Fire the same conversion events as the main signup flow.
      if (typeof window !== "undefined") {
        try {
          const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
          const alreadyFired = localStorage.getItem("gads_purchase_fired");
          if (gtag && !alreadyFired) {
            const [firstName, ...rest] = (fullName || "").trim().split(" ");
            const userData = {
              email: email.trim().toLowerCase(),
              address: firstName ? { first_name: firstName, last_name: rest.join(" ") || undefined } : undefined,
            };
            gtag("event", "conversion", { send_to: "AW-18087842219/ppGnCIeHuZ0cEKuj-rBD", user_data: userData });
            gtag("event", "conversion_event_purchase", { user_data: userData });
            localStorage.setItem("gads_purchase_fired", "true");
          }
        } catch {}
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        toast.success("Account created — please sign in.");
        router.push("/auth/login");
      } else {
        toast.success("Your H1 report is ready to finish.");
        window.location.href = "/dashboard";
      }
    } catch {
      toast.error("Sign-up failed");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const displayName = company?.legalName || companyName || "your company";

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Deadline banner */}
      <div className="bg-danger text-white">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-center">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          H1 local content filing deadline — July 30
          {daysLeft > 0 ? <span>· just {daysLeft} day{daysLeft === 1 ? "" : "s"} left</span> : <span>· due today</span>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <img src="/logo-full.svg" alt="LCA Desk" className="h-8 mb-8" />

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: the pitch, personalized */}
          <div>
            {notFound ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary mb-3">
                  Start your H1 local content report
                </h1>
                <p className="text-text-secondary leading-relaxed mb-6">
                  The H1 filing deadline is <strong>July 30</strong>. Create your account and
                  LCA Desk will structure your report, validate it for completeness, and draft
                  your narrative sections — most filers finish in about two hours.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success text-xs font-semibold px-3 py-1 mb-4">
                  <ShieldCheck className="h-3.5 w-3.5" /> Found on the LCS register
                </div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary mb-3">
                  {displayName}&rsquo;s H1 report is ready to finish
                </h1>
                <p className="text-text-secondary leading-relaxed mb-6">
                  Because {displayName} is on the LCS register, your H1 local content report is
                  due <strong>July 30</strong>. We&rsquo;ve pre-filled what&rsquo;s on the public
                  register — claim it below and you&rsquo;re reviewing instead of starting from a
                  blank page.
                </p>

                {/* Pre-filled details card */}
                <div className="rounded-xl border border-border bg-bg-surface p-4 space-y-2.5 mb-6">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Already filled in for you
                  </p>
                  <div className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span><strong className="text-text-primary">{displayName}</strong></span>
                  </div>
                  {company?.address && (
                    <div className="flex items-start gap-2 text-sm text-text-secondary">
                      <MapPin className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
                      <span>{company.address}</span>
                    </div>
                  )}
                  {company?.phone && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Phone className="h-4 w-4 text-text-muted shrink-0" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <ul className="space-y-2.5 text-sm text-text-secondary">
              {[
                "Secretariat-ready Half-Yearly Report in about 2 hours",
                "AI-drafted narrative sections — save a full day of writing",
                "Completeness checks flag gaps before you submit",
                "Timestamped, audit-ready record every time",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: the claim form */}
          <div className="rounded-2xl border border-border bg-bg-surface p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
              <Clock className="h-4 w-4" />
              <span>Free 30-day trial · no credit card</span>
            </div>
            <h2 className="text-xl font-heading font-bold text-text-primary mb-5">
              Claim {notFound ? "your report" : "this report"}
            </h2>
            <form onSubmit={handleClaim} className="space-y-3.5">
              {notFound && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Company name</label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company's legal name" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Your name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="First and last name" autoComplete="name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Work email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
                <Input ref={passwordRef} type="password" placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                {daysLeft > 0 ? `Start now — ${daysLeft} day${daysLeft === 1 ? "" : "s"} to July 30` : "Start my H1 report"}
              </Button>
              <p className="text-xs text-text-muted text-center">
                Already have an account? <Link href="/auth/login" className="text-accent hover:underline">Sign in</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
