"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import {
  ArrowLeft, Users, CheckCircle, XCircle, Clock, Eye,
  Phone, Mail, FileText, Download, UserCheck, Flag,
  Star, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  fetchApplicationsForPosting, updateApplicationStatus,
  generateFirstConsiderationRecord, hireApplicant, fetchEntities,
  fetchJobPostings,
} from "@/server/actions";
import Link from "next/link";

type ApplicationRow = Awaited<ReturnType<typeof fetchApplicationsForPosting>>[number];
type EntityRow = Awaited<ReturnType<typeof fetchEntities>>[number];

const STATUS_OPTIONS = [
  { value: "received", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interviewed", label: "Interviewed" },
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Not Selected" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock }> = {
  received: { color: "text-text-muted", icon: Clock },
  reviewing: { color: "text-blue-600", icon: Eye },
  shortlisted: { color: "text-warning", icon: Star },
  interviewed: { color: "text-warning", icon: Users },
  selected: { color: "text-success", icon: CheckCircle },
  rejected: { color: "text-danger", icon: XCircle },
};

export default function ApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posting, setPosting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Hire dialog
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [hireTarget, setHireTarget] = useState<ApplicationRow | null>(null);
  const [hireEntityId, setHireEntityId] = useState("");
  const [hiring, setHiring] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApplicationsForPosting(jobId),
      fetchEntities(),
      fetchJobPostings(),
    ])
      .then(([apps, ents, postings]) => {
        setApplications(apps);
        setEntities(ents);
        setPosting(postings.find((p) => p.id === jobId) || null);
      })
      .catch(() => toast.error("Failed to load applications"))
      .finally(() => setLoading(false));
  }, [jobId]);

  const filtered = statusFilter === "all"
    ? applications
    : applications.filter((a) => a.status === statusFilter);

  const guyaneseCount = applications.filter((a) => a.isGuyanese).length;
  const internationalCount = applications.length - guyaneseCount;
  const selectedCount = applications.filter((a) => a.status === "selected").length;
  const statusCounts = applications.reduce((acc, a) => {
    acc[a.status || "received"] = (acc[a.status || "received"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  async function handleStatusChange(appId: string, newStatus: string) {
    try {
      const updated = await updateApplicationStatus(appId, newStatus);
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleNotesBlur(appId: string, notes: string, currentNotes: string) {
    if (notes === currentNotes) return;
    try {
      const app = applications.find((a) => a.id === appId);
      await updateApplicationStatus(appId, app?.status || "received", notes);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, reviewNotes: notes } : a))
      );
    } catch {
      toast.error("Failed to save notes");
    }
  }

  function openHireDialog(app: ApplicationRow) {
    setHireTarget(app);
    setHireEntityId(entities[0]?.id || "");
    setHireDialogOpen(true);
  }

  async function handleHire() {
    if (!hireTarget || !hireEntityId) {
      toast.error("Please select an entity");
      return;
    }
    setHiring(true);
    try {
      await hireApplicant(hireTarget.id, hireEntityId);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === hireTarget.id ? { ...a, status: "selected", hiredAt: new Date() } : a
        )
      );
      toast.success(`${hireTarget.applicantName} has been hired and added to your employee roster.`);
      setHireDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to hire");
    }
    setHiring(false);
  }

  async function handleDownloadFCR() {
    try {
      const data = await generateFirstConsiderationRecord(jobId);
      const res = await fetch("/api/export/first-consideration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `First_Consideration_Record_${posting?.jobTitle?.replace(/\s+/g, "_") || "Report"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("First Consideration Record downloaded");
    } catch {
      toast.error("Failed to generate record");
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Applications" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <div>
      <TopBar title="Applications" />

      <div className="p-4 sm:p-8 max-w-5xl">
        {/* Back + header */}
        <div className="mb-6">
          <Link href="/dashboard/jobs" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Jobs
          </Link>
          <h1 className="text-xl font-heading font-bold text-text-primary">{posting?.jobTitle || "Job Posting"}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {posting?.employmentCategory} &middot; {posting?.contractType} &middot; {posting?.location || "Not specified"}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{applications.length}</p>
              <p className="text-[11px] text-text-muted">Total Applicants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-success">{guyaneseCount}</p>
              <p className="text-[11px] text-text-muted">Guyanese</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-text-primary">{internationalCount}</p>
              <p className="text-[11px] text-text-muted">International</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-accent">{selectedCount}</p>
              <p className="text-[11px] text-text-muted">Selected</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === "all" ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
              }`}
            >
              All ({applications.length})
            </button>
            {Object.entries(statusCounts).map(([status, count]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === status ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
                }`}
              >
                {STATUS_OPTIONS.find((o) => o.value === status)?.label || status} ({count})
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleDownloadFCR} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">First Consideration Record</span>
            <span className="sm:hidden">FCR</span>
          </Button>
        </div>

        {/* Applications list */}
        {applications.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No applications yet"
            description="Applications will appear here as candidates apply to this posting."
          />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">No applications match this filter.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => {
              const config = STATUS_CONFIG[app.status || "received"] || STATUS_CONFIG.received;
              const StatusIcon = config.icon;
              const isExpanded = expandedId === app.id;
              const isSelected = app.status === "selected";
              const isHired = !!app.hiredAt;

              return (
                <Card key={app.id} className={isSelected ? "border-success/30" : ""}>
                  <CardContent className="p-0">
                    {/* Collapsed row */}
                    <div
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-bg-primary/50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          app.isGuyanese ? "bg-success-light" : "bg-bg-primary"
                        }`}>
                          <span className="text-sm font-bold text-text-primary">
                            {app.applicantName?.charAt(0) || "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary truncate">{app.applicantName}</p>
                            {app.isGuyanese && (
                              <Badge variant="success" className="text-[10px] px-1.5">GY</Badge>
                            )}
                            {isHired && (
                              <Badge variant="accent" className="text-[10px] px-1.5">Hired</Badge>
                            )}
                          </div>
                          <p className="text-xs text-text-muted">{app.applicantEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-text-muted hidden sm:block">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ""}
                        </span>
                        <Select
                          value={app.status || "received"}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(app.id, e.target.value);
                          }}
                          options={STATUS_OPTIONS}
                          className="w-32 text-xs"
                        />
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-text-muted" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-text-muted" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border-light">
                        <div className="grid sm:grid-cols-2 gap-4 mt-4">
                          {/* Contact info */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Contact</h4>
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <Mail className="h-3.5 w-3.5 text-text-muted" />
                              <a href={`mailto:${app.applicantEmail}`} className="text-accent hover:text-accent-hover">
                                {app.applicantEmail}
                              </a>
                            </div>
                            {app.applicantPhone && (
                              <div className="flex items-center gap-2 text-sm text-text-secondary">
                                <Phone className="h-3.5 w-3.5 text-text-muted" />
                                <a href={`tel:${app.applicantPhone}`} className="text-accent hover:text-accent-hover">
                                  {app.applicantPhone}
                                </a>
                              </div>
                            )}
                            {app.cvUrl && (
                              <div className="flex items-center gap-2 text-sm">
                                <FileText className="h-3.5 w-3.5 text-text-muted" />
                                <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
                                  View CV / Resume
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Profile */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Profile</h4>
                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                              <Flag className="h-3.5 w-3.5 text-text-muted" />
                              {app.nationality || (app.isGuyanese ? "Guyanese" : "International")}
                            </div>
                            {app.employmentCategory && (
                              <div className="text-sm text-text-secondary">
                                Category: {app.employmentCategory}
                              </div>
                            )}
                            {app.employmentClassification && (
                              <div className="text-sm text-text-secondary">
                                Classification: {app.employmentClassification}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cover note */}
                        {app.coverNote && (
                          <div className="mt-4">
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Cover Note</h4>
                            <div className="bg-bg-primary rounded-lg p-3">
                              <p className="text-sm text-text-secondary whitespace-pre-wrap">{app.coverNote}</p>
                            </div>
                          </div>
                        )}

                        {/* Review notes */}
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Review Notes</h4>
                          <textarea
                            className="w-full h-16 px-3 py-2 rounded-lg bg-bg-primary border border-border-light text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            placeholder="Add your review notes here..."
                            defaultValue={app.reviewNotes ?? ""}
                            onBlur={(e) => handleNotesBlur(app.id, e.target.value, app.reviewNotes ?? "")}
                          />
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-[11px] text-text-muted">
                            Applied: {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric", year: "numeric",
                            }) : "Unknown"}
                          </span>
                          <div className="flex gap-2">
                            {app.status === "shortlisted" || app.status === "interviewed" || app.status === "selected" ? (
                              !isHired && (
                                <Button size="sm" onClick={() => openHireDialog(app)} className="gap-1.5">
                                  <UserCheck className="h-4 w-4" />
                                  Hire
                                </Button>
                              )
                            ) : null}
                            {app.applicantEmail && (
                              <a href={`mailto:${app.applicantEmail}?subject=Re: ${posting?.jobTitle || "Job Application"}`}>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                  <Mail className="h-4 w-4" /> Email
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Hire dialog */}
      <Dialog open={hireDialogOpen} onOpenChange={setHireDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-success" />
              Hire Applicant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-text-secondary">
              Hire <strong>{hireTarget?.applicantName}</strong> for the <strong>{posting?.jobTitle}</strong> position.
              This will:
            </p>
            <ul className="text-xs text-text-secondary space-y-1 ml-4 list-disc">
              <li>Set their application status to &ldquo;Selected&rdquo;</li>
              <li>Create an employee record in your roster</li>
              <li>Link them to employment data for LCA filing</li>
              <li>Mark the posting as &ldquo;Filled&rdquo;</li>
            </ul>
            <div>
              <label className="text-sm font-medium text-text-primary">Assign to Entity *</label>
              <select
                value={hireEntityId}
                onChange={(e) => setHireEntityId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                required
              >
                <option value="">Select an entity</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.legalName}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">The employee record will be linked to this entity for compliance reporting</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setHireDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleHire} loading={hiring} className="gap-1.5">
                <UserCheck className="h-4 w-4" />
                Confirm Hire
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
