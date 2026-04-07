"use client";
import { useStepCompletion } from "@/hooks/useStepCompletion";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { ExpenditureTable } from "@/components/reporting/ExpenditureTable";
import { ExpenditureForm } from "@/components/reporting/ExpenditureForm";
import { LocalContentRateCard } from "@/components/reporting/LocalContentRateCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Receipt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { calculateLocalContentRate } from "@/lib/compliance/calculators";
import { fetchEntity, fetchExpenditures, addExpenditure, removeExpenditure, updateExpenditure, checkPeriodLocked } from "@/server/actions";
import { RELATED_SECTORS } from "@/lib/compliance/sectors";
import { CsvImport } from "@/components/reporting/CsvImport";
import type { ExpenditureRecord } from "@/types/database.types";

function mapExpenditure(e: Record<string, unknown>): ExpenditureRecord {
  return {
    id: e.id as string,
    reporting_period_id: e.reportingPeriodId as string,
    entity_id: e.entityId as string,
    type_of_item_procured: e.typeOfItemProcured as string,
    related_sector: e.relatedSector as string | null,
    description_of_good_service: e.descriptionOfGoodService as string | null,
    supplier_name: e.supplierName as string,
    sole_source_code: e.soleSourceCode as string | null,
    supplier_certificate_id: e.supplierCertificateId as string | null,
    actual_payment: Number(e.actualPayment),
    outstanding_payment: e.outstandingPayment ? Number(e.outstandingPayment) : null,
    projection_next_period: e.projectionNextPeriod ? Number(e.projectionNextPeriod) : null,
    payment_method: e.paymentMethod as string | null,
    supplier_bank: e.supplierBank as string | null,
    bank_location_country: e.bankLocationCountry as string | null,
    currency_of_payment: (e.currencyOfPayment as string) || "GYD",
    notes: e.notes as string | null,
    created_at: "",
    updated_at: "",
  };
}

export default function ExpenditurePage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const completedSteps = useStepCompletion(periodId);
  const [entityName, setEntityName] = useState("");
  const [records, setRecords] = useState<ExpenditureRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ExpenditureRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadData = async () => {
    const [entity, rawRecords] = await Promise.all([
      fetchEntity(entityId),
      fetchExpenditures(periodId),
    ]);
    setEntityName(entity?.legalName || "");
    setRecords(rawRecords.map((r) => mapExpenditure(r as unknown as Record<string, unknown>)));
    checkPeriodLocked(periodId).then(setLocked).catch(() => {});
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [entityId, periodId]);

  const handleAdd = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await addExpenditure(periodId, entityId, data);
      toast.success("Expenditure record added");
      setFormOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add record");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeExpenditure(deleteTarget);
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget));
      toast.success("Record deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
    setDeleteTarget(null);
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await updateExpenditure(editRecord.id, data);
      toast.success("Record updated");
      setEditRecord(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
    setSaving(false);
  };

  const metrics = calculateLocalContentRate(records);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  return (
    <div>
      <TopBar title={`${entityName} — Expenditure`} />
      <div className="p-4 sm:p-8">
        {locked && (
          <div className="rounded-lg border border-warning/30 bg-warning-light p-3 mb-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-text-secondary">This report has been submitted and is read-only.</span>
          </div>
        )}
        <PageHeader title="Expenditure Sub-Report" description="Record all procurement and supplier expenditure for this reporting period."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Expenditure" }]}>
          {!locked && (
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Record</Button></DialogTrigger>
            <CsvImport type="expenditure" periodId={periodId} entityId={entityId} onImported={loadData} />
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Expenditure Record</DialogTitle></DialogHeader>
              <ExpenditureForm sectorOptions={RELATED_SECTORS} onSubmit={handleAdd} onCancel={() => setFormOpen(false)} loading={saving} />
            </DialogContent>
          </Dialog>
          )}
        </PageHeader>
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="expenditure" completedSteps={completedSteps} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenditure records" description="Add your first expenditure record to start tracking supplier procurement." actionLabel="Add Record" onAction={() => setFormOpen(true)} />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <ExpenditureTable records={records} onDelete={locked ? () => {} : handleDelete} onEdit={locked ? () => {} : (r) => setEditRecord(r)} />
              </div>
            )}
          </div>
          <div><LocalContentRateCard metrics={metrics} /></div>
        </div>

        {/* Edit dialog */}
        <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) setEditRecord(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Expenditure Record</DialogTitle></DialogHeader>
            {editRecord && (
              <ExpenditureForm
                sectorOptions={RELATED_SECTORS}
                defaultValues={{
                  type_of_item_procured: editRecord.type_of_item_procured,
                  related_sector: editRecord.related_sector || undefined,
                  description_of_good_service: editRecord.description_of_good_service || undefined,
                  supplier_name: editRecord.supplier_name,
                  sole_source_code: editRecord.sole_source_code || undefined,
                  supplier_certificate_id: editRecord.supplier_certificate_id || undefined,
                  actual_payment: editRecord.actual_payment,
                  outstanding_payment: editRecord.outstanding_payment || undefined,
                  projection_next_period: editRecord.projection_next_period || undefined,
                  payment_method: editRecord.payment_method || undefined,
                  supplier_bank: editRecord.supplier_bank || undefined,
                  bank_location_country: editRecord.bank_location_country || undefined,
                  currency_of_payment: editRecord.currency_of_payment || "GYD",
                  notes: editRecord.notes || undefined,
                }}
                onSubmit={handleEdit}
                onCancel={() => setEditRecord(null)}
                loading={saving}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Delete Record
              </DialogTitle>
            </DialogHeader>
            {(() => { const r = records.find(r => r.id === deleteTarget); return r ? (
              <div className="text-sm text-text-secondary">
                <p className="mb-2">Are you sure you want to delete this expenditure record?</p>
                <div className="bg-bg-primary rounded-lg p-2 text-xs space-y-0.5">
                  <p><span className="text-text-muted">Supplier:</span> <strong>{r.supplier_name}</strong></p>
                  <p><span className="text-text-muted">Amount:</span> <strong>{r.currency_of_payment} {r.actual_payment.toLocaleString()}</strong></p>
                  {r.related_sector && <p><span className="text-text-muted">Sector:</span> {r.related_sector}</p>}
                </div>
                <p className="mt-2 text-xs text-danger">This action cannot be undone.</p>
              </div>
            ) : <p>Are you sure?</p>; })()}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
