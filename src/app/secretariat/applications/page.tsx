"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Shield, CheckCircle, Clock, AlertTriangle, FileText,
  Send, XCircle, Eye,
} from "lucide-react";
import { fetchCertApplicationQueue, reviewCertApplication, fetchCertApplication } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AppSummary = Awaited<ReturnType<typeof fetchCertApplicationQueue>>[number];

const STATUS_VARIANT: Record<string, "default" | "accent" | "warning" | "success" | "danger"> = {
  documents_pending: "warning",
  under_review: "accent",
  submitted_to_lcs: "accent",
  approved: "success",
  rejected: "danger",
};

const TIER_LABELS: Record<string, string> = {
  self_service: "Self-Service ($49)",
  managed: "Managed ($99)",
  concierge: "Concierge ($199)",
};

export default function SecretariatApplicationsPage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [lcsCertId, setLcsCertId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCertApplicationQueue()
      .then(setApps)
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (id: string) => {
    try {
      const app = await fetchCertApplication(id);
      setDetail(app);
      setReviewNotes("");
      setLcsCertId("");
    } catch { toast.error("Failed to load application"); }
  };

  const handleReview = async (status: "submitted_to_lcs" | "approved" | "rejected") => {
    if (!detail) return;
    if (status === "approved" && !lcsCertId.trim()) {
      toast.error("Enter the LCS Certificate ID before approving");
      return;
    }
    setSubmitting(true);
    try {
      await reviewCertApplication(detail.id, { status, reviewNotes: reviewNotes || undefined, lcsCertId: lcsCertId || undefined });
      toast.success(status === "approved" ? "Application approved — cert added to profile" : `Status updated to ${status.replace(/_/g, " ")}`);
      setDetail(null);
      const fresh = await fetchCertApplicationQueue();
      setApps(fresh);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update"); }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;

  const pending = apps.filter(a => a.status === "under_review" || a.status === "documents_pending");
  const processed = apps.filter(a => a.status !== "under_review" && a.status !== "documents_pending");

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">LCS Applications</h1>
          <p className="text-sm text-text-secondary">Review and process LCS certificate registration applications</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card className="p-3 text-center"><p className="text-xl font-bold">{apps.length}</p><p className="text-xs text-text-muted">Total</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-bold text-warning">{pending.length}</p><p className="text-xs text-text-muted">Pending Review</p></Card>
        <Card className="p-3 text-center"><p className="text-xl font-bold text-success">{apps.filter(a => a.status === "approved").length}</p><p className="text-xs text-text-muted">Approved</p></Card>
        <Card className="p-3 text-center">
          <p className="text-xl font-bold text-accent">${apps.reduce((s, a) => s + ((a.amountPaid || 0) / 100), 0).toLocaleString()}</p>
          <p className="text-xs text-text-muted">Revenue</p>
        </Card>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Pending Review ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map(app => (
              <Card key={app.id} className="border-warning/20 cursor-pointer hover:border-warning/40 transition-colors" onClick={() => openDetail(app.id)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{app.applicationType === "business" ? app.legalName : app.applicantName}</p>
                    <p className="text-xs text-text-muted capitalize">{app.applicationType} · {TIER_LABELS[app.tier] || app.tier} · {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[app.status] || "default"}>{app.status.replace(/_/g, " ")}</Badge>
                    <Eye className="h-4 w-4 text-text-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Processed ({processed.length})</h2>
          <div className="space-y-2">
            {processed.map(app => (
              <Card key={app.id} className="cursor-pointer hover:border-accent/20 transition-colors" onClick={() => openDetail(app.id)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{app.applicationType === "business" ? app.legalName : app.applicantName}</p>
                    <p className="text-xs text-text-muted capitalize">{app.applicationType} · {TIER_LABELS[app.tier] || app.tier}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[app.status] || "default"}>{app.status.replace(/_/g, " ")}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {apps.length === 0 && <EmptyState icon={FileText} title="No applications yet" description="Applications submitted through the LCS registration service will appear here." />}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gold" />
                  {detail.applicationType === "business" ? detail.legalName : detail.applicantName}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 mt-2 text-xs">
                <div className="bg-bg-primary rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between"><span className="text-text-muted">Type</span><span className="capitalize font-medium">{detail.applicationType}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Tier</span><span className="font-medium">{TIER_LABELS[detail.tier]}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Name</span><span>{detail.applicantName}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Email</span><span>{detail.applicantEmail}</span></div>
                  {detail.applicantPhone && <div className="flex justify-between"><span className="text-text-muted">Phone</span><span>{detail.applicantPhone}</span></div>}
                  {detail.nationalIdNumber && <div className="flex justify-between"><span className="text-text-muted">National ID</span><span className="font-mono">{detail.nationalIdNumber}</span></div>}
                  {detail.tinNumber && <div className="flex justify-between"><span className="text-text-muted">TIN</span><span className="font-mono">{detail.tinNumber}</span></div>}
                </div>

                {detail.applicationType === "business" && (
                  <div className="bg-bg-primary rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-text-muted uppercase">Business Details</p>
                    {detail.businessRegistrationNumber && <div className="flex justify-between"><span className="text-text-muted">Reg #</span><span className="font-mono">{detail.businessRegistrationNumber}</span></div>}
                    {detail.businessAddress && <div className="flex justify-between"><span className="text-text-muted">Address</span><span>{detail.businessAddress}</span></div>}
                    {detail.businessEmail && <div className="flex justify-between"><span className="text-text-muted">Email</span><span>{detail.businessEmail}</span></div>}
                    {detail.ownershipPercentage && <div className="flex justify-between"><span className="text-text-muted">GY Ownership</span><span>{detail.ownershipPercentage}%</span></div>}
                    {detail.serviceCategories?.length > 0 && (
                      <div>
                        <span className="text-text-muted">Categories:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {detail.serviceCategories.map((c: string) => <Badge key={c} variant="default" className="text-xs">{c}</Badge>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Documents */}
                {detail.documents && (
                  <div className="bg-bg-primary rounded-lg p-3">
                    <p className="text-xs font-semibold text-text-muted uppercase mb-2">Documents</p>
                    {Object.entries(JSON.parse(detail.documents)).map(([key, val]: [string, unknown]) => {
                      const doc = val as { name: string; key: string };
                      return (
                        <div key={key} className="flex items-center justify-between py-1">
                          <span className="text-text-secondary">{key.replace(/_/g, " ")}</span>
                          <a href={`/api/submission/download?key=${encodeURIComponent(doc.key)}&name=${encodeURIComponent(doc.name)}`}
                            className="text-accent hover:text-accent-hover font-medium">{doc.name}</a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Review actions */}
                {(detail.status === "under_review" || detail.status === "documents_pending" || detail.status === "submitted_to_lcs") && (
                  <div className="border-t border-border pt-3 space-y-3">
                    <p className="text-sm font-semibold text-text-primary">Review Actions</p>

                    <textarea className="w-full h-16 px-3 py-2 rounded-lg bg-bg-primary border border-border text-xs focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                      value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Review notes (sent to applicant if needed)..." />

                    {detail.status !== "submitted_to_lcs" && (
                      <Button variant="outline" className="w-full gap-1.5" onClick={() => handleReview("submitted_to_lcs")} loading={submitting}>
                        <Send className="h-3 w-3" /> Mark as Submitted to LCS
                      </Button>
                    )}

                    <div>
                      <label className="text-xs text-text-muted font-medium">LCS Certificate ID (required to approve)</label>
                      <Input value={lcsCertId} onChange={e => setLcsCertId(e.target.value)} placeholder="LCSR-XXXXXXXX" className="mt-1 font-mono text-xs" />
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 gap-1 text-danger border-danger/30 hover:bg-danger/5"
                        onClick={() => handleReview("rejected")} loading={submitting}>
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                      <Button className="flex-1 gap-1" onClick={() => handleReview("approved")} loading={submitting} disabled={!lcsCertId.trim()}>
                        <CheckCircle className="h-3 w-3" /> Approve
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
