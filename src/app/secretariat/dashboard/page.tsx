"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  FileText, CheckCircle, Clock, Search, Shield, Eye,
  MessageSquare, AlertTriangle,
} from "lucide-react";
import { fetchSecretariatDashboard, acknowledgeSubmission } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACK_STATUS: Record<string, { label: string; variant: "default" | "accent" | "warning" | "success" | "danger" }> = {
  received: { label: "Received", variant: "default" },
  under_review: { label: "Under Review", variant: "accent" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  amendment_required: { label: "Amendment Required", variant: "warning" },
};

export default function SecretariatDashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [ackStatus, setAckStatus] = useState("under_review");
  const [ackRef, setAckRef] = useState("");
  const [ackNotes, setAckNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSecretariatDashboard().then(setData).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    }).finally(() => setLoading(false));
  }, []);

  const handleAcknowledge = async () => {
    if (!selectedSubmission) return;
    setSubmitting(true);
    try {
      await acknowledgeSubmission(selectedSubmission.periodId, {
        status: ackStatus, referenceNumber: ackRef || undefined, notes: ackNotes || undefined,
      });
      toast.success(`Submission ${ACK_STATUS[ackStatus]?.label || ackStatus}`);
      setSelectedSubmission(null);
      // Refresh
      const fresh = await fetchSecretariatDashboard();
      setData(fresh);
    } catch { toast.error("Failed to update"); }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  if (!data) return <div className="p-8 text-center text-text-muted">Unable to load secretariat data.</div>;

  const filtered = data.submissions.filter((s: { entityName: string; tenantName: string; acknowledgment: { status: string } | null }) => {
    if (statusFilter !== "all") {
      if (statusFilter === "pending" && s.acknowledgment) return false;
      if (statusFilter !== "pending" && s.acknowledgment?.status !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return s.entityName.toLowerCase().includes(q) || s.tenantName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Submissions</h1>
          <p className="text-sm text-text-secondary">Review and acknowledge filed reports</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{data.stats.total}</p>
          <p className="text-xs text-text-muted">Total Submissions</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-warning">{data.stats.pending}</p>
          <p className="text-xs text-text-muted">Pending Review</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{data.stats.acknowledged}</p>
          <p className="text-xs text-text-muted">Acknowledged</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input placeholder="Search by company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "under_review", label: "Under Review" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "amendment_required", label: "Amendment Required" },
        ]} />
      </div>

      {/* Submissions */}
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No submissions" description="Submitted reports will appear here for review." />
      ) : (
        <div className="space-y-3">
          {filtered.map((s: { periodId: string; entityName: string; tenantName: string; reportType: string; fiscalYear: number; submittedAt: Date | null; companyType: string | null; acknowledgment: { status: string; referenceNumber: string | null; notes: string | null } | null }) => {
            const ack = s.acknowledgment;
            const ackCfg = ack ? ACK_STATUS[ack.status] || ACK_STATUS.received : null;
            return (
              <Card key={s.periodId} className={cn(ack?.status === "approved" ? "border-success/20" : !ack ? "border-warning/20" : "")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text-primary">{s.entityName}</h3>
                      <p className="text-xs text-text-muted">{s.tenantName} · {s.companyType}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default" className="text-[10px]">{s.reportType.replace(/_/g, " ").toUpperCase()}</Badge>
                        <span className="text-xs text-text-muted">FY {s.fiscalYear}</span>
                        {s.submittedAt && <span className="text-xs text-text-muted">Submitted {new Date(s.submittedAt).toLocaleDateString()}</span>}
                      </div>
                      {ack?.referenceNumber && (
                        <p className="text-xs text-text-muted mt-1 font-mono">Ref: {ack.referenceNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ackCfg ? (
                        <Badge variant={ackCfg.variant}>{ackCfg.label}</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedSubmission(s);
                        setAckStatus(ack?.status || "under_review");
                        setAckRef(ack?.referenceNumber || "");
                        setAckNotes(ack?.notes || "");
                      }}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={open => { if (!open) setSelectedSubmission(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gold" />
              Review Submission
            </DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4 mt-2">
              <div className="bg-bg-primary rounded-lg p-3 text-sm">
                <p className="font-medium text-text-primary">{selectedSubmission.entityName}</p>
                <p className="text-text-muted">{selectedSubmission.reportType.replace(/_/g, " ")} — FY {selectedSubmission.fiscalYear}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Status</label>
                <Select value={ackStatus} onChange={e => setAckStatus(e.target.value)} options={[
                  { value: "received", label: "Received" },
                  { value: "under_review", label: "Under Review" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                  { value: "amendment_required", label: "Amendment Required" },
                ]} />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Reference Number</label>
                <Input value={ackRef} onChange={e => setAckRef(e.target.value)} placeholder="e.g. LCS-2026-0042" />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Notes</label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={ackNotes} onChange={e => setAckNotes(e.target.value)}
                  placeholder="Internal notes or feedback to filer..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>Cancel</Button>
                <Button onClick={handleAcknowledge} loading={submitting}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Update Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
