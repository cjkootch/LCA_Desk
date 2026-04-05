"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityHeader } from "@/components/entity/EntityHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Entity, ReportingPeriod } from "@/types/database.types";
import type { PeriodStatus } from "@/types/database.types";

export default function EntityDetailPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    report_type: "half_yearly_h1",
    period_start: "",
    period_end: "",
    due_date: "",
    fiscal_year: new Date().getFullYear().toString(),
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const [entityRes, periodsRes] = await Promise.all([
        supabase.from("entities").select("*").eq("id", entityId).single(),
        supabase
          .from("reporting_periods")
          .select("*")
          .eq("entity_id", entityId)
          .order("period_start", { ascending: false }),
      ]);
      setEntity(entityRes.data);
      setPeriods(periodsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [entityId, supabase]);

  const handleCreatePeriod = async () => {
    if (!entity) return;

    const { error } = await supabase.from("reporting_periods").insert({
      entity_id: entity.id,
      jurisdiction_id: entity.jurisdiction_id,
      report_type: newPeriod.report_type,
      period_start: newPeriod.period_start,
      period_end: newPeriod.period_end,
      due_date: newPeriod.due_date,
      fiscal_year: parseInt(newPeriod.fiscal_year),
      status: "not_started",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reporting period created");
      setCreateOpen(false);
      // Refresh periods
      const { data } = await supabase
        .from("reporting_periods")
        .select("*")
        .eq("entity_id", entityId)
        .order("period_start", { ascending: false });
      setPeriods(data || []);
    }
  };

  if (loading || !entity) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title={entity.legal_name} />
      <div className="p-8">
        <PageHeader
          title=""
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Entities", href: "/dashboard/entities" },
            { label: entity.legal_name },
          ]}
        >
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Period
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Reporting Period</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Select
                  label="Report Type"
                  id="report_type"
                  value={newPeriod.report_type}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, report_type: e.target.value })
                  }
                  options={[
                    { value: "half_yearly_h1", label: "H1 Half-Yearly Report" },
                    { value: "half_yearly_h2", label: "H2 Half-Yearly Report" },
                    { value: "annual_plan", label: "Annual Local Content Plan" },
                    { value: "master_plan", label: "Local Content Master Plan" },
                    { value: "performance_report", label: "Annual Performance Report" },
                  ]}
                />
                <Input
                  label="Period Start"
                  id="period_start"
                  type="date"
                  value={newPeriod.period_start}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, period_start: e.target.value })
                  }
                />
                <Input
                  label="Period End"
                  id="period_end"
                  type="date"
                  value={newPeriod.period_end}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, period_end: e.target.value })
                  }
                />
                <Input
                  label="Due Date"
                  id="due_date"
                  type="date"
                  value={newPeriod.due_date}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, due_date: e.target.value })
                  }
                />
                <Input
                  label="Fiscal Year"
                  id="fiscal_year"
                  type="number"
                  value={newPeriod.fiscal_year}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, fiscal_year: e.target.value })
                  }
                />
                <Button onClick={handleCreatePeriod} className="w-full">
                  Create Period
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <EntityHeader entity={entity} />

        {/* Entity details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Entity Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Registration Number</p>
                  <p className="text-text-primary">{entity.registration_number || "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted">Petroleum Agreement</p>
                  <p className="text-text-primary">{entity.petroleum_agreement_ref || "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted">Guyanese Ownership</p>
                  <p className="text-text-primary">
                    {entity.guyanese_ownership_pct !== null
                      ? `${entity.guyanese_ownership_pct}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted">Contact</p>
                  <p className="text-text-primary">{entity.contact_name || "—"}</p>
                  <p className="text-xs text-text-muted">{entity.contact_email || ""}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">LCS Certificate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-lg text-accent">{entity.lcs_certificate_id || "—"}</p>
              {entity.lcs_certificate_expiry && (
                <p className="text-sm text-text-muted mt-1">
                  Expires: {format(new Date(entity.lcs_certificate_expiry), "MMM d, yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reporting Periods */}
        <div className="mt-8">
          <h2 className="text-lg font-heading font-semibold mb-4">Reporting Periods</h2>
          {periods.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-text-muted">No reporting periods yet. Create one to start filing.</p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.report_type.replace(/_/g, " ").toUpperCase()}</TableCell>
                    <TableCell>
                      {format(new Date(period.period_start), "MMM d")} –{" "}
                      {format(new Date(period.period_end), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{format(new Date(period.due_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={period.status as PeriodStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/entities/${entityId}/periods/${period.id}`}
                      >
                        <Button variant="ghost" size="sm">
                          Open <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
