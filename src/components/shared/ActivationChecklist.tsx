"use client";

import { useEffect, useState } from "react";
import { Check, X, ChevronDown, ChevronUp, Building2, DollarSign, Users, FileText, Send } from "lucide-react";
import { fetchActivationStatus } from "@/server/actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ActivationStep {
  key: keyof ActivationStatusResult;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

interface ActivationStatusResult {
  hasEntity: boolean;
  hasExpenditure: boolean;
  hasEmployment: boolean;
  hasNarrative: boolean;
  hasSubmission: boolean;
}

const STEPS: ActivationStep[] = [
  {
    key: "hasEntity",
    label: "Create your first entity",
    description: "Register the company you're filing for",
    href: "/dashboard/entities/new",
    icon: Building2,
  },
  {
    key: "hasExpenditure",
    label: "Add expenditure data",
    description: "Enter procurement spend records",
    href: "/dashboard/entities",
    icon: DollarSign,
  },
  {
    key: "hasEmployment",
    label: "Add employment data",
    description: "Record your workforce headcount",
    href: "/dashboard/entities",
    icon: Users,
  },
  {
    key: "hasNarrative",
    label: "Generate an AI narrative",
    description: "Draft your compliance narrative with AI",
    href: "/dashboard/entities",
    icon: FileText,
  },
  {
    key: "hasSubmission",
    label: "Submit your first report",
    description: "File a completed compliance report",
    href: "/dashboard/entities",
    icon: Send,
  },
];

const DISMISS_KEY = "activation_checklist_dismissed";

export function ActivationChecklist() {
  const [status, setStatus] = useState<ActivationStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "true") {
      setDismissed(true);
      setLoading(false);
      return;
    }
    fetchActivationStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "true");
    }
    setDismissed(true);
  };

  if (loading || dismissed || !status) return null;

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  if (completedCount >= 5) return null;

  const progressPct = Math.round((completedCount / 5) * 100);

  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-accent-light/30 border-b border-border">
        <div className="flex items-center gap-2.5">
          {/* Progress ring */}
          <div className="relative h-8 w-8 shrink-0">
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
              <circle
                cx="16" cy="16" r="12" fill="none"
                stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - progressPct / 100)}`}
                strokeLinecap="round"
                className="text-accent transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-accent">
              {completedCount}/5
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary">Getting Started</p>
            <p className="text-[11px] text-text-muted">{completedCount} of 5 steps complete</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-secondary transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-secondary transition-colors"
            title="Dismiss permanently"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="p-2 space-y-0.5">
          {STEPS.map((step) => {
            const done = status[step.key];
            const Icon = step.icon;
            return (
              <Link
                key={step.key}
                href={done ? "#" : step.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  done
                    ? "opacity-60 cursor-default"
                    : "hover:bg-accent-light/40 cursor-pointer"
                )}
                onClick={done ? (e) => e.preventDefault() : undefined}
              >
                {/* Status indicator */}
                <div className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                  done
                    ? "bg-success border-success"
                    : "border-border bg-bg-primary"
                )}>
                  {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>

                {/* Icon + text */}
                <div className={cn("p-1.5 rounded-md shrink-0", done ? "bg-success/10" : "bg-bg-primary")}>
                  <Icon className={cn("h-3.5 w-3.5", done ? "text-success" : "text-text-muted")} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium leading-tight", done ? "line-through text-text-muted" : "text-text-primary")}>
                    {step.label}
                  </p>
                  {!done && (
                    <p className="text-[11px] text-text-muted leading-tight">{step.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
