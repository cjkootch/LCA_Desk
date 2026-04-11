"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Building2, Shield, Search, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_ROLES = [
  {
    id: "filer",
    email: "demo-filer-pro@lcadesk.com",
    label: "Contractor / Filer",
    description: "File half-yearly reports, track compliance, generate AI narratives",
    icon: Building2,
    color: "accent",
    redirect: "/dashboard",
  },
  {
    id: "secretariat",
    email: "demo-secretariat@lcadesk.com",
    label: "Secretariat / Regulator",
    description: "Review submissions, audit compliance, manage the LCS Register",
    icon: Shield,
    color: "gold",
    redirect: "/secretariat/dashboard",
  },
  {
    id: "seeker",
    email: "demo-seeker@lcadesk.com",
    label: "Job Seeker",
    description: "Browse petroleum jobs, track applications, build your resume",
    icon: Search,
    color: "accent",
    redirect: "/seeker/dashboard",
  },
] as const;

export default function DemoSelectPage() {
  const [switching, setSwitching] = useState<string | null>(null);

  const handleSelect = async (role: typeof DEMO_ROLES[number]) => {
    setSwitching(role.id);
    try {
      const res = await signIn("credentials", {
        email: role.email,
        password: "demo-password-2026",
        redirect: false,
      });
      if (res?.error) {
        setSwitching(null);
        return;
      }
      window.location.href = role.redirect;
    } catch {
      setSwitching(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Image src="/logo-full.svg" alt="LCA Desk" width={160} height={48} className="mx-auto mb-6" priority />
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">
            Choose Your Demo View
          </h1>
          <p className="text-sm text-text-secondary">
            Explore LCA Desk from any perspective. Switch between roles anytime using the demo bar.
          </p>
        </div>

        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Interactive Demo</p>
              <p className="text-xs text-text-secondary mt-1">
                This is a live demo with sample data. Look for <Info className="h-3 w-3 inline text-text-muted" /> icons throughout — they explain what each section does. You can switch between views anytime using the banner at the top.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {DEMO_ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelect(role)}
              disabled={switching !== null}
              className={cn(
                "w-full rounded-xl border p-5 text-left transition-all",
                "hover:border-accent/40 hover:shadow-md",
                switching === role.id ? "border-accent bg-accent/5" : "border-border bg-bg-card",
                switching !== null && switching !== role.id && "opacity-50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl shrink-0",
                  role.color === "gold" ? "bg-gold/10" : "bg-accent-light"
                )}>
                  <role.icon className={cn(
                    "h-6 w-6",
                    role.color === "gold" ? "text-gold" : "text-accent"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-text-primary">{role.label}</p>
                  <p className="text-sm text-text-muted mt-0.5">{role.description}</p>
                </div>
                {switching === role.id ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent shrink-0" />
                ) : (
                  <ArrowRight className="h-5 w-5 text-text-muted shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-text-muted text-center mt-6">
          All data is sample data for demonstration purposes.
        </p>
      </div>
    </div>
  );
}
