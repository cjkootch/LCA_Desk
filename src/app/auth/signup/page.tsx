"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Create profile
      await supabase.from("profiles").insert({
        id: authData.user.id,
        email,
        full_name: fullName,
      });

      // Get default jurisdiction (Guyana)
      const { data: jurisdiction } = await supabase
        .from("jurisdictions")
        .select("id")
        .eq("code", "GY")
        .single();

      // Create tenant
      const { data: tenant } = await supabase
        .from("tenants")
        .insert({
          name: companyName,
          slug: slugify(companyName),
          jurisdiction_id: jurisdiction?.id,
        })
        .select()
        .single();

      if (tenant) {
        // Create membership
        await supabase.from("tenant_members").insert({
          tenant_id: tenant.id,
          user_id: authData.user.id,
          role: "owner",
        });
      }

      toast.success("Account created! Check your email to verify.");
      router.push("/dashboard");
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
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
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
              placeholder="Min 8 characters"
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
      </div>
    </div>
  );
}
