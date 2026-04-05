"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  fetchEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/server/actions";

type EmployeeRow = Awaited<ReturnType<typeof fetchEmployees>>[number];

const CATEGORY_OPTIONS = [
  { value: "Managerial", label: "Managerial" },
  { value: "Technical", label: "Technical" },
  { value: "Non-Technical", label: "Non-Technical" },
];

const GUYANESE_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const CONTRACT_TYPE_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
];

const EMPTY_FORM = {
  full_name: "",
  job_title: "",
  employment_category: "Managerial",
  employment_classification: "",
  is_guyanese: "true",
  nationality: "",
  contract_type: "permanent",
  start_date: "",
  notes: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchEmployees()
      .then((data) => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(emp: EmployeeRow) {
    setEditingId(emp.id);
    setForm({
      full_name: emp.fullName || "",
      job_title: emp.jobTitle || "",
      employment_category: emp.employmentCategory || "Managerial",
      employment_classification: emp.employmentClassification || "",
      is_guyanese: emp.isGuyanese ? "true" : "false",
      nationality: emp.nationality || "",
      contract_type: emp.contractType || "permanent",
      start_date: emp.startDate || "",
      notes: emp.notes || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.job_title.trim() || !form.employment_category) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateEmployee(editingId, form);
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === editingId ? updated : emp))
        );
        toast.success("Employee updated.");
      } else {
        const created = await addEmployee(form);
        setEmployees((prev) => [...prev, created]);
        toast.success("Employee added.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(emp: EmployeeRow) {
    try {
      await deleteEmployee(emp.id);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      toast.success("Employee removed.");
    } catch {
      toast.error("Failed to remove employee.");
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      <TopBar title="Employee Roster" action={{ label: "Add Employee", onClick: openAdd }} />
      <div className="p-8">
        <PageHeader
          title="Employee Roster"
          description="Maintain your employee directory. Data carries forward into each new report."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Employee" : "Add Employee"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                id="full_name"
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                required
              />
              <Input
                label="Job Title"
                id="job_title"
                value={form.job_title}
                onChange={(e) => updateField("job_title", e.target.value)}
                required
              />
              <Select
                label="Employment Category"
                id="employment_category"
                options={CATEGORY_OPTIONS}
                value={form.employment_category}
                onChange={(e) => updateField("employment_category", e.target.value)}
                required
              />
              <Input
                label="Employment Classification (ISCO-08)"
                id="employment_classification"
                value={form.employment_classification}
                onChange={(e) => updateField("employment_classification", e.target.value)}
              />
              <Select
                label="Guyanese"
                id="is_guyanese"
                options={GUYANESE_OPTIONS}
                value={form.is_guyanese}
                onChange={(e) => updateField("is_guyanese", e.target.value)}
              />
              {form.is_guyanese === "false" && (
                <Input
                  label="Nationality"
                  id="nationality"
                  value={form.nationality}
                  onChange={(e) => updateField("nationality", e.target.value)}
                />
              )}
              <Select
                label="Contract Type"
                id="contract_type"
                options={CONTRACT_TYPE_OPTIONS}
                value={form.contract_type}
                onChange={(e) => updateField("contract_type", e.target.value)}
              />
              <Input
                label="Start Date"
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
              />
              <Input
                label="Notes"
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Add Employee"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add your first employee to start building your roster."
            actionLabel="Add Employee"
            onAction={openAdd}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead>Guyanese</TableHead>
                <TableHead>Contract Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.fullName}</TableCell>
                  <TableCell>{emp.jobTitle || "---"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        emp.employmentCategory === "Managerial"
                          ? "accent"
                          : emp.employmentCategory === "Technical"
                          ? "warning"
                          : "default"
                      }
                    >
                      {emp.employmentCategory || "---"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {emp.employmentClassification || "---"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.isGuyanese ? "success" : "gold"}>
                      {emp.isGuyanese ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">
                    {emp.contractType || "---"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(emp)}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
