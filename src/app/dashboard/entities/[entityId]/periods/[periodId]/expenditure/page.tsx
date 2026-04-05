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
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { calculateLocalContentRate } from "@/lib/compliance/calculators";
import { fetchEntity, fetchExpenditures, addExpenditure, removeExpenditure, updateExpenditure } from "@/server/actions";
import { RELATED_SECTORS } from "@/lib/compliance/sectors";
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

  const loadData = async () => {
    const [entity, rawRecords] = await Promise.all([
      fetchEntity(entityId),
      fetchExpenditures(periodId),
    ]);
    setEntityName(entity?.legalName || "");
    setRecords(rawRecords.map((r) => mapExpenditure(r as unknown as Record<string, unknown>)));
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
    try {
      await removeExpenditure(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Record deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
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
      <div className="p-8">
        <PageHeader title="Expenditure Sub-Report" description="Record all procurement and supplier expenditure for this reporting period."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Expenditure" }]}>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Record</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Expenditure Record</DialogTitle></DialogHeader>
              <ExpenditureForm sectorOptions={RELATED_SECTORS} onSubmit={handleAdd} onCancel={() => setFormOpen(false)} loading={saving} />
            </DialogContent>
          </Dialog>
        </PageHeader>
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="expenditure" completedSteps={completedSteps} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenditure records" description="Add your first expenditure record to start tracking supplier procurement." actionLabel="Add Record" onAction={() => setFormOpen(true)} />
            ) : (
              <ExpenditureTable records={records} onDelete={handleDelete} onEdit={(r) => setEditRecord(r)} />
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
      </div>
    </div>
  );
}
