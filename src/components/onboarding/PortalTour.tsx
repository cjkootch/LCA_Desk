"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  extra?: React.ReactNode;
}

interface PortalTourProps {
  steps: TourStep[];
  storageKey: string;
}

export function PortalTour({ steps, storageKey }: PortalTourProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(storageKey, "true");
      setActive(false);
    }
  }, [step, steps.length, storageKey]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setActive(false);
  }, [storageKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, handleNext, handlePrev, handleSkip]);

  if (!active) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20" />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
          <div className="h-1 bg-border">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className={cn("p-3 rounded-xl", isLast ? "bg-success-light" : "bg-accent-light")}>
                <Icon className={cn("h-6 w-6", isLast ? "text-success" : "text-accent")} />
              </div>
              <button onClick={handleSkip} className="text-text-muted hover:text-text-secondary"><X className="h-5 w-5" /></button>
            </div>
            <h2 className="text-xl font-heading font-bold text-text-primary mb-3">{current.title}</h2>
            <p className="text-text-secondary leading-relaxed">{current.description}</p>
            {current.extra && <div className="mb-6">{current.extra}</div>}
            {!current.extra && <div className="mb-8" />}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-accent" : "w-1.5 bg-border")} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {!isFirst && <Button variant="ghost" size="sm" onClick={handlePrev}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>}
                {isFirst && <Button variant="ghost" size="sm" onClick={handleSkip}>Skip tour</Button>}
                <Button size="sm" onClick={handleNext}>
                  {isLast ? <><span>Get Started</span><CheckCircle className="h-4 w-4 ml-1" /></> : <><span>Next</span><ChevronRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </div>
            <p className="text-xs text-text-muted text-center mt-4">Step {step + 1} of {steps.length}</p>
          </div>
        </div>
      </div>
    </>
  );
}
