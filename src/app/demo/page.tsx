"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Building2, Briefcase, Truck, Shield, Crown, Lock,
  User, Search, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEMO_USERS = [
  {
    id: "filer-lite",
    label: "Filer (Essentials)",
    description: "Compliance officer on Essentials $199/mo — 1 entity, 3 users",
    icon: Building2,
    plan: "lite",
    role: "filer",
    email: "demo-filer-lite@lcadesk.com",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    id: "filer-pro",
    label: "Filer (Professional)",
    description: "Full compliance team — 5 entities, AI, marketplace, submitted report",
    icon: Crown,
    plan: "pro",
    role: "filer",
    email: "demo-filer-pro@lcadesk.com",
    color: "text-gold",
    bgColor: "bg-gold/10",
  },
  {
    id: "filer-trial",
    label: "Filer (30-Day Trial)",
    description: "New signup in 30-day Professional trial — sees countdown banner",
    icon: Shield,
    plan: "lite",
    role: "filer",
    email: "demo-filer-trial@lcadesk.com",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    id: "filer-expired",
    label: "Filer (Expired Trial)",
    description: "Trial ended 7 days ago — redirected to upgrade page",
    icon: Lock,
    plan: "lite",
    role: "filer",
    email: "demo-filer-expired@lcadesk.com",
    color: "text-danger",
    bgColor: "bg-danger/10",
  },
  {
    id: "seeker",
    label: "Job Seeker",
    description: "Searching for petroleum jobs, resume builder, LMS courses",
    icon: Search,
    plan: null,
    role: "job_seeker",
    email: "demo-seeker@lcadesk.com",
    color: "text-[var(--sky)]",
    bgColor: "bg-[var(--sky-light)]",
  },
  {
    id: "supplier",
    label: "Supplier (Pro)",
    description: "LCS-certified supplier — full profile, opportunity responses, analytics",
    icon: Truck,
    plan: "pro",
    role: "supplier",
    email: "demo-supplier@lcadesk.com",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    id: "secretariat",
    label: "Secretariat",
    description: "Regulatory office — review submissions, compliance tracking, AI analyst",
    icon: Shield,
    plan: null,
    role: "secretariat",
    email: "demo-secretariat@lcadesk.com",
    color: "text-gold",
    bgColor: "bg-gold/10",
  },
  {
    id: "admin",
    label: "Super Admin",
    description: "Platform admin — all tenants, admin panel, enterprise",
    icon: Crown,
    plan: "enterprise",
    role: "filer",
    email: process.env.NEXT_PUBLIC_ADMIN_EMAIL || "demo-admin@lcadesk.com",
    color: "text-danger",
    bgColor: "bg-danger/10",
    isRealAdmin: true,
  },
];

function DemoContent() {
  const [authenticated, setAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (process.env.NEXT_PUBLIC_DEMO_PASSWORD && masterPassword === process.env.NEXT_PUBLIC_DEMO_PASSWORD) {
      setAuthenticated(true);
    } else {
      toast.error("Invalid demo password");
    }
  };

  const handleDemoLogin = async (user: typeof DEMO_USERS[0]) => {
    setSigningIn(user.id);
    try {
      // Super Admin uses the master password (real account), others use demo password
      const password = (user as { isRealAdmin?: boolean }).isRealAdmin ? masterPassword : "demo-password-2026";
      const result = await signIn("credentials", {
        email: user.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error((user as { isRealAdmin?: boolean }).isRealAdmin
          ? "Admin login failed — check NEXT_PUBLIC_ADMIN_EMAIL env var"
          : `Demo user "${user.label}" not set up yet. Run Seed All first.`);
        setSigningIn(null);
        return;
      }

      if (user.role === "job_seeker") window.location.href = "/seeker/dashboard";
      else if (user.role === "supplier") window.location.href = "/supplier-portal/dashboard";
      else if (user.role === "secretariat") window.location.href = "/secretariat/dashboard";
      else if ((user as { isRealAdmin?: boolean }).isRealAdmin) window.location.href = "/dashboard/admin";
      else window.location.href = "/dashboard";
    } catch {
      toast.error("Login failed");
      setSigningIn(null);
    }
  };

  // ── Gate screen ────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex">
        {/* Left — Password form */}
        <div className="flex-1 flex flex-col bg-[#FAF8F5] min-h-screen">
          <div className="p-6">
            <Image src="/logo-full.svg" alt="LCA Desk" width={140} height={42} priority />
          </div>
          <div className="flex-1 flex items-center justify-center px-6 pb-12">
            <div className="w-full max-w-sm">
              <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Demo Access</h1>
              <p className="text-sm text-text-muted mb-8">Internal use only — enter demo password to continue</p>
              <form onSubmit={handleMasterLogin} className="space-y-5">
                <div>
                  <label className="text-sm text-text-secondary font-medium mb-1.5 block">Password</label>
                  <Input
                    type="password"
                    placeholder="Demo password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="h-12 bg-white border-border"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold">Access Demo Panel</Button>
              </form>
            </div>
          </div>
        </div>
        {/* Right — Brand panel */}
        <div className="hidden lg:flex flex-1 bg-[var(--slate-dark)] items-center justify-center relative overflow-hidden">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-accent/5" />
          <div className="absolute bottom-32 left-16 w-40 h-40 rounded-full bg-gold/5" />
          <div className="text-center z-10 px-12">
            <Image src="/logo-white.svg" alt="LCA Desk" width={240} height={72} priority className="mx-auto mb-8 opacity-90" />
            <p className="text-white/50 text-lg font-light max-w-xs mx-auto leading-relaxed">
              Multi-jurisdiction local content compliance — built for the petroleum sector
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── User selection ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Dark slate header */}
      <div className="bg-[var(--slate-dark)] px-6 py-8 pb-12">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Image src="/logo-white.svg" alt="LCA Desk" width={140} height={42} />
            <p className="text-xs text-white/40 mt-1">Demo Panel</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAuthenticated(false)} className="gap-1.5 border-white/20 text-white/60 hover:text-white hover:bg-white/10">
            <Lock className="h-3.5 w-3.5" /> Lock
          </Button>
        </div>
        <div className="max-w-4xl mx-auto mt-6">
          <h1 className="text-2xl font-heading font-bold text-white mb-1">Select Demo User</h1>
          <p className="text-sm text-white/50">Click a user type to sign in as that persona. Each has pre-configured data.</p>
        </div>
      </div>

      {/* Cards — overlap the dark header */}
      <div className="max-w-4xl mx-auto px-6 -mt-4 pb-12">
        <div className="grid sm:grid-cols-2 gap-3">
          {DEMO_USERS.map((user) => (
            <button
              key={user.id}
              className="group text-left rounded-xl border-2 border-transparent bg-white p-4 hover:border-accent/40 hover:shadow-lg transition-all relative overflow-hidden"
              onClick={() => handleDemoLogin(user)}
            >
              {/* Accent stripe */}
              <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", user.plan === "pro" ? "bg-accent" : user.plan === "enterprise" ? "bg-gold" : "bg-border")} />

              <div className="flex items-start gap-3 pl-2">
                <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", user.bgColor)}>
                  <user.icon className={cn("h-4 w-4", user.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">{user.label}</h3>
                    {user.plan && (
                      <Badge variant={user.plan === "pro" ? "accent" : user.plan === "enterprise" ? "gold" : "default"} className="text-[11px]">
                        {user.plan}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed mt-0.5">{user.description}</p>
                  <p className="text-[11px] text-text-muted mt-1.5 font-mono tracking-tight">{user.email}</p>
                </div>
                {signingIn === user.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent shrink-0 mt-1" />
                ) : (
                  <div className="text-text-muted group-hover:text-accent transition-colors shrink-0 mt-1">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Demo tools */}
        <div className="mt-6 space-y-3">
          {/* Seed all */}
          <Card className="bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Seed All Demo Data</h3>
                <p className="text-xs text-text-muted mt-0.5">Creates all preset demo accounts. Safe to run multiple times.</p>
              </div>
              <Button variant="outline" size="sm" loading={loading} className="gap-1.5 shrink-0"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch("/api/demo/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: masterPassword }) });
                    const data = await res.json();
                    if (data.success) toast.success("Demo data seeded!"); else toast.error(data.error || "Failed");
                  } catch { toast.error("Failed"); }
                  setLoading(false);
                }}>
                <User className="h-3.5 w-3.5" /> Seed All
              </Button>
            </CardContent>
          </Card>

          {/* Quick create */}
          <QuickCreateUser masterPassword={masterPassword} />
        </div>
      </div>
    </div>
  );
}

function QuickCreateUser({ masterPassword }: { masterPassword: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("job_seeker");
  const [jurisdiction, setJurisdiction] = useState("GY");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/demo/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: masterPassword, name: name.trim(), role, jurisdiction }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Created ${name} as ${role} (${data.email})`);
        setName("");
      } else {
        toast.error(data.error || "Failed to create");
      }
    } catch { toast.error("Failed to create"); }
    setCreating(false);
  };

  return (
    <Card className="bg-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Quick Create Demo User</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} className="text-sm" />
          <Select value={role} onChange={e => setRole(e.target.value)} options={[
            { value: "job_seeker", label: "Job Seeker" },
            { value: "filer", label: "Filer (Company)" },
            { value: "supplier", label: "Supplier" },
          ]} />
          <Select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} options={[
            { value: "GY", label: "Guyana" },
            { value: "SR", label: "Suriname" },
            { value: "NG", label: "Nigeria" },
            { value: "NA", label: "Namibia" },
          ]} />
          <Button onClick={handleCreate} loading={creating} size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Create
          </Button>
        </div>
        <p className="text-xs text-text-muted mt-2">Creates a demo user with <code className="text-xs">isDemo=true</code>. Password: <code className="text-xs">demo-password-2026</code></p>
      </CardContent>
    </Card>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>}>
      <DemoContent />
    </Suspense>
  );
}
