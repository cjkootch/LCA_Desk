"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { fetchSupplierResponses } from "@/server/actions";
import { toast } from "sonner";

type Response = Awaited<ReturnType<typeof fetchSupplierResponses>>[number];

const STATUS_VARIANT: Record<string, "default" | "accent" | "warning" | "success" | "danger" | "gold"> = {
  interested: "accent", contacted: "warning", shortlisted: "gold", awarded: "success", not_selected: "default",
};

export default function SupplierResponsesPage() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [proRequired, setProRequired] = useState(false);

  useEffect(() => {
    fetchSupplierResponses()
      .then(setResponses)
      .catch(err => {
        if (err instanceof Error && err.message.includes("Pro plan")) setProRequired(true);
        else toast.error(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  if (proRequired) return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="h-12 w-12 text-text-muted mb-4" />
        <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Bid Tracker — Pro Feature</h2>
        <p className="text-sm text-text-secondary max-w-md mb-6">
          Track every response you submit, see when contractors view your profile, and monitor your pipeline from interested to awarded.
        </p>
        <Link href="/supplier-portal/settings">
          <Button><Sparkles className="h-4 w-4 mr-1" /> Upgrade to Pro — $99/mo</Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">My Responses</h1>
      <p className="text-sm text-text-secondary mb-6">Track your opportunity responses and bid pipeline</p>

      {responses.length === 0 ? (
        <EmptyState icon={FileText} title="No responses yet" description="Express interest in opportunities to start tracking your pipeline." />
      ) : (
        <div className="space-y-3">
          {responses.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-medium text-text-primary">{r.opportunity?.title || "Unknown"}</p>
                  <p className="text-xs text-text-muted">{r.opportunity?.company} · {r.opportunity?.type}</p>
                  {r.coverNote && <p className="text-xs text-text-secondary mt-1 italic truncate">{r.coverNote}</p>}
                  <p className="text-xs text-text-muted mt-1">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                </div>
                <Badge variant={STATUS_VARIANT[r.status || "interested"]} className="shrink-0">{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
