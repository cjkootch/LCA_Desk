"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Lock, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="bg-bg-card rounded-2xl border border-border p-8 text-center">
        <div className="h-14 w-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-7 w-7 text-warning" />
        </div>
        <h1 className="text-xl font-heading font-bold text-text-primary mb-2">Invalid reset link</h1>
        <p className="text-sm text-text-secondary mb-6">
          This password reset link is missing or malformed. Please request a new one.
        </p>
        <Link href="/auth/forgot-password">
          <Button className="w-full">Request new reset link</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="bg-bg-card rounded-2xl border border-border p-8 text-center">
        <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-7 w-7 text-success" />
        </div>
        <h1 className="text-xl font-heading font-bold text-text-primary mb-2">Password reset!</h1>
        <p className="text-sm text-text-secondary mb-6">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Link href="/auth/login">
          <Button className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-2xl border border-border p-8">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-2">Set a new password</h1>
      <p className="text-sm text-text-secondary mb-6">
        Choose a strong password for your LCA Desk account.
      </p>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-medium text-text-secondary mb-1.5">
            Confirm new password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          Reset password
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/auth/login" className="text-sm text-accent hover:text-accent-hover font-medium inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo-full.svg" alt="LCA Desk" width={140} height={40} className="mx-auto mb-6" priority />
        </div>
        <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" />}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
