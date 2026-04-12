"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Building2, Shield, Search, ArrowRight, Info, Play, Sparkles, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_ROLES = [
  {
    id: "secretariat",
    email: "demo-secretariat@lcadesk.com",
    label: "Secretariat / Regulator",
    minWidth: 768,
    description: "Review submissions, audit compliance, manage the LCS Register",
    icon: Shield,
    color: "gold",
    redirect: "/secretariat/dashboard",
    featured: true,
  },
  {
    id: "filer",
    email: "demo-filer-pro@lcadesk.com",
    label: "Contractor / Filer",
    description: "File half-yearly reports, track compliance, generate AI narratives",
    icon: Building2,
    color: "accent",
    redirect: "/dashboard",
    featured: false,
  },
  {
    id: "seeker",
    email: "demo-seeker@lcadesk.com",
    label: "Job Seeker",
    description: "Browse petroleum jobs, track applications, build your resume",
    icon: Search,
    color: "accent",
    redirect: "/seeker/dashboard",
    featured: false,
  },
] as const;

export default function DemoSelectPage() {
  const [switching, setSwitching] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Heartbeat — tracks time on /demo/select
  useEffect(() => {
    const ping = () => fetch("/api/demo/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "/demo/select" }),
    }).catch(() => {});
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, []);

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
      // Log role selection (fire-and-forget)
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "demo_role_selected",
          properties: { role: role.id, label: role.label },
        }),
      }).catch(() => {});
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

        <div className="rounded-lg border border-dashed border-text-muted/30 bg-bg-primary/50 p-3 mb-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Interactive Demo</p>
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
              onClick={() => {
                if ((role as any).minWidth && isMobile) return;
                handleSelect(role);
              }}
              disabled={switching !== null || (!!((role as any).minWidth) && isMobile)}
              className={cn(
                "w-full rounded-xl border text-left transition-all relative",
                (role as any).featured
                  ? "p-6 border-2 border-gold/50 bg-gradient-to-br from-gold/5 to-gold/[0.02] hover:border-gold/70 hover:shadow-lg hover:shadow-gold/10"
                  : "p-5 hover:border-accent/40 hover:shadow-md",
                !((role as any).featured) && (switching === role.id ? "border-accent bg-accent/5" : "border-border bg-bg-card"),
                switching !== null && switching !== role.id && "opacity-50"
              )}
            >
              {/* Start Here badge for featured role */}
              {(role as any).featured && (
                <div className="absolute -top-3 left-5 flex items-center gap-1.5 bg-gold text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Start Here
                </div>
              )}
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
                  {(role as any).minWidth && isMobile && (
                    <p className="text-xs text-warning font-medium mt-1.5 flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      Requires tablet or desktop
                    </p>
                  )}
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

        {/* Contact card */}
        <div className="rounded-2xl border border-border bg-bg-card shadow-sm p-5 mt-6">
          <div className="flex items-center gap-3 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/founder-new.png" alt="Cole Kutschinski" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Cole Kutschinski</p>
              <p className="text-[11px] text-text-muted">Founder, LCA Desk</p>
            </div>
          </div>
          <a href="mailto:Cole@lcadesk.com" className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors mb-3">
            <Mail className="h-3.5 w-3.5 text-text-muted" />Cole@lcadesk.com
          </a>
          <div className="space-y-1.5">
            <a href="/proposal" className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg border-2 border-accent text-accent text-xs font-semibold hover:bg-accent hover:text-white transition-colors">
              View Proposal
            </a>
            <a href="https://teams.microsoft.com/l/chat/0/0?users=Cole@lcadesk.com&message=Hi%20Cole%2C%20I%27d%20like%20to%20schedule%20a%20demo%20meeting." target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-[#5B5FC7] text-white text-xs font-medium hover:bg-[#4B4FB7] transition-colors">
              Schedule Meeting
            </a>
            <a href="https://wa.me/18324927169?text=Hi%20Cole%2C%20I%20just%20tried%20the%20LCA%20Desk%20demo." target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-[#25D366] text-white text-xs font-medium hover:bg-[#1DA851] transition-colors">
              WhatsApp
            </a>
          </div>
        </div>

        <p className="text-xs text-text-muted text-center mt-4">
          All data is sample data for demonstration purposes.
        </p>
      </div>
    </div>
  );
}
