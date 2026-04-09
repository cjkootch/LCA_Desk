"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
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
  Pencil, Trash2, Eye, EyeOff, Users, Briefcase, Plus, MapPin,
  Calendar, RotateCcw, AlertTriangle, CheckCircle, Clock, XCircle,
} from "lucide-react";
import {
  fetchJobPostings, addJobPosting, updateJobPosting, closeJobPosting,
  deleteJobPosting, reopenJobPosting, fetchApplicationCounts, fetchEntities,
} from "@/server/actions";
import Link from "next/link";

type PostingRow = Awaited<ReturnType<typeof fetchJobPostings>>[number];
type EntityRow = Awaited<ReturnType<typeof fetchEntities>>[number];

const emptyForm = {
  job_title: "",
  employment_category: "Technical",
  employment_classification: "",
  contract_type: "permanent",
  location: "Georgetown",
  description: "",
  qualifications: "",
  guyanese_first_statement: "",
  vacancy_count: "1",
  application_deadline: "",
  start_date: "",
  entity_id: "",
  is_public: true,
};

type FormData = typeof emptyForm;

function postingToForm(p: PostingRow): FormData {
  return {
    job_title: p.jobTitle ?? "",
    employment_category: p.employmentCategory ?? "Technical",
    employment_classification: p.employmentClassification ?? "",
    contract_type: p.contractType ?? "permanent",
    location: p.location ?? "Georgetown",
    description: p.description ?? "",
    qualifications: p.qualifications ?? "",
    guyanese_first_statement: p.guyaneseFirstStatement ?? "",
    vacancy_count: String(p.vacancyCount ?? 1),
    application_deadline: p.applicationDeadline ? String(p.applicationDeadline).slice(0, 10) : "",
    start_date: p.startDate ? String(p.startDate).slice(0, 10) : "",
    entity_id: p.entityId ?? "",
    is_public: p.isPublic !== false,
  };
}

const CATEGORIES = [
  { value: "Management", label: "Management" },
  { value: "Technical", label: "Technical" },
  { value: "Administrative", label: "Administrative" },
  { value: "Skilled Labour", label: "Skilled Labour" },
  { value: "Semi-Skilled Labour", label: "Semi-Skilled Labour" },
  { value: "Unskilled Labour", label: "Unskilled Labour" },
];

const CONTRACT_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "Full-time", label: "Full-time" },
  { value: "Part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
];

const LOCATIONS = [
  { value: "Georgetown", label: "Georgetown" },
  { value: "Offshore", label: "Offshore" },
  { value: "East Bank Demerara", label: "East Bank Demerara" },
  { value: "Linden", label: "Linden" },
  { value: "New Amsterdam", label: "New Amsterdam" },
  { value: "Region 4", label: "Region 4" },
  { value: "Other", label: "Other" },
];

export default function JobsPage() {
  const [postings, setPostings] = useState<PostingRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [tabFilter, setTabFilter] = useState<"active" | "closed" | "all">("active");
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [confirmAction, setConfirmAction] = useState<{ type: "close" | "delete"; id: string; title: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchJobPostings(), fetchApplicationCounts(), fetchEntities()])
      .then(([data, counts, ents]) => {
        setPostings(data);
        setAppCounts(counts);
        setEntities(ents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalPostings = postings.length;
  const openPositions = postings.filter((p) => p.status === "open").length;
  const positionsFilled = postings.filter((p) => p.status === "filled").length;
  const totalApps = Object.values(appCounts).reduce((sum, c) => sum + c, 0);

  const filteredPostings = postings.filter((p) => {
    if (tabFilter === "active") return p.status === "open";
    if (tabFilter === "closed") return p.status === "closed" || p.status === "filled";
    return true;
  });

  function openAdd() {
    setEditingId(null);
    const defaultStatement = "In accordance with Section 12 of the Local Content Act 2021, this position is advertised with first consideration given to qualified Guyanese nationals.";
    setForm({ ...emptyForm, guyanese_first_statement: defaultStatement });
    setDialogOpen(true);
  }

  function openEdit(posting: PostingRow) {
    setEditingId(posting.id);
    setForm(postingToForm(posting));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.job_title.trim()) { toast.error("Job title is required."); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        vacancy_count: Number(form.vacancy_count) || 1,
        is_public: form.is_public,
      };
      if (editingId) {
        const updated = await updateJobPosting(editingId, payload);
        setPostings((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast.success("Job posting updated.");
      } else {
        const created = await addJobPosting(payload);
        setPostings((prev) => [created, ...prev]);
        toast.success("Job posting created! It's now live for applicants.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Something went wrong.");
    }
    setSaving(false);
  }

  async function handleClose(id: string) {
    try {
      await closeJobPosting(id);
      setPostings((prev) => prev.map((p) => (p.id === id ? { ...p, status: "closed" } : p)));
      toast.success("Posting closed.");
    } catch { toast.error("Failed to close."); }
    setConfirmAction(null);
  }

  async function handleReopen(id: string) {
    try {
      const updated = await reopenJobPosting(id);
      setPostings((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success("Posting reopened.");
    } catch { toast.error("Failed to reopen."); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteJobPosting(id);
      setPostings((prev) => prev.filter((p) => p.id !== id));
      toast.success("Posting deleted.");
    } catch { toast.error("Failed to delete."); }
    setConfirmAction(null);
  }

  function onFieldChange(field: keyof FormData, value: string | boolean) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-update Guyanese First Statement when job title changes
      if (field === "job_title" && !editingId) {
        next.guyanese_first_statement = `In accordance with Section 12 of the Local Content Act 2021, ${value || "[position]"} position(s) are advertised with first consideration given to qualified Guyanese nationals.`;
      }
      return next;
    });
  }

  if (loading) {
    return (
      <>
        <TopBar title="Jobs" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <div>
      <TopBar title="Jobs" action={{ label: "Post a Position", onClick: openAdd }} />
      <div className="p-4 sm:p-8 max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: "Total Postings", value: totalPostings, icon: Briefcase, color: "text-accent" },
            { label: "Open Positions", value: openPositions, icon: CheckCircle, color: "text-success" },
            { label: "Applications", value: totalApps, icon: Users, color: "text-blue-600" },
            { label: "Filled", value: positionsFilled, icon: Clock, color: "text-gold" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-bg-primary flex items-center justify-center">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                    <p className="text-xs text-text-muted">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab filter */}
        <div className="flex items-center gap-1 mb-6 bg-bg-primary rounded-lg p-1 w-fit">
          {(["active", "closed", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTabFilter(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tabFilter === tab
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "active" && ` (${openPositions})`}
            </button>
          ))}
        </div>

        {/* Job cards */}
        {filteredPostings.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No job postings yet"
            description="Post your first position to start tracking applications and local content compliance."
            actionLabel="Post a Position"
            onAction={openAdd}
          />
        ) : (
          <div className="space-y-3">
            {filteredPostings.map((posting) => {
              const apps = appCounts[posting.id] || 0;
              const isOpen = posting.status === "open";
              const isFilled = posting.status === "filled";
              const deadlinePassed = posting.applicationDeadline && new Date(posting.applicationDeadline) < new Date();

              return (
                <Card key={posting.id} className={!isOpen ? "opacity-75" : ""}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-medium text-text-primary">{posting.jobTitle}</h3>
                          <Badge variant={isOpen ? "success" : isFilled ? "gold" : "default"}>
                            {posting.status ?? "open"}
                          </Badge>
                          {posting.isPublic ? (
                            <Eye className="h-3.5 w-3.5 text-text-muted" />
                          ) : (
                            <span className="flex items-center gap-1 text-sm text-text-muted">
                              <EyeOff className="h-3.5 w-3.5" /> Private
                            </span>
                          )}
                        </div>

                        {posting.employmentClassification && (
                          <p className="text-xs text-text-muted mt-0.5">ISCO: {posting.employmentClassification}</p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="accent" className="text-xs">{posting.employmentCategory}</Badge>
                          <Badge variant="default" className="text-xs capitalize">{posting.contractType}</Badge>
                          {posting.location && (
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              <MapPin className="h-3 w-3" /> {posting.location}
                            </span>
                          )}
                          <span className="text-xs text-text-muted">
                            {posting.vacancyCount ?? 1} position{(posting.vacancyCount ?? 1) > 1 ? "s" : ""}
                          </span>
                        </div>

                        {posting.description && (
                          <p className="text-xs text-text-secondary mt-2 line-clamp-1">{posting.description}</p>
                        )}

                        <div className="flex items-center gap-4 mt-2">
                          {posting.applicationDeadline && (
                            <span className={`flex items-center gap-1 text-sm ${
                              deadlinePassed && isOpen ? "text-danger font-medium" : "text-text-muted"
                            }`}>
                              <Calendar className="h-3 w-3" />
                              Deadline: {new Date(posting.applicationDeadline).toLocaleDateString()}
                              {deadlinePassed && isOpen && " (passed)"}
                            </span>
                          )}
                          {posting.createdAt && (
                            <span className="text-sm text-text-muted">
                              Posted {new Date(posting.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: apps count + actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Link href={`/dashboard/jobs/${posting.id}/applications`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Users className="h-4 w-4" />
                            <span className="font-semibold">{apps}</span>
                            <span className="hidden sm:inline text-text-muted">applicant{apps !== 1 ? "s" : ""}</span>
                          </Button>
                        </Link>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(posting)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isOpen ? (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setConfirmAction({ type: "close", id: posting.id, title: posting.jobTitle || "" })}
                              title="Close posting"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleReopen(posting.id)} title="Reopen">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setConfirmAction({ type: "delete", id: posting.id, title: posting.jobTitle || "" })}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Confirm dialog */}
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                {confirmAction?.type === "delete" ? "Delete Posting" : "Close Posting"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text-secondary">
              {confirmAction?.type === "delete"
                ? `Permanently delete "${confirmAction.title}"? This will also remove all applications.`
                : `Close "${confirmAction?.title}"? This will stop accepting new applications.`}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={confirmAction?.type === "delete" ? "danger" : "secondary"}
                onClick={() => {
                  if (confirmAction?.type === "delete") handleDelete(confirmAction.id);
                  else if (confirmAction) handleClose(confirmAction.id);
                }}
              >
                {confirmAction?.type === "delete" ? "Delete" : "Close Posting"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Post/Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Job Posting" : "Post a Position"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-text-primary">Job Title *</label>
                <Input
                  value={form.job_title}
                  onChange={(e) => onFieldChange("job_title", e.target.value)}
                  placeholder="e.g. Drilling Engineer"
                  required
                />
              </div>

              {entities.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-text-primary">Filing Entity</label>
                  <select
                    value={form.entity_id}
                    onChange={(e) => onFieldChange("entity_id", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">Not linked to an entity</option>
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>{e.legalName}</option>
                    ))}
                  </select>
                  <p className="text-sm text-text-muted mt-1">Link to an entity for employment reporting</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-primary">Employment Category</label>
                  <Select
                    value={form.employment_category}
                    onChange={(e) => onFieldChange("employment_category", e.target.value)}
                    options={CATEGORIES}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary">ISCO-08 Code</label>
                  <Input
                    value={form.employment_classification}
                    onChange={(e) => onFieldChange("employment_classification", e.target.value)}
                    placeholder="e.g. 2145"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-primary">Contract Type</label>
                  <Select
                    value={form.contract_type}
                    onChange={(e) => onFieldChange("contract_type", e.target.value)}
                    options={CONTRACT_TYPES}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary">Location</label>
                  <Select
                    value={form.location}
                    onChange={(e) => onFieldChange("location", e.target.value)}
                    options={LOCATIONS}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Description</label>
                <textarea
                  className="w-full h-24 px-3 py-2 rounded-lg bg-white border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                  value={form.description}
                  onChange={(e) => onFieldChange("description", e.target.value)}
                  placeholder="Describe the role, responsibilities, and expectations..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Qualifications</label>
                <textarea
                  className="w-full h-24 px-3 py-2 rounded-lg bg-white border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                  value={form.qualifications}
                  onChange={(e) => onFieldChange("qualifications", e.target.value)}
                  placeholder="Required qualifications, certifications, and experience..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-primary">Vacancies</label>
                  <Input
                    type="number" min={1}
                    value={form.vacancy_count}
                    onChange={(e) => onFieldChange("vacancy_count", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary">Deadline</label>
                  <Input
                    type="date"
                    value={form.application_deadline}
                    onChange={(e) => onFieldChange("application_deadline", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary">Start Date</label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => onFieldChange("start_date", e.target.value)}
                  />
                </div>
              </div>

              {/* Guyanese First Statement */}
              <div>
                <label className="text-sm font-medium text-text-primary">Guyanese First Consideration Statement</label>
                <textarea
                  className="w-full h-16 px-3 py-2 rounded-lg bg-accent-light border border-accent/20 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={form.guyanese_first_statement}
                  onChange={(e) => onFieldChange("guyanese_first_statement", e.target.value)}
                />
                <p className="text-sm text-text-muted mt-1">Required by Section 12 of the Local Content Act 2021</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="is_public"
                  checked={form.is_public as boolean}
                  onChange={(e) => onFieldChange("is_public", e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="is_public" className="text-sm font-medium text-text-primary">
                  Make posting public
                </label>
                <span className="text-xs text-text-muted">(visible on job board)</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" loading={saving}>
                  <Plus className="h-4 w-4 mr-1" />
                  {editingId ? "Update Posting" : "Post Position"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
