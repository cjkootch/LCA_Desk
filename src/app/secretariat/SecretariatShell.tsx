"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FileText, Users, LogOut, X, Menu, Shield, ClipboardCheck, Bot, BarChart3, UserPlus, PieChart, Settings, Megaphone, Building2, Calendar, Bell, History, FolderOpen, GraduationCap, LifeBuoy,
  Mail,
} from "lucide-react";
import { SecretariatTour } from "@/components/onboarding/SecretariatTour";
import { PlatformBriefing } from "@/components/onboarding/PlatformBriefing";
import { FloatingChatWidget } from "@/components/ai/FloatingChatWidget";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { fetchSecretariatOfficeSettings } from "@/server/actions";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SessionProvider } from "next-auth/react";

/* eslint-disable @next/next/no-img-element */

interface NavSection { label?: string; items: { label: string; href: string; icon: React.ElementType }[] }

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/secretariat/dashboard", icon: FileText },
    ],
  },
  {
    label: "Compliance",
    items: [
      { label: "Filing Compliance", href: "/secretariat/compliance", icon: ClipboardCheck },
      { label: "Deadline Calendar", href: "/secretariat/calendar", icon: Calendar },
      { label: "Reports", href: "/secretariat/reports", icon: PieChart },
      { label: "LCS Applications", href: "/secretariat/applications", icon: UserPlus },
    ],
  },
  {
    label: "Directory",
    items: [
      { label: "Market Intel", href: "/secretariat/market", icon: BarChart3 },
      { label: "Talent Pool", href: "/secretariat/talent", icon: Users },
      { label: "Supplier Directory", href: "/secretariat/suppliers", icon: Building2 },
      { label: "Documents", href: "/secretariat/documents", icon: FolderOpen },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Compliance Analyst", href: "/secretariat/assistant", icon: Bot },
      { label: "Announcements", href: "/secretariat/announcements", icon: Megaphone },
      { label: "Training", href: "/secretariat/training", icon: GraduationCap },
      { label: "Courses", href: "/secretariat/courses", icon: GraduationCap },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Audit Trail", href: "/secretariat/audit", icon: History },
      { label: "Notifications", href: "/secretariat/notifications", icon: Bell },
      { label: "Team", href: "/secretariat/team", icon: Users },
      { label: "Support", href: "/secretariat/support", icon: LifeBuoy },
    { label: "Settings", href: "/secretariat/settings", icon: Settings },
    ],
  },
];

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [briefingActive, setBriefingActive] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileDevice(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Listen for start-briefing event dispatched by the dashboard welcome card
  useEffect(() => {
    const handler = () => setBriefingActive(true);
    window.addEventListener("start-briefing", handler);
    return () => window.removeEventListener("start-briefing", handler);
  }, []);

  const completeBriefing = () => {
    localStorage.setItem("secretariat-briefing-completed", "true");
    setBriefingActive(false);
    window.dispatchEvent(new CustomEvent("briefing-complete"));
    window.dispatchEvent(new CustomEvent("open-contact-card"));
  };

  // Block demo-secretariat users on mobile — this portal needs tablet+ screen
  const isDemo = profile?.email?.includes("demo-");
  if (isMobileDevice && isDemo) {
    return (
      <div className="min-h-screen bg-[#0B1B18] flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Secretariat Demo
          </h2>
          <p className="text-sm text-white/60 mb-6 leading-relaxed">
            The Secretariat dashboard is designed for tablet and desktop screens. 
            Please open this demo on a larger device for the full experience.
          </p>
          <a href="/demo/select" className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors">
            ← Back to Demo Selector
          </a>
          <p className="text-xs text-white/30 mt-4">
            Try the Contractor or Job Seeker demos — they work great on mobile.
          </p>
        </div>
      </div>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [office, setOffice] = useState<any>(null);

  useEffect(() => {
    fetchSecretariatOfficeSettings().then(setOffice).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary" style={{ paddingTop: "var(--demo-banner-h, 0px)" }}>
      {/* Sidebar */}
      <aside
        className="fixed z-40 w-60 bg-[#1e293b] flex flex-col transition-all duration-200 lg:left-0"
        style={{ top: "var(--demo-banner-h, 0px)", height: "calc(100vh - var(--demo-banner-h, 0px))", left: sidebarOpen ? 0 : undefined }}
        data-open={sidebarOpen}
      >
        <style>{`aside[data-open="false"] { left: -15rem; } @media (min-width: 1024px) { aside[data-open] { left: 0 !important; } }`}</style>

        <div className="flex items-center justify-between h-16 px-5 border-b border-white/10">
          <Link href="/secretariat/dashboard" onClick={() => setSidebarOpen(false)}>
            <Image src="/logo-white.svg" alt="LCA Desk" width={140} height={40} priority />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            {office?.logoUrl ? (
              <img src={office.logoUrl} alt="" className="h-6 w-6 rounded object-contain bg-white/10 p-0.5" />
            ) : (
              <Shield className="h-3.5 w-3.5 text-gold" />
            )}
            <span className="text-sm font-medium uppercase tracking-wider text-white/50">{office?.name || "Secretariat Portal"}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-white/30">{section.label}</p>}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                      className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                      )}>
                      <item.icon className="h-4 w-4" />{item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <Link href="/secretariat/settings" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                {profile?.id ? (
                  <img src={`/api/avatar?id=${profile.id}`} alt="" className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.textContent = profile?.full_name?.charAt(0) || "S"; }} />
                ) : (profile?.full_name?.charAt(0) || "S")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile?.full_name || "User"}</p>
                <p className="text-xs text-white/50 truncate">{profile?.email || ""}</p>
              </div>
            </Link>
            <button onClick={signOut} className="text-white/50 hover:text-red-300 transition-colors shrink-0">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden sticky z-30 flex items-center justify-between h-14 px-4 border-b border-border bg-bg-surface/95 backdrop-blur-sm" style={{ top: "var(--demo-banner-h, 0px)" }}>
        <div className="flex items-center">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 text-sm font-heading font-semibold text-text-primary">Secretariat</span>
        </div>
        <NotificationBell />
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="lg:ml-60 min-h-screen relative">
        <div className="hidden lg:flex fixed top-3 right-4 z-20">
          <NotificationBell />
        </div>
        {children}
      </main>
      {briefingActive && <PlatformBriefing onComplete={completeBriefing} />}
      <SecretariatTour />
      <FloatingChatWidget
        endpoint="/api/ai/secretariat-chat"
        title="Compliance Analyst"
        subtitle="Regulatory AI with sector-wide data"
        accentColor="bg-[#1e293b]"
        icon={Shield}
        quickQuestions={[
          "Which companies are below employment minimums?",
          "Summarize this period's sector compliance posture",
          "What enforcement actions are available for late filers?",
          "Draft amendment request language for incomplete employment data",
          "How many submissions are pending review?",
        ]}
      />
      {/* Floating contact card — demo users only */}
      {isDemo && <DemoContactFloat />}
    </div>
  );
}

function DemoContactFloat() {
  const [open, setOpen] = useState(true); // Start expanded for demo users

  // Listen for briefing events to control the card
  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("open-contact-card", openHandler);
    return () => window.removeEventListener("open-contact-card", openHandler);
  }, []);
  return (
    <div className="fixed bottom-6 right-24 z-[90]" data-briefing="contact-card">
      {open && (
        <div className="mb-3 w-[280px] rounded-2xl border border-border bg-bg-card shadow-2xl p-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center gap-3 mb-3">
            <img src="/founder.png" alt="Cole Kutschinski" className="h-10 w-10 rounded-full object-cover" />
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
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-full bg-accent text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        title="Contact Cole"
      >
        {open ? <X className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function SecretariatShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
