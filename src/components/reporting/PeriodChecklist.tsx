"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILING_STEPS } from "@/types/reporting.types";

interface PeriodChecklistProps {
  entityId: string;
  periodId: string;
  currentStep: string;
  completedSteps: string[];
}

export function PeriodChecklist({
  entityId,
  periodId,
  currentStep,
  completedSteps,
}: PeriodChecklistProps) {
  const basePath = `/dashboard/entities/${entityId}/periods/${periodId}`;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-4 border-b border-border mb-8">
      {FILING_STEPS.map((step, i) => {
        const isCompleted = completedSteps.includes(step.key);
        const isCurrent = currentStep === step.key;

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && <div className="w-8 h-px bg-border mx-1" />}
            <Link
              href={`${basePath}${step.path}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                isCurrent && "bg-accent/10 text-accent",
                isCompleted && !isCurrent && "text-success",
                !isCurrent && !isCompleted && "text-text-muted hover:text-text-secondary"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-xs border",
                  isCurrent && "border-accent bg-accent text-bg-primary",
                  isCompleted && !isCurrent && "border-success bg-success text-bg-primary",
                  !isCurrent && !isCompleted && "border-border"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : step.number}
              </span>
              {step.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
