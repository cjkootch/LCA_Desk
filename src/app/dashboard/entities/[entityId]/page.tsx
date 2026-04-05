"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { fetchEntity, fetchPeriodsForEntity, addPeriod } from "@/server/actions";
import { calculateDeadlines } from "@/lib/compliance/deadlines";
import type { Entity, PeriodStatus } from "@/types/database.types";

function getAutoFillDates(reportType: string, year: number) {
  const deadlines = calculateDeadlines("GY", year);
  const match = deadlines.find((d) => d.type === reportType);
  if (!match) return null;
  return {
    period_start: match.period_start.toISOString().slice(0, 10),
    period_end: match.period_end.toISOString().slice(0, 10),
    due_date: match.due_date.toISOString().slice(0, 10),
  };
}

export default function EntityDetailPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [periods, setPeriods] = useState<Awaited<ReturnType<typeof fetchPeriodsForEntity>>>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const currentYear = new Date().getFullYear();
  const [reportType, setReportType] = useState("half_yearly_h1");
  const [fiscalYear, setFiscalYear] = useState(currentYear.toString());
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const [entityData, periodsData] = await Promise.all([
        fetchEntity(entityId),
        fetchPeriodsForEntity(entityId),
      ]);
      if (entityData) {
        setEntity({
          id: entityData.id,
          tenant_id: entityData.tenantId,
          jurisdiction_id: entityData.jurisdictionId || "",
          legal_name: entityData.legalName,
          trading_name: entityData.tradingName,
          registration_number: entityData.registrationNumber,
          lcs_certificate_id: entityData.lcsCertificateId,
          lcs_certificate_expiry: entityData.lcsCertificateExpiry,
          petroleum_agreement_ref: entityData.petroleumAgreementRef,
          company_type: entityData.companyType as Entity["company_type"],
          guyanese_ownership_pct: entityData.guyanaeseOwnershipPct ? Number(entityData.guyanaeseOwnershipPct) : null,
          registered_address: entityData.registeredAddress,
          contact_name: entityData.contactName,
          contact_email: entityData.contactEmail,
          contact_phone: entityData.contactPhone,
          authorized_rep_name: entityData.authorizedRepName,
          authorized_rep_designation: entityData.authorizedRepDesignation,
          active: entityData.active ?? true,
          created_at: entityData.createdAt?.toISOString() || "",
          updated_at: entityData.updatedAt?.toISOString() || "",
        });
      }
      setPeriods(periodsData);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [entityId]);

  const autoFill = getAutoFillDates(reportType, parseInt(fiscalYear));

  const handleCreatePeriod = async () => {
    if (!entity || !autoFill) return;
    setCreating(true);
    try {
      const period = await addPeriod({
        entity_id: entity.id,
        jurisdiction_id: entity.jurisdiction_id,
        report_type: reportType,
        period_start: autoFill.period_start,
        period_end: autoFill.period_end,
        due_date: autoFill.due_date,
        fiscal_year: parseInt(fiscalYear),
      });
      toast.success("Report created — starting filing workflow");
      setCreateOpen(false);
      router.push(`/dashboard/entities/${entityId}/periods/${period.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create period");
      setCreating(false);
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
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Start New Report</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Start New Report</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <Select label="Report Type" id="report_type" value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  options={[
                    { value: "half_yearly_h1", label: "H1 Half-Yearly Report (Jan–Jun)" },
                    { value: "half_yearly_h2", label: "H2 Half-Yearly Report (Jul–Dec)" },
                    { value: "annual_plan", label: "Annual Local Content Plan" },
                    { value: "performance_report", label: "Annual Performance Report" },
                  ]}
                />
                <Select label="Fiscal Year" id="fiscal_year" value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  options={[
                    { value: String(currentYear - 1), label: String(currentYear - 1) },
                    { value: String(currentYear), label: String(currentYear) },
                    { value: String(currentYear + 1), label: String(currentYear + 1) },
                  ]}
                />
                {autoFill && (
                  <div className="rounded-lg bg-bg-primary p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Period</span>
                      <span className="text-text-primary font-medium">{autoFill.period_start} to {autoFill.period_end}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Due Date</span>
                      <span className="text-text-primary font-medium">{autoFill.due_date}</span>
                    </div>
                  </div>
                )}
                <Button onClick={handleCreatePeriod} className="w-full" loading={creating} disabled={!autoFill}>
                  Start Filing
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <EntityHeader entity={entity} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Entity Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-text-muted">Registration Number</p><p>{entity.registration_number || "—"}</p></div>
                <div><p className="text-text-muted">Petroleum Agreement</p><p>{entity.petroleum_agreement_ref || "—"}</p></div>
                <div><p className="text-text-muted">Guyanese Ownership</p><p>{entity.guyanese_ownership_pct !== null ? `${entity.guyanese_ownership_pct}%` : "—"}</p></div>
                <div><p className="text-text-muted">Contact</p><p>{entity.contact_name || "—"}</p><p className="text-xs text-text-muted">{entity.contact_email || ""}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">LCS Certificate</CardTitle></CardHeader>
            <CardContent>
              <p className="font-mono text-lg text-accent">{entity.lcs_certificate_id || "—"}</p>
              {entity.lcs_certificate_expiry && (
                <p className="text-sm text-text-muted mt-1">Expires: {format(new Date(entity.lcs_certificate_expiry), "MMM d, yyyy")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-heading font-semibold mb-4">Reporting Periods</h2>
          {periods.length === 0 ? (
            <Card className="text-center py-8"><p className="text-text-muted">No reporting periods yet. Create one to start filing.</p></Card>
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
                    <TableCell className="font-medium">{period.reportType.replace(/_/g, " ").toUpperCase()}</TableCell>
                    <TableCell>{format(new Date(period.periodStart), "MMM d")} – {format(new Date(period.periodEnd), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(period.dueDate), "MMM d, yyyy")}</TableCell>
                    <TableCell><StatusBadge status={period.status as PeriodStatus} /></TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/entities/${entityId}/periods/${period.id}`}>
                        <Button variant="ghost" size="sm">Open <ArrowRight className="h-4 w-4 ml-1" /></Button>
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
