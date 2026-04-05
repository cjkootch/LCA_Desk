"use client";

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
import { Plus, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatCurrency } from "@/lib/utils";
import { fetchEntity, fetchCapacity, addCapacity, removeCapacity } from "@/server/actions";
import type { CapacityDevelopmentRecord } from "@/types/database.types";

function mapCapacity(c: Record<string, unknown>): CapacityDevelopmentRecord {
  return {
    id: c.id as string, reporting_period_id: c.reportingPeriodId as string, entity_id: c.entityId as string,
    activity_type: c.activityType as CapacityDevelopmentRecord["activity_type"],
    activity_name: c.activityName as string, provider_name: c.providerName as string | null,
    provider_type: c.providerType as CapacityDevelopmentRecord["provider_type"],
    participant_count: c.participantCount as number, guyanese_participant_count: c.guyanaeseParticipantCount as number,
    start_date: c.startDate as string | null, end_date: c.endDate as string | null,
    total_hours: c.totalHours ? Number(c.totalHours) : null,
    cost_local: c.costLocal ? Number(c.costLocal) : null, cost_usd: c.costUsd ? Number(c.costUsd) : null,
    description: c.description as string | null, notes: c.notes as string | null, created_at: "",
  };
}

export default function CapacityPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entityName, setEntityName] = useState("");
  const [records, setRecords] = useState<CapacityDevelopmentRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [entity, raw] = await Promise.all([fetchEntity(entityId), fetchCapacity(periodId)]);
    setEntityName(entity?.legalName || "");
    setRecords(raw.map((r) => mapCapacity(r as unknown as Record<string, unknown>)));
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

  const handleDelete = async (id: string) => {
    try {
      await removeCapacity(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Record deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete"); }
  };

  const metrics = calculateCapacityMetrics(records);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  return (
    <div>
      <TopBar title={`${entityName} — Capacity Development`} />
      <div className="p-8">
        <PageHeader title="Capacity Development Sub-Report" description="Record training, scholarships, and capacity building activities."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: entityName, href: `/dashboard/entities/${entityId}` }, { label: "Capacity Development" }]}>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Activity</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Capacity Development Activity</DialogTitle></DialogHeader>
              <CapacityForm onSubmit={handleAdd} onCancel={() => setFormOpen(false)} loading={saving} />
            </DialogContent>
          </Dialog>
        </PageHeader>
        <PeriodChecklist entityId={entityId} periodId={periodId} currentStep="capacity" completedSteps={["company_info", "expenditure", "employment"]} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No capacity development activities" description="Record training, scholarships, and other capacity building activities." actionLabel="Add Activity" onAction={() => setFormOpen(true)} />
            ) : (
              <CapacityTable records={records} onDelete={handleDelete} />
            )}
          </div>
          <div>
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-medium text-text-secondary">Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Activities</span><span className="font-bold text-gold">{metrics.total_activities}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Participants</span><span className="font-medium">{metrics.total_participants}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Guyanese</span><span className="font-medium text-success">{metrics.total_guyanese_participants}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Total Hours</span><span className="font-medium">{metrics.total_hours}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Total Cost</span><span className="font-medium">{formatCurrency(metrics.total_cost_local, "GYD")}</span></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
