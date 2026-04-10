"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const role = searchParams.get("role");
  const redirect = searchParams.get("redirect");
  const registered = searchParams.get("registered");

  const getPostLoginPath = () => {
    if (redirect) return redirect;
    if (role === "job_seeker") return "/seeker/dashboard";
    if (role === "supplier") return "/supplier-portal/dashboard";
    if (role === "secretariat") return "/secretariat/dashboard";
    if (role === "affiliate") return "/affiliate/dashboard";
    return "/dashboard";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Invalid email or password");
      setLoading(false);
      return;
    }

    window.location.href = getPostLoginPath();
  };

  const roleLabels: Record<string, string> = {
    job_seeker: "Job Seeker",
    supplier: "Supplier",
    secretariat: "Regulatory Office",
    filer: "Compliance Filing",
    affiliate: "Affiliate Partner",
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Form */}
      <div className="flex-1 flex flex-col bg-[#FAF8F5] min-h-screen">
        <div className="p-6">
          <Image src="/logo-full.svg" alt="LCA Desk" width={140} height={42} priority />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            {registered && (
              <div className="rounded-lg border border-success/30 bg-success-light p-4 mb-6 text-center">
                <p className="text-sm font-medium text-success">Account created successfully!</p>
                <p className="text-xs text-text-secondary mt-1">Sign in to get started.</p>
              </div>
            )}

            <h1 className="text-3xl font-heading font-bold text-text-primary mb-8">
              Sign in
            </h1>

            {role && roleLabels[role] && (
              <div className="mb-6">
                <Badge variant="accent">{roleLabels[role]} Portal</Badge>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-sm text-text-secondary font-medium mb-1.5 block">Email</label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-white border-border"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary font-medium mb-1.5 block">Password</label>
                <PasswordInput
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-white border-border"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" loading={loading}>
                Sign in
              </Button>
            </form>

            <div className="flex items-center justify-center gap-3 mt-6 text-sm">
              <Link href="/auth/forgot-password" className="text-accent hover:text-accent-hover font-medium">
                Forgot password
              </Link>
              <span className="text-text-muted">|</span>
              <Link href="/auth/signup" className="text-accent hover:text-accent-hover font-medium">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Brand panel */}
      <div className="hidden lg:flex flex-1 bg-[var(--slate-dark)] items-center justify-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-accent/5" />
        <div className="absolute bottom-32 left-16 w-40 h-40 rounded-full bg-gold/5" />
        <div className="absolute top-1/4 left-1/3 w-24 h-24 rounded-full bg-white/5" />

        <div className="text-center z-10 px-12">
          <Image src="/logo-white.svg" alt="LCA Desk" width={240} height={72} priority className="mx-auto mb-8 opacity-90" />
          <p className="text-white/50 text-lg font-light max-w-sm mx-auto leading-relaxed">
            Multi-jurisdiction local content compliance — built for the petroleum sector
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
