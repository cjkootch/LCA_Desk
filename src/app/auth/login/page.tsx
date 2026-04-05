"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      toast.error(error.message);
    } else {
      setMagicLinkSent(true);
      toast.success("Magic link sent! Check your email.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md p-8">
        <div className="flex justify-center mb-8">
          <Image src="/logo-white.png" alt="LCA Desk" width={180} height={60} priority />
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-8">
          <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-text-secondary text-center mb-6">
            Sign in to your compliance dashboard
          </p>

          {magicLinkSent ? (
            <div className="text-center py-4">
              <p className="text-accent font-medium mb-2">Check your email</p>
              <p className="text-sm text-text-secondary">
                We sent a magic link to <strong className="text-text-primary">{email}</strong>
              </p>
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => setMagicLinkSent(false)}
              >
                Try a different method
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                id="email"
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" loading={loading}>
                Sign In
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-bg-card px-2 text-text-muted">or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleMagicLink}
                disabled={loading}
              >
                Send Magic Link
              </Button>
            </form>
          )}

          <p className="text-sm text-text-secondary text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-accent hover:text-accent-hover font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
