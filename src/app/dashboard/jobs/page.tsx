"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { Pencil, Trash2, X, Eye, EyeOff, Users, Briefcase } from "lucide-react";
import {
  fetchJobPostings,
  addJobPosting,
  updateJobPosting,
  closeJobPosting,
  deleteJobPosting,
  fetchApplicationsForPosting,
  updateApplicationStatus,
  generateFirstConsiderationRecord,
} from "@/server/actions";

type PostingRow = Awaited<ReturnType<typeof fetchJobPostings>>[number];
type ApplicationRow = Awaited<ReturnType<typeof fetchApplicationsForPosting>>[number];

const emptyForm = {
  job_title: "",
  employment_category: "Technical",
  employment_classification: "",
  contract_type: "permanent",
  location: "Georgetown",
  description: "",
  qualifications: "",
  vacancy_count: "1",
  application_deadline: "",
  start_date: "",
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
    vacancy_count: String(p.vacancyCount ?? 1),
    application_deadline: p.applicationDeadline ? String(p.applicationDeadline).slice(0, 10) : "",
    start_date: p.startDate ? String(p.startDate).slice(0, 10) : "",
    is_public: p.isPublic !== false,
  };
}

const categoryOptions = [
  { value: "Managerial", label: "Managerial" },
  { value: "Technical", label: "Technical" },
  { value: "Non-Technical", label: "Non-Technical" },
];

const contractOptions = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
];

const locationOptions = [
  { value: "Georgetown", label: "Georgetown" },
  { value: "Offshore", label: "Offshore" },
  { value: "East Bank Demerara", label: "East Bank Demerara" },
  { value: "Other", label: "Other" },
];

const applicationStatusOptions = [
  { value: "received", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interviewed", label: "Interviewed" },
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Rejected" },
];

export default function JobsPage() {
  const [postings, setPostings] = useState<PostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [tabFilter, setTabFilter] = useState<"active" | "closed" | "all">("active");

  // Application counts per posting (postingId -> count)
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});

  // Applications dialog state
  const [appsDialogOpen, setAppsDialogOpen] = useState(false);
  const [appsPostingId, setAppsPostingId] = useState<string | null>(null);
  const [appsPostingTitle, setAppsPostingTitle] = useState("");
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  useEffect(() => {
    fetchJobPostings()
      .then((data) => {
        setPostings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Derived stats
  const totalPostings = postings.length;
  const openPositions = postings.filter((p) => p.status === "open").length;
  const positionsFilled = postings.filter((p) => p.status === "filled").length;
  const applicationsReceived = Object.values(appCounts).reduce((sum, c) => sum + c, 0);

  // Filtered postings by tab
  const filteredPostings = postings.filter((p) => {
    if (tabFilter === "active") return p.status === "open";
    if (tabFilter === "closed") return p.status === "closed" || p.status === "filled";
    return true;
  });

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(posting: PostingRow) {
    setEditingId(posting.id);
    setForm(postingToForm(posting));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.job_title.trim()) {
      toast.error("Job title is required.");
      return;
    }
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
        setPostings((prev) => [...prev, created]);
        toast.success("Job posting created.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(id: string) {
    try {
      await closeJobPosting(id);
      setPostings((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "closed" } : p))
      );
      toast.success("Job posting closed.");
    } catch {
      toast.error("Failed to close posting.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteJobPosting(id);
      setPostings((prev) => prev.filter((p) => p.id !== id));
      toast.success("Job posting deleted.");
    } catch {
      toast.error("Failed to delete posting.");
    }
  }

  async function openApplications(posting: PostingRow) {
    setAppsPostingId(posting.id);
    setAppsPostingTitle(posting.jobTitle ?? "");
    setAppsDialogOpen(true);
    setAppsLoading(true);
    try {
      const apps = await fetchApplicationsForPosting(posting.id);
      setApplications(apps);
      setAppCounts((prev) => ({ ...prev, [posting.id]: apps.length }));
    } catch {
      toast.error("Failed to load applications.");
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }

  async function handleAppStatusChange(appId: string, status: string) {
    try {
      const updated = await updateApplicationStatus(appId, status);
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
      toast.success("Application status updated.");
    } catch {
      toast.error("Failed to update application status.");
    }
  }

  async function handleAppNotesChange(appId: string, notes: string) {
    try {
      const updated = await updateApplicationStatus(
        appId,
        applications.find((a) => a.id === appId)?.status ?? "received",
        notes
      );
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
    } catch {
      toast.error("Failed to save notes.");
    }
  }

  async function handleGenerateRecord() {
    if (!appsPostingId) return;
    try {
      await generateFirstConsiderationRecord(appsPostingId);
      toast.success("First consideration record generated.");
    } catch {
      toast.error("Failed to generate record.");
    }
  }

  function onFieldChange(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function statusBadgeVariant(status: string): "success" | "default" | "gold" {
    if (status === "open") return "success";
    if (status === "filled") return "gold";
    return "default";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Jobs" action={{ label: "Post a Position", onClick: openAdd }} />
      <div className="p-8">
        <PageHeader
          title="Jobs"
          description="Post positions, manage applications, and generate first consideration records."
        />

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Total Postings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-text-primary">{totalPostings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-text-primary">{openPositions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Applications Received</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-text-primary">{applicationsReceived}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-text-secondary">Positions Filled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-text-primary">{positionsFilled}</p>
            </CardContent>
          </Card>
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
            </button>
          ))}
        </div>

        {/* Post/Edit Dialog */}
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
              <div>
                <label className="text-sm font-medium text-text-primary">Employment Category</label>
                <Select
                  value={form.employment_category}
                  onChange={(e) => onFieldChange("employment_category", e.target.value)}
                  options={categoryOptions}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Employment Classification (ISCO-08)</label>
                <Input
                  value={form.employment_classification}
                  onChange={(e) => onFieldChange("employment_classification", e.target.value)}
                  placeholder="e.g. 2145"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Contract Type</label>
                <Select
                  value={form.contract_type}
                  onChange={(e) => onFieldChange("contract_type", e.target.value)}
                  options={contractOptions}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Location</label>
                <Select
                  value={form.location}
                  onChange={(e) => onFieldChange("location", e.target.value)}
                  options={locationOptions}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Description</label>
                <textarea
                  className="w-full h-24 px-3 py-2 rounded-lg bg-white border border-border text-text-primary text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                  value={form.description}
                  onChange={(e) => onFieldChange("description", e.target.value)}
                  placeholder="Job description..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Qualifications</label>
                <textarea
                  className="w-full h-24 px-3 py-2 rounded-lg bg-white border border-border text-text-primary text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
                  value={form.qualifications}
                  onChange={(e) => onFieldChange("qualifications", e.target.value)}
                  placeholder="Required qualifications..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Vacancies</label>
                <Input
                  type="number"
                  min={1}
                  value={form.vacancy_count}
                  onChange={(e) => onFieldChange("vacancy_count", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Application Deadline</label>
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={form.is_public as boolean}
                  onChange={(e) => onFieldChange("is_public", e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="is_public" className="text-sm font-medium text-text-primary">
                  Make posting public
                </label>
              </div>

              {/* Local Content Act info box */}
              <div className="rounded-lg border border-accent/20 bg-accent-light p-3 text-sm text-text-secondary">
                In accordance with Section 12 of the Local Content Act 2021,{" "}
                <span className="font-medium text-text-primary">
                  {form.job_title || "[job_title]"}
                </span>{" "}
                position(s) are advertised with first consideration given to qualified Guyanese
                nationals...
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Post Position"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Applications Dialog */}
        <Dialog open={appsDialogOpen} onOpenChange={setAppsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Applications - {appsPostingTitle}</DialogTitle>
            </DialogHeader>
            {appsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
              </div>
            ) : applications.length === 0 ? (
              <p className="text-sm text-text-secondary py-8 text-center">
                No applications received yet.
              </p>
            ) : (
              <div className="space-y-4 mt-2">
                {/* Summary */}
                <div className="text-sm text-text-secondary">
                  {applications.length} total &mdash;{" "}
                  {applications.filter((a) => a.isGuyanese).length} Guyanese,{" "}
                  {applications.filter((a) => !a.isGuyanese).length} International
                </div>

                <div className="space-y-3">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="border border-border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-text-primary">{app.applicantName}</p>
                          <p className="text-xs text-text-muted">{app.applicantEmail}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={app.isGuyanese ? "success" : "default"}>
                            {app.isGuyanese ? "Guyanese" : "International"}
                          </Badge>
                          <span className="text-xs text-text-muted">
                            {app.createdAt
                              ? new Date(app.createdAt).toLocaleDateString()
                              : "\u2014"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select
                          value={app.status ?? "received"}
                          onChange={(e) => handleAppStatusChange(app.id, e.target.value)}
                          options={applicationStatusOptions}
                          className="w-40"
                        />
                        <Input
                          placeholder="Review notes..."
                          defaultValue={app.reviewNotes ?? ""}
                          onBlur={(e) => {
                            if (e.target.value !== (app.reviewNotes ?? "")) {
                              handleAppNotesChange(app.id, e.target.value);
                            }
                          }}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleGenerateRecord} variant="outline">
                    Generate First Consideration Record
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Table */}
        {filteredPostings.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No job postings yet"
            description="Post your first position to start tracking applications and local content compliance."
            actionLabel="Post a Position"
            onAction={openAdd}
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Vacancies</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPostings.map((posting) => (
                  <TableRow key={posting.id}>
                    <TableCell>
                      <p className="font-medium">{posting.jobTitle}</p>
                      {posting.employmentClassification && (
                        <p className="text-xs text-text-muted">
                          ISCO: {posting.employmentClassification}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="accent">{posting.employmentCategory}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{posting.contractType ?? "\u2014"}</TableCell>
                    <TableCell>{posting.location ?? "\u2014"}</TableCell>
                    <TableCell>{posting.vacancyCount ?? 1}</TableCell>
                    <TableCell>
                      {posting.applicationDeadline
                        ? new Date(posting.applicationDeadline).toLocaleDateString()
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(posting.status ?? "open")}>
                        {posting.status ?? "open"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {posting.isPublic ? (
                        <Eye className="h-4 w-4 text-text-secondary" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-text-muted" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(posting)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openApplications(posting)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          <span className="text-xs">{appCounts[posting.id] ?? 0}</span>
                        </Button>
                        {posting.status === "open" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClose(posting.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(posting.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
