"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Briefcase, Truck, Shield, Crown, Lock,
  User, Search, FileText, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

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
    bgColor: "bg-accent-light",
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
    bgColor: "bg-gold-light",
  },
  {
    id: "filer-trial",
    label: "Filer (30-Day Trial)",
    description: "New signup in 30-day Professional trial — sees countdown banner",
    icon: Shield,
    plan: "free",
    role: "filer",
    email: "demo-filer-trial@lcadesk.com",
    color: "text-accent",
    bgColor: "bg-accent-light",
  },
  {
    id: "filer-expired",
    label: "Filer (Expired Trial)",
    description: "Trial ended 7 days ago — redirected to upgrade page",
    icon: Lock,
    plan: "free",
    role: "filer",
    email: "demo-filer-expired@lcadesk.com",
    color: "text-danger",
    bgColor: "bg-danger-light",
  },
  {
    id: "filer-free",
    label: "Filer (Free)",
    description: "Upload-only — can submit reports but no data entry or AI",
    icon: FileText,
    plan: "free",
    role: "filer",
    email: "demo-filer-free@lcadesk.com",
    color: "text-text-muted",
    bgColor: "bg-bg-primary",
  },
  {
    id: "seeker",
    label: "Job Seeker",
    description: "Searching for petroleum jobs, resume builder, LMS courses",
    icon: Search,
    plan: null,
    role: "job_seeker",
    email: "demo-seeker@lcadesk.com",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
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
    bgColor: "bg-success-light",
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
    bgColor: "bg-gold-light",
  },
  {
    id: "admin",
    label: "Super Admin",
    description: "Platform admin — all tenants, admin panel, enterprise",
    icon: Crown,
    plan: "enterprise",
    role: "filer",
    email: "demo-admin@lcadesk.com",
    color: "text-danger",
    bgColor: "bg-danger-light",
  },
];

function DemoContent() {
  const [authenticated, setAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const router = useRouter();

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
      const result = await signIn("credentials", {
        email: user.email,
        password: "demo-password-2026",
        redirect: false,
      });

      if (result?.error) {
        toast.error(`Demo user "${user.label}" not set up yet. Create it in the admin panel.`);
        setSigningIn(null);
        return;
      }

      // Redirect based on role
      if (user.role === "job_seeker") {
        router.push("/seeker/dashboard");
      } else if (user.role === "supplier") {
        router.push("/supplier-portal/dashboard");
      } else if (user.role === "secretariat") {
        router.push("/secretariat/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch {
      toast.error("Login failed");
      setSigningIn(null);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="w-full max-w-sm p-8">
          <div className="flex justify-center mb-6">
            <Image src="/logo-full.png" alt="LCA Desk" width={160} height={48} priority />
          </div>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-heading font-bold text-text-primary text-center mb-1">Demo Access</h2>
              <p className="text-xs text-text-muted text-center mb-6">Internal use only</p>
              <form onSubmit={handleMasterLogin} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Demo password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  autoFocus
                />
                <Button type="submit" className="w-full">Access Demo Panel</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-3xl mx-auto p-6 sm:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Image src="/logo-full.png" alt="LCA Desk" width={140} height={40} />
            <p className="text-xs text-text-muted mt-1">Demo Panel</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAuthenticated(false)}>
            <Lock className="h-4 w-4 mr-1" /> Lock
          </Button>
        </div>

        <h1 className="text-xl font-heading font-bold text-text-primary mb-2">Select Demo User</h1>
        <p className="text-sm text-text-secondary mb-6">Click a user type to sign in as that persona. Each has pre-configured data.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          {DEMO_USERS.map((user) => (
            <Card
              key={user.id}
              className="hover:border-accent/30 transition-colors cursor-pointer"
              onClick={() => handleDemoLogin(user)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg ${user.bgColor} shrink-0`}>
                    <user.icon className={`h-5 w-5 ${user.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{user.label}</h3>
                      {user.plan && (
                        <Badge variant={user.plan === "pro" ? "accent" : user.plan === "enterprise" ? "danger" : "default"} className="text-[9px]">
                          {user.plan}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{user.description}</p>
                    <p className="text-[10px] text-text-muted mt-1 font-mono">{user.email}</p>
                  </div>
                  {signingIn === user.id && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 border-accent/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Setup Demo Users</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Creates all 6 demo accounts with sample filing data. Safe to run multiple times.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch("/api/demo/seed", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ secret: masterPassword }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`Demo users created! Password: ${data.password}`);
                    } else {
                      toast.error(data.error || "Setup failed");
                    }
                  } catch { toast.error("Setup failed"); }
                  setLoading(false);
                }}
              >
                <User className="h-4 w-4 mr-1" /> Create Demo Users
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>}>
      <DemoContent />
    </Suspense>
  );
}
