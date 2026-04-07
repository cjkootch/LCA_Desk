"use client";
import { useStepCompletion } from "@/hooks/useStepCompletion";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { CapacityTable } from "@/components/reporting/CapacityTable";
import { CapacityForm } from "@/components/reporting/CapacityForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, GraduationCap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatCurrency } from "@/lib/utils";
import { fetchEntity, fetchCapacity, addCapacity, removeCapacity, updateCapacityRecord, checkPeriodLocked } from "@/server/actions";
import { CsvImport } from "@/components/reporting/CsvImport";
import type { CapacityDevelopmentRecord } from "@/types/database.types";

function mapCapacity(c: Record<string, unknown>): CapacityDevelopmentRecord {
  return {
    id: c.id as string,
    reporting_period_id: c.reportingPeriodId as string,
    entity_id: c.entityId as string,
    activity: c.activity as string,
    category: c.category as string | null,
    participant_type: c.participantType as CapacityDevelopmentRecord["participant_type"],
    guyanese_participants_only: (c.guyanaeseParticipantsOnly as number) || 0,
    total_participants: (c.totalParticipants as number) || 0,
    start_date: c.startDate as string | null,
    duration_days: c.durationDays as number | null,
    cost_to_participants: c.costToParticipants ? Number(c.costToParticipants) : null,
    expenditure_on_capacity: c.expenditureOnCapacity ? Number(c.expenditureOnCapacity) : null,
    notes: c.notes as string | null,
    created_at: "",
  };
}

export default function CapacityPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const completedSteps = useStepCompletion(periodId);
  const [entityName, setEntityName] = useState("");
  const [records, setRecords] = useState<CapacityDevelopmentRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<CapacityDevelopmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadData = async () => {
    const [entity, raw] = await Promise.all([fetchEntity(entityId), fetchCapacity(periodId)]);
    setEntityName(entity?.legalName || "");
    setRecords(raw.map((r) => mapCapacity(r as unknown as Record<string, unknown>)));
    checkPeriodLocked(periodId).then(setLocked).catch(() => {});
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [entityId, periodId]);

  const handleAdd = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await addCapacity(periodId, entityId, data);
      toast.success("Capacity development record added");
      setFormOpen(false);
      await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to add record"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => { setDeleteTarget(id); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeCapacity(deleteTarget);
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget));
      toast.success("Record deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete"); }
    setDeleteTarget(null);
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await updateCapacityRecord(editRecord.id, data);
      toast.success("Record updated");
      setEditRecord(null);
      await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update"); }
    setSaving(false);
  };

  const handleInlineUpdate = async (id: string, field: string, value: string | number) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updateData: Record<string, unknown> = {
      activity: record.activity,
      category: record.category,
      participant_type: record.participant_type,
      guyanese_participants_only: record.guyanese_participants_only,
      total_participants: record.total_participants,
      start_date: record.start_date,
      duration_days: record.duration_days,
      cost_to_participants: record.cost_to_participants,
      expenditure_on_capacity: record.expenditure_on_capacity,
    };
    updateData[field] = value;
    await updateCapacityRecord(id, updateData);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handlePasteRows = async (rows: Record<string, string>[]) => {
    let added = 0;
    for (const row of rows) {
      try {
        await addCapacity(periodId, entityId, {
          activity: row.activity || row.Activity || "Training",
          category: row.category || row.Category || "",
          participant_type: row.participant_type || row["Participant Type"] || "",
          total_participants: parseInt(row.total_participants || row.Total || row["Total Participants"] || "0") || 0,
          guyanese_participants_only: parseInt(row.guyanese_participants || row.Guyanese || row["Guyanese Participants"] || "0") || 0,
          start_date: row.start_date || row["Start Date"] || "",
          duration_days: parseInt(row.duration_days || row.Days || row.Duration || "0") || 0,
        });
        added++;
      } catch { /* skip */ }
    }
    if (added > 0) await loadData();
  };

  const metrics = calculateCapacityMetrics(records);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  return (
    <div>
      <TopBar title={`${entityName} — Capacity Development`} />
      <div className="p-4 sm:p-8">
        {locked && (
          <div className="rounded-lg border border-warning/30 bg-warning-light p-3 mb-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-text-secondary">This report has been submitted and is read-only.</span>
          </div>
        )}
        <PageHeader title="Capacity Development Sub-Report" description="Record all capacity development activities undertaken during the reporting period."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Capacity Development" }]}>
          {!locked && (
          <>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Activity</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Capacity Development Activity</DialogTitle></DialogHeader>
              <CapacityForm onSubmit={handleAdd} onCancel={() => setFormOpen(false)} loading={saving} />
            </DialogContent>
          </Dialog>
          <CsvImport type="capacity" periodId={periodId} entityId={entityId} onImported={loadData} />
          </>
          )}
        </PageHeader>
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="capacity" completedSteps={completedSteps} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No capacity development activities" description="Record training, scholarships, and other capacity building activities." actionLabel="Add Activity" onAction={() => setFormOpen(true)} />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <CapacityTable
                  records={records}
                  onDelete={locked ? () => {} : handleDelete}
                  onEdit={locked ? undefined : (r) => setEditRecord(r)}
                  onInlineUpdate={locked ? undefined : handleInlineUpdate}
                  onPasteRows={locked ? undefined : handlePasteRows}
                  locked={locked}
                />
              </div>
            )}
          </div>
          <div>
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-medium text-text-secondary">Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Activities</span><span className="font-bold text-gold">{metrics.total_activities}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Total Participants</span><span className="font-medium">{metrics.total_participants}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Guyanese</span><span className="font-medium text-success">{metrics.total_guyanese_participants}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Total Investment</span><span className="font-medium">{formatCurrency(metrics.total_cost_local, "GYD")}</span></div>
              </div>
            </Card>
          </div>
        </div>

        <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) setEditRecord(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Capacity Development Activity</DialogTitle></DialogHeader>
            {editRecord && (
              <CapacityForm
                defaultValues={{
                  activity: editRecord.activity,
                  category: editRecord.category || undefined,
                  participant_type: editRecord.participant_type || undefined,
                  guyanese_participants_only: editRecord.guyanese_participants_only,
                  total_participants: editRecord.total_participants,
                  start_date: editRecord.start_date || undefined,
                  duration_days: editRecord.duration_days || undefined,
                  cost_to_participants: editRecord.cost_to_participants || undefined,
                  expenditure_on_capacity: editRecord.expenditure_on_capacity || undefined,
                  notes: editRecord.notes || undefined,
                }}
                onSubmit={handleEdit}
                onCancel={() => setEditRecord(null)}
                loading={saving}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Delete Activity
              </DialogTitle>
            </DialogHeader>
            {(() => { const r = records.find(r => r.id === deleteTarget); return r ? (
              <div className="text-sm text-text-secondary">
                <p className="mb-2">Are you sure you want to delete this capacity record?</p>
                <div className="bg-bg-primary rounded-lg p-2 text-xs space-y-0.5">
                  <p><span className="text-text-muted">Activity:</span> <strong>{r.activity}</strong></p>
                  <p><span className="text-text-muted">Participants:</span> {r.guyanese_participants_only}/{r.total_participants} Guyanese</p>
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
