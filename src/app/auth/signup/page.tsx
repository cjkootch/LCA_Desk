"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Building2, Users, ArrowRight, ArrowLeft } from "lucide-react";

type AccountType = "self" | "others" | null;

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
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
          companyName,
          accountType,
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
        router.push("/dashboard");
      }
    } catch {
      toast.error("Registration failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md p-8">
        <div className="flex justify-center mb-8">
          <Image src="/logo-full.png" alt="LCA Desk" width={200} height={60} priority />
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-8 shadow-sm">
          {step === 1 ? (
            <>
              <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
                How will you use LCA Desk?
              </h1>
              <p className="text-sm text-text-secondary text-center mb-6">
                This helps us set up your account correctly.
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setAccountType("self")}
                  className={cn(
                    "w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                    accountType === "self"
                      ? "border-accent bg-accent-light"
                      : "border-border hover:border-accent/30"
                  )}
                >
                  <div className={cn(
                    "p-2.5 rounded-lg shrink-0",
                    accountType === "self" ? "bg-accent text-white" : "bg-bg-primary text-text-muted"
                  )}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">Filing for my own company</p>
                    <p className="text-sm text-text-secondary mt-0.5">
                      I&apos;m a Contractor, Sub-Contractor, or Licensee filing my own Local Content reports.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setAccountType("others")}
                  className={cn(
                    "w-full flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                    accountType === "others"
                      ? "border-accent bg-accent-light"
                      : "border-border hover:border-accent/30"
                  )}
                >
                  <div className={cn(
                    "p-2.5 rounded-lg shrink-0",
                    accountType === "others" ? "bg-accent text-white" : "bg-bg-primary text-text-muted"
                  )}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">Filing on behalf of clients</p>
                    <p className="text-sm text-text-secondary mt-0.5">
                      I&apos;m a consultant, law firm, or compliance service provider managing reports for multiple companies.
                    </p>
                  </div>
                </button>
              </div>

              <Button
                className="w-full"
                disabled={!accountType}
                onClick={() => setStep(2)}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary mb-4"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
                Create your account
              </h1>
              <p className="text-sm text-text-secondary text-center mb-6">
                {accountType === "self"
                  ? "Set up your company's compliance account."
                  : "Set up your consulting firm's account. You'll add client entities after."}
              </p>

              <form onSubmit={handleSignup} className="space-y-4">
                <Input
                  id="fullName"
                  label="Full Name"
                  placeholder="John Smith"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-text-secondary">Password</label>
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full h-10 px-3 rounded-lg bg-white border border-border text-text-primary placeholder:text-text-muted text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                  <p className="text-sm text-text-muted">Must be at least 8 characters</p>
                </div>
                <Input
                  id="companyName"
                  label={accountType === "self" ? "Company Name" : "Firm / Organization Name"}
                  placeholder={
                    accountType === "self"
                      ? "Your company's legal name"
                      : "Your consulting firm's name"
                  }
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" loading={loading}>
                  Create Account
                </Button>
              </form>
            </>
          )}

          <p className="text-sm text-text-secondary text-center mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-accent hover:text-accent-hover font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-xs text-text-muted text-center mt-6">
          <a href="https://lcadesk.com" className="hover:text-text-secondary transition-colors">
            Learn more about LCA Desk →
          </a>
        </p>
      </div>
    </div>
  );
}
