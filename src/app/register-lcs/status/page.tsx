"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import Image from "next/image";
import Link from "next/link";
import { Shield, FileText, CheckCircle, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { fetchMyCertApplications } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "accent" | "warning" | "success" | "danger"; icon: typeof Clock }> = {
  draft: { label: "Draft", variant: "default", icon: FileText },
  documents_pending: { label: "Documents Needed", variant: "warning", icon: AlertTriangle },
  under_review: { label: "Under Review", variant: "accent", icon: Clock },
  submitted_to_lcs: { label: "Submitted to LCS", variant: "accent", icon: Shield },
  approved: { label: "Approved", variant: "success", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "danger", icon: AlertTriangle },
};

export default function ApplicationStatusPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyCertApplications()
      .then(setApps)
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdf4] to-white">
      <div className="border-b border-border bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><Image src="/logo-full.png" alt="LCA Desk" width={120} height={35} /></Link>
          <Link href="/register-lcs"><Button size="sm">New Application</Button></Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Application Status</h1>
        <p className="text-sm text-text-secondary mb-6">Track the progress of your LCS registration applications</p>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
        ) : apps.length === 0 ? (
          <EmptyState icon={Shield} title="No applications" description="Start your LCS registration to see your application status here."
            actionLabel="Start Application" onAction={() => window.location.href = "/register-lcs"} />
        ) : (
          <div className="space-y-4">
            {apps.map(app => {
              const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft;
              const StatusIcon = cfg.icon;
              const steps = ["draft", "documents_pending", "under_review", "submitted_to_lcs", "approved"];
              const currentIdx = steps.indexOf(app.status);

              return (
                <Card key={app.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">
                          {app.applicationType === "business" ? (app.legalName || "Business Application") : (app.applicantName || "Individual Application")}
                        </h3>
                        <p className="text-xs text-text-muted capitalize mt-0.5">
                          {app.applicationType} · {app.tier.replace(/_/g, " ")} · Started {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <Badge variant={cfg.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-0.5 mb-3">
                      {steps.map((s, i) => (
                        <div key={s} className={cn("flex-1 h-1.5 rounded-full", i <= currentIdx ? "bg-accent" : "bg-border")} />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-text-muted">
                      <span>Submitted</span><span>Review</span><span>Sent to LCS</span><span>Approved</span>
                    </div>

                    {app.lcsCertId && (
                      <div className="mt-4 bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-success shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-success">Approved</p>
                          <p className="text-xs text-text-secondary">Your LCS Certificate ID: <span className="font-mono font-bold">{app.lcsCertId}</span></p>
                        </div>
                      </div>
                    )}

                    {app.reviewNotes && (
                      <div className="mt-3 bg-warning-light border border-warning/20 rounded-lg p-3">
                        <p className="text-xs text-text-secondary"><span className="font-medium">Reviewer note:</span> {app.reviewNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
