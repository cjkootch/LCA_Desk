"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, Building2, FileText, Calendar, MessageSquare, Settings, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  target?: string; // CSS selector to highlight
  position?: "center" | "top-right" | "bottom-left";
  navigateTo?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to LCA Desk",
    description: "LCA Desk is your AI-powered compliance platform for Guyana's Local Content Act. Let's take a quick tour of the key features.",
    icon: Sparkles,
    position: "center",
  },
  {
    title: "Your Dashboard",
    description: "This is your compliance command center. See all your entities, upcoming deadlines, and compliance status at a glance. The stats bar shows your portfolio summary.",
    icon: Building2,
    position: "center",
    navigateTo: "/dashboard",
  },
  {
    title: "Manage Entities",
    description: "Each company you manage is an \"entity\". Add your companies here with their LCS Certificate IDs, registration numbers, and contact details. You can manage multiple entities from one account.",
    icon: Building2,
    position: "center",
    navigateTo: "/dashboard/entities",
  },
  {
    title: "Start a New Report",
    description: "Click \"Start New Report\" on any entity to begin a filing. Select the report type (H1, H2, Annual Plan) and year — dates auto-fill from the official Secretariat schedule. No manual date entry needed.",
    icon: FileText,
    position: "center",
  },
  {
    title: "The Filing Workflow",
    description: "Each report follows a 7-step workflow: Company Info → Expenditure → Employment → Capacity Development → AI Narrative → Review → Export. Progress is tracked at every step.",
    icon: FileText,
    position: "center",
  },
  {
    title: "AI Narrative Drafting",
    description: "The most powerful feature. After entering your data, the AI drafts your Comparative Analysis Report — the written narrative the Secretariat requires. It uses correct LCA terminology and formal language. You can edit and regenerate.",
    icon: Sparkles,
    position: "center",
  },
  {
    title: "Ask the LCA Expert",
    description: "Have a compliance question? The LCA Expert is an AI assistant trained on the complete Local Content Act, all Secretariat guidelines, and Version 4.1. Get answers with specific section citations.",
    icon: MessageSquare,
    position: "center",
    navigateTo: "/dashboard/expert",
  },
  {
    title: "Compliance Calendar",
    description: "Never miss a deadline. The calendar shows all filing due dates color-coded by urgency: red for overdue, amber for due soon, green for on track. Click any date to see details.",
    icon: Calendar,
    position: "center",
    navigateTo: "/dashboard/calendar",
  },
  {
    title: "Settings & Team",
    description: "Manage your profile, company details, and team members. Invite colleagues and assign roles (admin, member, viewer) to control who can view and edit filings.",
    icon: Settings,
    position: "center",
    navigateTo: "/dashboard/settings",
  },
  {
    title: "You're All Set!",
    description: "Start by adding your first entity, then create a reporting period to begin filing. If you need help, the LCA Expert is always available in the sidebar. Welcome aboard!",
    icon: CheckCircle,
    position: "center",
    navigateTo: "/dashboard",
  },
];

const STORAGE_KEY = "lca-desk-tour-completed";

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if tour was already completed
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Show tour after a brief delay so the page loads first
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      const nextStep = TOUR_STEPS[step + 1];
      if (nextStep.navigateTo) {
        router.push(nextStep.navigateTo);
      }
      setStep(step + 1);
    } else {
      // Tour complete
      localStorage.setItem(STORAGE_KEY, "true");
      setActive(false);
    }
  }, [step, router]);

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
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    router.push("/dashboard");
  }, [router]);

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
      <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />

      {/* Tour card */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-border">
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
            <p className="text-text-secondary leading-relaxed mb-8">
              {currentStep.description}
            </p>

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
              Step {step + 1} of {TOUR_STEPS.length} · Press arrow keys to navigate
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
