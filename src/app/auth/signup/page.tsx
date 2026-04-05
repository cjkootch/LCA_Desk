"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          companyName,
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
          <h1 className="text-2xl font-heading font-bold text-text-primary text-center mb-2">
            Create your account
          </h1>
          <p className="text-sm text-text-secondary text-center mb-6">
            Start managing your local content compliance
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
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              hint="Must be at least 8 characters"
            />
            <Input
              id="companyName"
              label="Company Name"
              placeholder="Your company or organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Create Account
            </Button>
          </form>

          <p className="text-sm text-text-secondary text-center mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-accent hover:text-accent-hover font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-xs text-text-muted text-center mt-6">
          Powered by Stabroek Advisory
        </p>
      </div>
    </div>
  );
}
