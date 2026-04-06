"use client";
import { useStepCompletion } from "@/hooks/useStepCompletion";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { EmploymentTable } from "@/components/reporting/EmploymentTable";
import { EmploymentForm } from "@/components/reporting/EmploymentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { calculateEmploymentMetrics } from "@/lib/compliance/calculators";
import { getEmploymentMinimums } from "@/lib/compliance/jurisdiction-config";
import { cn, formatPercentage } from "@/lib/utils";
import { fetchEntity, fetchEmployment, addEmployment, removeEmployment, updateEmploymentRecord, checkPeriodLocked } from "@/server/actions";
import { CsvImport } from "@/components/reporting/CsvImport";
import type { EmploymentRecord } from "@/types/database.types";

function mapEmployment(e: Record<string, unknown>): EmploymentRecord {
  return {
    id: e.id as string,
    reporting_period_id: e.reportingPeriodId as string,
    entity_id: e.entityId as string,
    job_title: e.jobTitle as string,
    employment_category: e.employmentCategory as EmploymentRecord["employment_category"],
    employment_classification: e.employmentClassification as string | null,
    related_company: e.relatedCompany as string | null,
    total_employees: (e.totalEmployees as number) || 0,
    guyanese_employed: (e.guyanaeseEmployed as number) || 0,
    total_remuneration_paid: e.totalRemunerationPaid ? Number(e.totalRemunerationPaid) : null,
    remuneration_guyanese_only: e.remunerationGuyanaeseOnly ? Number(e.remunerationGuyanaeseOnly) : null,
    notes: e.notes as string | null,
    created_at: "",
  };
}

export default function EmploymentPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const completedSteps = useStepCompletion(periodId);
  const [entityName, setEntityName] = useState("");
  const [records, setRecords] = useState<EmploymentRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<EmploymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadData = async () => {
    const [entity, rawRecords] = await Promise.all([fetchEntity(entityId), fetchEmployment(periodId)]);
    setEntityName(entity?.legalName || "");
    setRecords(rawRecords.map((r) => mapEmployment(r as unknown as Record<string, unknown>)));
    checkPeriodLocked(periodId).then(setLocked).catch(() => {});
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [entityId, periodId]);

  const handleAdd = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await addEmployment(periodId, entityId, data);
      toast.success("Employment record added");
      setFormOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add record");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => { setDeleteTarget(id); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeEmployment(deleteTarget);
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
      await updateEmploymentRecord(editRecord.id, data);
      toast.success("Record updated");
      setEditRecord(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
    setSaving(false);
  };

  const metrics = calculateEmploymentMetrics(records);
  const minimums = getEmploymentMinimums("GY");

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const MetricRow = ({ label, value, minimum }: { label: string; value: number; minimum: number }) => (
    <div className="flex justify-between items-center text-sm">
      <span className="text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("font-bold", value >= minimum ? "text-success" : "text-danger")}>{formatPercentage(value)}</span>
        <span className="text-text-muted text-xs">(min {minimum}%)</span>
      </div>
    </div>
  );

  return (
    <div>
      <TopBar title={`${entityName} — Employment`} />
      <div className="p-4 sm:p-8">
        {locked && (
          <div className="rounded-lg border border-warning/30 bg-warning-light p-3 mb-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-text-secondary">This report has been submitted and is read-only.</span>
          </div>
        )}
        <PageHeader title="Employment Sub-Report" description="Record all employment data by job title, category, and Guyanese employment."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Employment" }]}>
          {!locked && (
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Record</Button></DialogTrigger>
            <CsvImport type="employment" periodId={periodId} entityId={entityId} onImported={loadData} />
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Employment Record</DialogTitle></DialogHeader>
              <EmploymentForm onSubmit={handleAdd} onCancel={() => setFormOpen(false)} loading={saving} />
            </DialogContent>
          </Dialog>
          )}
        </PageHeader>
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="employment" completedSteps={completedSteps} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState icon={Users} title="No employment records" description="Add employment data to track Guyanese employment rates by category." actionLabel="Add Record" onAction={() => setFormOpen(true)} />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <EmploymentTable records={records} onDelete={locked ? () => {} : handleDelete} onEdit={locked ? () => {} : (r) => setEditRecord(r)} />
              </div>
            )}
          </div>
          <div>
            <Card className="p-4 space-y-4">
              <h4 className="text-sm font-medium text-text-secondary">Employment Summary</h4>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Total Employees</span><span className="text-2xl font-bold">{metrics.total_headcount}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Guyanese</span><span className="text-lg font-bold text-success">{metrics.guyanese_headcount} ({formatPercentage(metrics.guyanese_percentage)})</span></div>
              <div className="border-t border-border pt-3 space-y-2">
                <MetricRow label="Managerial" value={metrics.managerial_guyanese_pct} minimum={minimums.managerial} />
                <MetricRow label="Technical" value={metrics.technical_guyanese_pct} minimum={minimums.technical} />
                <MetricRow label="Non-Technical" value={metrics.non_technical_guyanese_pct} minimum={minimums.non_technical} />
              </div>
            </Card>
          </div>
        </div>

        <Dialog open={!!editRecord} onOpenChange={(open) => { if (!open) setEditRecord(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Employment Record</DialogTitle></DialogHeader>
            {editRecord && (
              <EmploymentForm
                defaultValues={{
                  job_title: editRecord.job_title,
                  employment_category: editRecord.employment_category,
                  employment_classification: editRecord.employment_classification || undefined,
                  related_company: editRecord.related_company || undefined,
                  total_employees: editRecord.total_employees,
                  guyanese_employed: editRecord.guyanese_employed,
                  total_remuneration_paid: editRecord.total_remuneration_paid || undefined,
                  remuneration_guyanese_only: editRecord.remuneration_guyanese_only || undefined,
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
                Delete Record
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text-secondary">Are you sure you want to delete this employment record? This action cannot be undone.</p>
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
