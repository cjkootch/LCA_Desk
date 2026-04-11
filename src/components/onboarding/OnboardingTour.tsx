"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, Building2, FileText, Calendar, MessageSquare, Settings, CheckCircle, GripHorizontal, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { markOnboardingComplete } from "@/server/actions";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  extra?: React.ReactNode;
  navigateTo?: string;
}

const WORKFLOW_STEPS = [
  { num: 1, label: "Company Info", color: "bg-accent" },
  { num: 2, label: "Expenditure", color: "bg-accent" },
  { num: 3, label: "Employment", color: "bg-accent" },
  { num: 4, label: "Capacity Dev", color: "bg-accent" },
  { num: 5, label: "AI Narrative", color: "bg-gold" },
  { num: 6, label: "Review", color: "bg-warning" },
  { num: 7, label: "Export", color: "bg-success" },
];

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to LCA Desk",
    description: "Your AI-powered compliance platform for Guyana's Local Content Act. Let's take a 2-minute tour.",
    icon: Sparkles,
  },
  {
    title: "Your Dashboard",
    description: "Your compliance command center — entities, deadlines, and status at a glance.",
    icon: Building2,
    navigateTo: "/dashboard",
    extra: (
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { label: "Entities", desc: "Companies you manage" },
          { label: "Deadlines", desc: "Upcoming due dates" },
          { label: "LC Rate", desc: "Local content %" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-bg-primary p-2.5 text-center">
            <p className="text-xs font-semibold text-accent">{item.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Manage Entities",
    description: "Each company is an \"entity\" with its LCS Certificate, registration, and contact details. Manage multiple companies from one account.",
    icon: Building2,
    navigateTo: "/dashboard/entities",
  },
  {
    title: "Start a New Report",
    description: "Select the report type and year — dates auto-fill from the official Secretariat schedule. No manual entry needed.",
    icon: FileText,
    extra: (
      <div className="mt-4 rounded-lg border border-border p-3 bg-bg-primary">
        <div className="space-y-1.5 text-xs">
          {["H1 Half-Yearly (Jan–Jun)", "H2 Half-Yearly (Jul–Dec)", "Annual Plan", "Performance Report"].map((r) => (
            <div key={r} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-text-secondary">{r}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "The Filing Workflow",
    description: "Each report follows 7 guided steps. Progress is tracked and validated before export.",
    icon: FileText,
    extra: (
      <div className="mt-4 flex gap-1">
        {WORKFLOW_STEPS.map((s) => (
          <div key={s.num} className="flex-1 text-center">
            <div className={cn("mx-auto h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold", s.color)}>
              {s.num}
            </div>
            <p className="text-xs text-text-muted mt-1 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "AI Narrative Drafting",
    description: "After entering data, AI drafts your Comparative Analysis Report using correct LCA terminology. Edit, regenerate, or write your own.",
    icon: Sparkles,
    extra: (
      <div className="mt-4 rounded-lg border border-accent/20 bg-accent-light p-3">
        <p className="text-xs text-accent font-medium mb-1">AI-Generated Draft</p>
        <p className="text-sm text-text-secondary italic leading-relaxed">
          &quot;During the reporting period, first consideration was accorded to Guyanese suppliers across all reserved sector categories...&quot;
        </p>
      </div>
    ),
  },
  {
    title: "Ask the LCA Expert",
    description: "AI assistant trained on the complete Local Content Act and Version 4.1 guidelines. Get cited answers instantly.",
    icon: MessageSquare,
    navigateTo: "/dashboard/expert",
    extra: (
      <div className="mt-4 space-y-2">
        <div className="rounded-lg bg-accent text-white px-3 py-2 text-xs ml-auto max-w-[80%]">
          What are the penalties for late filing?
        </div>
        <div className="rounded-lg bg-bg-primary border border-border px-3 py-2 text-xs max-w-[90%]">
          GY$1M–GY$50M fines under Section 23 of the Act...
        </div>
      </div>
    ),
  },
  {
    title: "Compliance Calendar",
    description: "Monthly view with color-coded deadlines. Click any date for details. Never miss a filing.",
    icon: Calendar,
    navigateTo: "/dashboard/calendar",
    extra: (
      <div className="mt-4 flex items-center gap-4 justify-center">
        {[
          { color: "bg-danger", label: "Overdue" },
          { color: "bg-warning", label: "Due Soon" },
          { color: "bg-accent", label: "On Track" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <div className={cn("h-2.5 w-2.5 rounded-full", s.color)} />
            {s.label}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Settings & Team",
    description: "Edit your profile, manage team members with role-based access, and configure notifications.",
    icon: Settings,
    navigateTo: "/dashboard/settings",
  },
  {
    title: "Refer & Earn",
    description: "Know other companies with a filing obligation? Refer them and earn a commission for every paying customer you bring in.",
    icon: Gift,
    extra: (
      <div className="mt-4 rounded-lg border border-accent/20 bg-accent-light p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-accent shrink-0" />
          <p className="text-sm font-medium text-text-primary">Your referral link is ready</p>
        </div>
        <p className="text-xs text-text-secondary">Find it in <strong>Dashboard → Referrals</strong>. Share it with any company that files Local Content reports.</p>
        <p className="text-xs text-text-muted">You earn a commission for every customer who signs up and pays through your link.</p>
      </div>
    ),
  },
  {
    title: "You're All Set!",
    description: "Start by adding your first entity — it only takes 2 minutes. The LCA Expert is always in the sidebar if you need help.",
    icon: CheckCircle,
    navigateTo: "/dashboard/entities/new",
    extra: (
      <div className="mt-4">
        <div className="rounded-lg bg-accent p-4 text-center cursor-pointer hover:bg-accent-hover transition-colors">
          <Building2 className="h-6 w-6 text-white mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">Add Your First Entity</p>
          <p className="text-xs text-white/80 mt-0.5">Register the company you&apos;re filing for</p>
        </div>
      </div>
    ),
  },
];

const STORAGE_KEY = "lca-desk-tour-completed";

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    setDragging(true);
    dragRef.current = { startX: clientX, startY: clientY, origX: pos?.x ?? rect.left, origY: pos?.y ?? rect.top };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setPos({ x: dragRef.current.origX + (clientX - dragRef.current.startX), y: dragRef.current.origY + (clientY - dragRef.current.startY) });
    };
    const onUp = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
  }, [dragging]);

  useEffect(() => {
    // Check localStorage first for immediate suppression
    const completed = localStorage.getItem(STORAGE_KEY);
    if (completed) return;
    // Show tour after a brief delay so the page loads first
    const timer = setTimeout(() => setActive(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    markOnboardingComplete().catch(() => {});
  }, []);

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      const nextStep = TOUR_STEPS[step + 1];
      if (nextStep.navigateTo) {
        router.push(nextStep.navigateTo);
      }
      setStep(step + 1);
    } else {
      // Tour complete — navigate to entity creation
      completeOnboarding();
      router.push("/dashboard/entities/new");
    }
  }, [step, router, completeOnboarding]);

  const handlePrev = useCallback(() => {
    if (step > 0) {
      const prevStep = TOUR_STEPS[step - 1];
      if (prevStep.navigateTo) {
        router.push(prevStep.navigateTo);
      }
      setStep(step - 1);
    }
  }, [step, router]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    router.push("/dashboard");
  }, [router, completeOnboarding]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") handleSkip();
    },
    [active, handleNext, handlePrev, handleSkip]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!active || dismissed) return null;

  const currentStep = TOUR_STEPS[step];
  const Icon = currentStep.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/15 pointer-events-none" />

      {/* Tour card */}
      <div className={cn("fixed z-[101]", pos ? "" : "inset-0 flex items-center justify-center p-4")}
        style={pos ? { left: 0, top: 0, width: "100vw", height: "100vh", pointerEvents: "none" } : undefined}>
        <div ref={cardRef} className="bg-bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden pointer-events-auto"
          style={pos ? { position: "fixed", left: pos.x, top: pos.y, transform: "none" } : undefined}>
          {/* Drag handle */}
          <div className={cn("flex items-center justify-center gap-1 py-1.5 cursor-grab active:cursor-grabbing select-none", dragging ? "bg-accent/5" : "hover:bg-bg-primary")}
            onMouseDown={onDragStart} onTouchStart={onDragStart}>
            <GripHorizontal className="h-4 w-4 text-text-muted/40" />
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-border -mt-px">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-8">
            {/* Icon */}
            <div className="flex items-center justify-between mb-6">
              <div className={cn(
                "p-3 rounded-xl",
                isLast ? "bg-success-light" : "bg-accent-light"
              )}>
                <Icon className={cn("h-6 w-6", isLast ? "text-success" : "text-accent")} />
              </div>
              <button
                onClick={handleSkip}
                className="text-text-muted hover:text-text-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <h2 className="text-xl font-heading font-bold text-text-primary mb-3">
              {currentStep.title}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {currentStep.description}
            </p>
            {currentStep.extra && <div className="mb-6">{currentStep.extra}</div>}
            {!currentStep.extra && <div className="mb-8" />}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step ? "w-6 bg-accent" : "w-1.5 bg-border"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <Button variant="ghost" size="sm" onClick={handlePrev}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                {isFirst && (
                  <Button variant="ghost" size="sm" onClick={handleSkip}>
                    Skip tour
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {isLast ? (
                    <>
                      Get Started
                      <CheckCircle className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Step counter */}
            <p className="text-xs text-text-muted text-center mt-4">
              Step {step + 1} of {TOUR_STEPS.length} · Drag to reposition
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Button to restart the tour from settings
export function RestartTourButton() {
  const handleRestart = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/dashboard";
  };

  return (
    <Button variant="outline" size="sm" onClick={handleRestart}>
      <Sparkles className="h-4 w-4 mr-1" />
      Restart Product Tour
    </Button>
  );
}
