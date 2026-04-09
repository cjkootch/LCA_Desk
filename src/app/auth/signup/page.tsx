"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Building2, Users, ArrowRight, ArrowLeft, Truck, Search } from "lucide-react";

type UserRole = "filer" | "supplier" | "job_seeker" | null;
type AccountType = "self" | "others" | null;

function SignupContent() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") as UserRole;
  const inviteToken = searchParams.get("invite");
  const inviteEmail = searchParams.get("email");

  const [step, setStep] = useState<0 | 1 | 2>(initialRole ? (initialRole === "filer" ? 1 : 2) : 0);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(inviteEmail || "");
  const [companyName, setCompanyName] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const password = passwordRef.current?.value || "";
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          companyName: companyName || undefined,
          accountType: role === "filer" ? accountType : undefined,
          role: role || "filer",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Account created. Please sign in.");
        router.push("/auth/login");
      } else {
        toast.success("Account created!");
        if (role === "job_seeker") window.location.href = "/seeker/dashboard";
        else if (role === "supplier") window.location.href = "/supplier-portal/dashboard";
        else window.location.href = "/dashboard/activate"; // Filers must add CC before trial starts
      }
    } catch {
      toast.error("Registration failed");
    }

    setLoading(false);
  };

  const roleConfig = {
    filer: { redirect: "/dashboard", companyLabel: accountType === "others" ? "Firm Name" : "Company Name", companyPlaceholder: accountType === "others" ? "Your consulting firm" : "Your company's legal name" },
    supplier: { redirect: "/supplier-portal/dashboard", companyLabel: "Company Name", companyPlaceholder: "Your company's legal name" },
    job_seeker: { redirect: "/seeker/dashboard", companyLabel: null, companyPlaceholder: null },
  };

  const config = role ? roleConfig[role] : null;

  return (
    <div className="min-h-screen flex">
      {/* Left — Form */}
      <div className="flex-1 flex flex-col bg-[#FAF8F5] min-h-screen">
        <div className="p-6">
          <Image src="/logo-full.png" alt="LCA Desk" width={140} height={42} priority />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
          {/* Step 0: Choose role */}
          {step === 0 && (
            <>
              <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
                Join LCA Desk
              </h1>
              <p className="text-sm text-text-secondary text-center mb-6">
                How will you use the platform?
              </p>

              <div className="space-y-3 mb-6">
                {[
                  { id: "filer" as const, icon: Building2, label: "I need to file LCA reports", desc: "Contractor, Sub-Contractor, or Licensee with a filing obligation" },
                  { id: "supplier" as const, icon: Truck, label: "I'm a local supplier", desc: "Registered or seeking to be listed in the supplier directory" },
                  { id: "job_seeker" as const, icon: Search, label: "I'm looking for work", desc: "Search petroleum sector jobs and build your professional profile" },
                ].map(r => (
                  <button key={r.id} onClick={() => setRole(r.id)}
                    className={cn("w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                      role === r.id ? "border-accent bg-accent-light" : "border-border hover:border-accent/30"
                    )}>
                    <div className={cn("p-2.5 rounded-lg shrink-0", role === r.id ? "bg-accent text-white" : "bg-bg-primary text-text-muted")}>
                      <r.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{r.label}</p>
                      <p className="text-sm text-text-secondary mt-0.5">{r.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <Button className="w-full" disabled={!role} onClick={() => setStep(role === "filer" ? 1 : 2)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {/* Step 1: Filer account type (filer only) */}
          {step === 1 && role === "filer" && (
            <>
              <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>

              <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
                How will you file?
              </h1>
              <p className="text-sm text-text-secondary text-center mb-6">
                This helps us set up your account correctly.
              </p>

              <div className="space-y-3 mb-6">
                <button onClick={() => setAccountType("self")}
                  className={cn("w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                    accountType === "self" ? "border-accent bg-accent-light" : "border-border hover:border-accent/30"
                  )}>
                  <div className={cn("p-2.5 rounded-lg shrink-0", accountType === "self" ? "bg-accent text-white" : "bg-bg-primary text-text-muted")}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">Filing for my own company</p>
                    <p className="text-sm text-text-secondary mt-0.5">I'm a Contractor, Sub-Contractor, or Licensee filing my own Local Content reports.</p>
                  </div>
                </button>

                <button onClick={() => setAccountType("others")}
                  className={cn("w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                    accountType === "others" ? "border-accent bg-accent-light" : "border-border hover:border-accent/30"
                  )}>
                  <div className={cn("p-2.5 rounded-lg shrink-0", accountType === "others" ? "bg-accent text-white" : "bg-bg-primary text-text-muted")}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">Filing on behalf of clients</p>
                    <p className="text-sm text-text-secondary mt-0.5">I'm a consultant, law firm, or compliance service provider managing reports for multiple companies.</p>
                  </div>
                </button>
              </div>

              <Button className="w-full" disabled={!accountType} onClick={() => setStep(2)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {/* Step 2: Registration form (all roles) */}
          {step === 2 && role && (
            <>
              <button onClick={() => setStep(role === "filer" ? 1 : 0)} className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>

              {inviteToken && (
                <div className="rounded-lg border border-accent/30 bg-accent-light p-3 mb-4 text-center">
                  <p className="text-sm font-medium text-accent">You&apos;ve been invited to join a team</p>
                  <p className="text-xs text-text-secondary mt-0.5">Create your account to accept the invitation.</p>
                </div>
              )}

              <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
                {inviteToken ? "Accept Invitation" : "Create your account"}
              </h1>
              <p className="text-sm text-text-secondary text-center mb-6">
                {inviteToken && "Create your account to join the team."}
                {!inviteToken && role === "filer" && accountType === "self" && "Set up your company's compliance account."}
                {!inviteToken && role === "filer" && accountType === "others" && "Set up your consulting firm's account."}
                {!inviteToken && role === "supplier" && "Set up your supplier account to get discovered by contractors."}
                {!inviteToken && role === "job_seeker" && "Create your profile to find energy sector opportunities."}
              </p>

              <form onSubmit={handleSignup} className="space-y-4">
                <Input id="fullName" label="Full Name" placeholder="John Smith" autoComplete="name"
                  value={fullName} onChange={e => setFullName(e.target.value)} required />
                <Input id="email" label="Email" type="email" placeholder="you@company.gy" autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)} required />
                <Input id="password" label="Password" type="password" placeholder="8+ characters" autoComplete="new-password"
                  ref={passwordRef} required />
                {config?.companyLabel && (
                  <Input id="companyName" label={config.companyLabel} placeholder={config.companyPlaceholder || ""}
                    value={companyName} onChange={e => setCompanyName(e.target.value)}
                    required={role === "filer"} />
                )}

                <Button type="submit" className="w-full" loading={loading}>
                  {role === "filer" ? "Start 30-Day Free Trial" : "Create Account"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </form>

              {role === "filer" && (
                <p className="text-xs text-text-muted text-center mt-3">
                  30-day Professional trial. Cancel anytime — you won't be charged during the trial.
                </p>
              )}
            </>
          )}

          <p className="text-sm text-text-muted text-center mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
          </div>
        </div>
      </div>

      {/* Right — Brand panel */}
      <div className="hidden lg:flex flex-1 bg-[var(--slate-dark)] items-center justify-center relative overflow-hidden">
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-accent/5" />
        <div className="absolute bottom-32 left-16 w-40 h-40 rounded-full bg-gold/5" />
        <div className="text-center z-10 px-12">
          <Image src="/logo-white-lca.png" alt="LCA Desk" width={240} height={72} priority className="mx-auto mb-8 opacity-90" />
          <p className="text-white/50 text-lg font-light max-w-sm mx-auto leading-relaxed">
            Multi-jurisdiction local content compliance — built for the petroleum sector
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
