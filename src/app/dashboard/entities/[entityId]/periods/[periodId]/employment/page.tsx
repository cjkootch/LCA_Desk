"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { EmploymentTable } from "@/components/reporting/EmploymentTable";
import { EmploymentForm } from "@/components/reporting/EmploymentForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { calculateEmploymentMetrics } from "@/lib/compliance/calculators";
import { getEmploymentMinimums } from "@/lib/compliance/jurisdiction-config";
import { cn, formatPercentage } from "@/lib/utils";
import type { EmploymentRecord, Entity } from "@/types/database.types";

export default function EmploymentPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [records, setRecords] = useState<EmploymentRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchData = async () => {
    const [entityRes, recordsRes] = await Promise.all([
      supabase.from("entities").select("*").eq("id", entityId).single(),
      supabase.from("employment_records").select("*").eq("reporting_period_id", periodId).order("created_at"),
    ]);
    setEntity(entityRes.data);
    setRecords(recordsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [entityId, periodId, supabase]);

  const handleAdd = async (data: Record<string, unknown>) => {
    setSaving(true);
    const { error } = await supabase.from("employment_records").insert({
      ...data,
      reporting_period_id: periodId,
      entity_id: entityId,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Employment record added");
      setFormOpen(false);
      await fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("employment_records").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Record deleted");
    }
  };

  const metrics = calculateEmploymentMetrics(records);
  const minimums = getEmploymentMinimums("GY");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const MetricRow = ({ label, value, minimum }: { label: string; value: number; minimum: number }) => {
    const meetsMin = value >= minimum;
    return (
      <div className="flex justify-between items-center text-sm">
        <span className="text-text-secondary">{label}</span>
        <div className="flex items-center gap-2">
          <span className={cn("font-bold", meetsMin ? "text-success" : "text-danger")}>
            {formatPercentage(value)}
          </span>
          <span className="text-text-muted text-xs">(min {minimum}%)</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <TopBar title={`${entity?.legal_name || ""} — Employment`} />
      <div className="p-8">
        <PageHeader
          title="Employment Sub-Report"
          description="Record all employment data disaggregated by job title, nationality, and position type."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: entity?.legal_name || "", href: `/dashboard/entities/${entityId}` },
            { label: "Employment" },
          ]}
        >
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Employment Record</DialogTitle>
              </DialogHeader>
              <EmploymentForm
                onSubmit={handleAdd}
                onCancel={() => setFormOpen(false)}
                loading={saving}
              />
            </DialogContent>
          </Dialog>
        </PageHeader>

        <PeriodChecklist
          entityId={entityId}
          periodId={periodId}
          currentStep="employment"
          completedSteps={["company_info", "expenditure"]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No employment records"
                description="Add employment data to track Guyanese employment rates by position type."
                actionLabel="Add Record"
                onAction={() => setFormOpen(true)}
              />
            ) : (
              <EmploymentTable records={records} onDelete={handleDelete} />
            )}
          </div>
          <div>
            <Card className="p-4 space-y-4">
              <h4 className="text-sm font-medium text-text-secondary">Employment Summary</h4>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Total Headcount</span>
                <span className="text-2xl font-bold text-text-primary">{metrics.total_headcount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Guyanese</span>
                <span className="text-lg font-bold text-success">{metrics.guyanese_headcount} ({formatPercentage(metrics.guyanese_percentage)})</span>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <MetricRow label="Managerial" value={metrics.managerial_guyanese_pct} minimum={minimums.managerial} />
                <MetricRow label="Technical" value={metrics.technical_guyanese_pct} minimum={minimums.technical} />
                <MetricRow label="Non-Technical" value={metrics.non_technical_guyanese_pct} minimum={minimums.non_technical} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
