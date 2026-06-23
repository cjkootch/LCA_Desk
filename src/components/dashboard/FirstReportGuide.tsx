"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Lock, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { addPeriod } from "@/server/actions";
import { calculateDeadlines } from "@/lib/compliance/deadlines";
import { toast } from "sonner";

type Progress = {
  hasEntity: boolean;
  hasEverSubmitted: boolean;
  primaryEntityId: string | null;
  primaryEntityName: string | null;
  primaryEntityJurisdictionId: string | null;
  activePeriodId: string | null;
  activePeriodEntityId: string | null;
  expCount: number;
  empCount: number;
  capCount: number;
};

export function FirstReportGuide({ progress, jurisdictionCode }: { progress: Progress; jurisdictionCode: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const { primaryEntityId, primaryEntityName, primaryEntityJurisdictionId, activePeriodId, activePeriodEntityId, expCount, empCount } = progress;

  // Step state
  const step1Done = !!activePeriodId;
  const step2Done = expCount > 0 && empCount > 0;
  const periodHref = activePeriodId && activePeriodEntityId
    ? `/dashboard/entities/${activePeriodEntityId}/periods/${activePeriodId}`
    : null;

  const currentStep = !step1Done ? 1 : !step2Done ? 2 : 3;

  // One-click: create the most recent started half-yearly period, then go to data entry
  const handleStart = async () => {
    if (!primaryEntityId || !primaryEntityJurisdictionId) {
      toast.error("Add an entity first");
      return;
    }
    setStarting(true);
    try {
      const year = new Date().getFullYear();
      const today = new Date();
      const candidates = [
        ...calculateDeadlines(jurisdictionCode, year - 1),
        ...calculateDeadlines(jurisdictionCode, year),
      ]
        .filter(d => d.type.startsWith("half_yearly") && d.period_start <= today)
        .sort((a, b) => b.period_start.getTime() - a.period_start.getTime());
      const target = candidates[0] || calculateDeadlines(jurisdictionCode, year).find(d => d.type.startsWith("half_yearly"));

      if (!target) {
        // Fallback — send them to the entity page to start manually
        router.push(`/dashboard/entities/${primaryEntityId}`);
        return;
      }

      const period = await addPeriod({
        entity_id: primaryEntityId,
        jurisdiction_id: primaryEntityJurisdictionId,
        report_type: target.type,
        period_start: target.period_start.toISOString().slice(0, 10),
        period_end: target.period_end.toISOString().slice(0, 10),
        due_date: target.due_date.toISOString().slice(0, 10),
        fiscal_year: target.period_start.getFullYear(),
      });

      router.push(`/dashboard/entities/${primaryEntityId}/periods/${period.id}/expenditure`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the report");
      setStarting(false);
    }
  };

  const steps = [
    {
      n: 1,
      title: "Start your report",
      desc: "We'll create your current Half-Yearly reporting period.",
      done: step1Done,
      active: currentStep === 1,
    },
    {
      n: 2,
      title: "Enter your data",
      desc: "Add expenditure, employment, and capacity records.",
      done: step2Done,
      active: currentStep === 2,
    },
    {
      n: 3,
      title: "Generate & submit",
      desc: "AI drafts your narrative, then review and file to the Secretariat.",
      done: false,
      active: currentStep === 3,
    },
  ];

  return (
    <Card className="mb-6 border-2 border-accent/30 bg-gradient-to-br from-accent/5 via-transparent to-gold/5 overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Rocket className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-heading font-bold text-text-primary">File Your First Local Content Report</h2>
            <p className="text-xs text-text-secondary">
              {primaryEntityName ? <>For <span className="font-medium">{primaryEntityName}</span> · </> : null}
              Most filers finish in under an hour with AI assistance.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {steps.map((s) => {
            const locked = !s.done && !s.active;
            return (
              <div
                key={s.n}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  s.done ? "border-success/30 bg-success/5" :
                  s.active ? "border-accent bg-accent-light" :
                  "border-border bg-bg-surface opacity-70"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                  s.done ? "bg-success text-white" :
                  s.active ? "bg-accent text-white" :
                  "bg-bg-primary text-text-muted border border-border"
                )}>
                  {s.done ? <CheckCircle className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : s.n}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold", s.done ? "text-success" : "text-text-primary")}>{s.title}</p>
                  <p className="text-xs text-text-muted">{s.desc}</p>
                </div>

                {/* Per-step CTA only on the active step */}
                {s.active && s.n === 1 && (
                  <Button size="sm" onClick={handleStart} loading={starting} className="gap-1.5 shrink-0">
                    Start <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                {s.active && s.n === 2 && periodHref && (
                  <Button size="sm" onClick={() => router.push(`${periodHref}/expenditure`)} className="gap-1.5 shrink-0">
                    Add Data <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                {s.active && s.n === 3 && periodHref && (
                  <Button size="sm" onClick={() => router.push(`${periodHref}/review`)} className="gap-1.5 shrink-0">
                    Review & File <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                {s.done && (
                  <span className="text-xs text-success font-medium shrink-0 hidden sm:inline">Done</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
