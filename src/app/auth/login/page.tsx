"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = searchParams.get("role");
  const redirect = searchParams.get("redirect");
  const registered = searchParams.get("registered");

  // Determine where to send user after login based on role
  const getPostLoginPath = () => {
    if (redirect) return redirect;
    if (role === "job_seeker") return "/seeker/dashboard";
    if (role === "supplier") return "/supplier-portal/dashboard";
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

    router.push(getPostLoginPath());
  };

  const roleLabels: Record<string, string> = {
    job_seeker: "Job Seeker",
    supplier: "Supplier",
    filer: "Compliance Filing",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md p-8">
        <div className="flex justify-center mb-8">
          <Image src="/logo-full.png" alt="LCA Desk" width={200} height={60} priority />
        </div>

        {registered && (
          <div className="rounded-lg border border-success/30 bg-success-light p-4 mb-4 text-center">
            <p className="text-sm font-medium text-success">Account created successfully!</p>
            <p className="text-xs text-text-secondary mt-1">Sign in to get started.</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
            Welcome{registered ? "" : " back"}
          </h1>
          <p className="text-sm text-text-secondary text-center mb-4">
            {role && roleLabels[role]
              ? `Sign in to your ${roleLabels[role]} portal`
              : "Sign in to your compliance dashboard"}
          </p>
          {role && roleLabels[role] && (
            <div className="flex justify-center mb-4">
              <Badge variant="accent">{roleLabels[role]}</Badge>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
            <PasswordInput
              id="password"
              label="Password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>

          <p className="text-sm text-text-secondary text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-accent hover:text-accent-hover font-medium">
              Sign up
            </Link>
          </p>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-text-muted">
            <a href="https://lcadesk.com" className="hover:text-text-secondary transition-colors">
              Learn more about LCA Desk →
            </a>
          </p>
          <a href="/demo" className="text-[9px] text-border hover:text-text-muted transition-colors">
            ·
          </a>
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
