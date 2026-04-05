"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import type { ExpenditureRecord, SectorCategory, Entity } from "@/types/database.types";

export default function ExpenditurePage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [records, setRecords] = useState<ExpenditureRecord[]>([]);
  const [categories, setCategories] = useState<SectorCategory[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchData = async () => {
    const [entityRes, recordsRes, catsRes] = await Promise.all([
      supabase.from("entities").select("*").eq("id", entityId).single(),
      supabase.from("expenditure_records").select("*").eq("reporting_period_id", periodId).order("created_at"),
      supabase.from("sector_categories").select("*").order("sort_order"),
    ]);
    setEntity(entityRes.data);
    setRecords(recordsRes.data || []);
    setCategories(catsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [entityId, periodId, supabase]);

  const handleAdd = async (data: Record<string, unknown>) => {
    setSaving(true);
    const { error } = await supabase.from("expenditure_records").insert({
      ...data,
      reporting_period_id: periodId,
      entity_id: entityId,
      currency_code: "GYD",
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Expenditure record added");
      setFormOpen(false);
      await fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenditure_records").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Record deleted");
    }
  };

  const metrics = calculateLocalContentRate(records);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title={`${entity?.legal_name || ""} — Expenditure`} />
      <div className="p-8">
        <PageHeader
          title="Expenditure Sub-Report"
          description="Record all procurement and supplier expenditure for this reporting period."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: entity?.legal_name || "", href: `/dashboard/entities/${entityId}` },
            { label: "Expenditure" },
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
                <DialogTitle>Add Expenditure Record</DialogTitle>
              </DialogHeader>
              <ExpenditureForm
                categories={categories}
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
          currentStep="expenditure"
          completedSteps={["company_info"]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {records.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No expenditure records"
                description="Add your first expenditure record to start tracking supplier procurement."
                actionLabel="Add Record"
                onAction={() => setFormOpen(true)}
              />
            ) : (
              <ExpenditureTable
                records={records}
                categories={categories}
                onDelete={handleDelete}
              />
            )}
          </div>
          <div>
            <LocalContentRateCard metrics={metrics} />
          </div>
        </div>
      </div>
    </div>
  );
}
