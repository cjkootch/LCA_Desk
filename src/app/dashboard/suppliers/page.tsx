"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import {
  fetchSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/server/actions";

type SupplierRow = Awaited<ReturnType<typeof fetchSuppliers>>[number];

const emptyForm = {
  name: "",
  certificate_id: "",
  sole_source_code: "",
  bank_name: "",
  bank_country: "",
  default_sector: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  notes: "",
};

type FormData = typeof emptyForm;

function supplierToForm(s: SupplierRow): FormData {
  return {
    name: s.name ?? "",
    certificate_id: s.certificateId ?? "",
    sole_source_code: s.soleSourceCode ?? "",
    bank_name: s.bankName ?? "",
    bank_country: s.bankCountry ?? "",
    default_sector: s.defaultSector ?? "",
    contact_name: s.contactName ?? "",
    contact_email: s.contactEmail ?? "",
    contact_phone: s.contactPhone ?? "",
    notes: s.notes ?? "",
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  useEffect(() => {
    fetchSuppliers()
      .then((data) => {
        setSuppliers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(supplier: SupplierRow) {
    setEditingId(supplier.id);
    setForm(supplierToForm(supplier));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateSupplier(editingId, { ...form });
        setSuppliers((prev) =>
          prev.map((s) => (s.id === editingId ? updated : s))
        );
        toast.success("Supplier updated.");
      } else {
        const created = await addSupplier({ ...form });
        setSuppliers((prev) => [...prev, created]);
        toast.success("Supplier added.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Supplier deleted.");
    } catch {
      toast.error("Failed to delete supplier.");
    }
  }

  function onFieldChange(field: keyof FormData, value: string) {
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
      <TopBar title="Supplier Directory" action={{ label: "Add Supplier", onClick: openAdd }} />
      <div className="p-4 sm:p-8">
        <PageHeader
          title="Supplier Directory"
          description="Save supplier details for quick reuse across reports."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-text-primary">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => onFieldChange("name", e.target.value)}
                  placeholder="Supplier name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Certificate ID</label>
                <Input
                  value={form.certificate_id}
                  onChange={(e) => onFieldChange("certificate_id", e.target.value)}
                  placeholder="LCS certificate ID"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Sole Source Code</label>
                <Input
                  value={form.sole_source_code}
                  onChange={(e) => onFieldChange("sole_source_code", e.target.value)}
                  placeholder="Sole source code"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Bank Name</label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => onFieldChange("bank_name", e.target.value)}
                  placeholder="Bank name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Bank Country</label>
                <Input
                  value={form.bank_country}
                  onChange={(e) => onFieldChange("bank_country", e.target.value)}
                  placeholder="Bank country"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Default Sector</label>
                <Input
                  value={form.default_sector}
                  onChange={(e) => onFieldChange("default_sector", e.target.value)}
                  placeholder="Default sector"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Contact Name</label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => onFieldChange("contact_name", e.target.value)}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Contact Email</label>
                <Input
                  value={form.contact_email}
                  onChange={(e) => onFieldChange("contact_email", e.target.value)}
                  placeholder="Contact email"
                  type="email"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Contact Phone</label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => onFieldChange("contact_phone", e.target.value)}
                  placeholder="Contact phone"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Notes</label>
                <Input
                  value={form.notes}
                  onChange={(e) => onFieldChange("notes", e.target.value)}
                  placeholder="Additional notes"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update" : "Add Supplier"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            description="Add your first supplier to start building your directory."
            actionLabel="Add Supplier"
            onAction={openAdd}
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Certificate ID</TableHead>
                  <TableHead>Default Sector</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <p className="font-medium">{supplier.name}</p>
                      {supplier.soleSourceCode && (
                        <p className="text-xs text-text-muted">SSC: {supplier.soleSourceCode}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {supplier.certificateId || "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {supplier.defaultSector ? (
                        <Badge variant="accent">{supplier.defaultSector}</Badge>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.bankName ? (
                        <div>
                          <p className="text-sm">{supplier.bankName}</p>
                          {supplier.bankCountry && (
                            <p className="text-xs text-text-muted">{supplier.bankCountry}</p>
                          )}
                        </div>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.contactName ? (
                        <div>
                          <p className="text-sm">{supplier.contactName}</p>
                          {supplier.contactEmail && (
                            <p className="text-xs text-text-muted">{supplier.contactEmail}</p>
                          )}
                          {supplier.contactPhone && (
                            <p className="text-xs text-text-muted">{supplier.contactPhone}</p>
                          )}
                        </div>
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier.id)}
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
