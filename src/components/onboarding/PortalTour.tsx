"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, CheckCircle, GripHorizontal } from "lucide-react";
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    setDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      origX: pos?.x ?? rect.left,
      origY: pos?.y ?? rect.top,
    };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging]);

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) setStep(step + 1);
    else { localStorage.setItem(storageKey, "true"); setActive(false); }
  }, [step, steps.length, storageKey]);

  const handlePrev = useCallback(() => { if (step > 0) setStep(step - 1); }, [step]);

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

  const cardStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, transform: "none" }
    : {};

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/15 pointer-events-none" />
      <div className={cn("fixed z-[101]", pos ? "" : "inset-0 flex items-center justify-center p-4")} style={pos ? { left: 0, top: 0, width: "100vw", height: "100vh", pointerEvents: "none" } : undefined}>
        <div ref={cardRef}
          className="bg-bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden pointer-events-auto"
          style={cardStyle}>
          {/* Drag handle */}
          <div
            className={cn("flex items-center justify-center gap-1 py-1.5 cursor-grab active:cursor-grabbing select-none", dragging ? "bg-accent/5" : "hover:bg-bg-primary")}
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <GripHorizontal className="h-4 w-4 text-text-muted/40" />
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-border -mt-px">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <div className={cn("p-3 rounded-xl", isLast ? "bg-success-light" : "bg-accent-light")}>
                <Icon className={cn("h-6 w-6", isLast ? "text-success" : "text-accent")} />
              </div>
              <button onClick={handleSkip} className="text-text-muted hover:text-text-secondary"><X className="h-5 w-5" /></button>
            </div>
            <h2 className="text-xl font-heading font-bold text-text-primary mb-3">{current.title}</h2>
            <p className="text-text-secondary leading-relaxed">{current.description}</p>
            {current.extra && <div className="mb-5">{current.extra}</div>}
            {!current.extra && <div className="mb-7" />}
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
            <p className="text-xs text-text-muted text-center mt-4">Step {step + 1} of {steps.length} · Drag to reposition</p>
          </div>
        </div>
      </div>
    </>
  );
}
