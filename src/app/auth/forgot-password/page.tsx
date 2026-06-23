"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
      } else {
        setSent(true);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo-full.svg" alt="LCA Desk" width={140} height={40} className="mx-auto mb-6" priority />
        </div>

        {sent ? (
          <div className="bg-bg-card rounded-2xl border border-border p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-success" />
            </div>
            <h1 className="text-xl font-heading font-bold text-text-primary mb-2">Check your email</h1>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. It expires in 1 hour.
            </p>
            <p className="text-xs text-text-muted mb-6">
              Didn&apos;t receive it? Check your spam folder, or try again in a few minutes.
            </p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Try a different email
              </Button>
              <Link href="/auth/login">
                <Button variant="ghost" className="w-full gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-bg-card rounded-2xl border border-border p-8">
            <h1 className="text-xl font-heading font-bold text-text-primary mb-2">Reset your password</h1>
            <p className="text-sm text-text-secondary mb-6">
              Enter the email address you used to sign up and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" loading={loading}>
                Send reset link
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/auth/login" className="text-sm text-accent hover:text-accent-hover font-medium inline-flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
