"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { PeriodChecklist } from "@/components/reporting/PeriodChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { calculateLocalContentRate, calculateEmploymentMetrics, calculateCapacityMetrics } from "@/lib/compliance/calculators";
import { formatSubmissionSubject } from "@/lib/compliance/jurisdiction-config";
import type { Entity, ReportingPeriod, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";

export default function ExportPage() {
  const params = useParams();
  const entityId = params.entityId as string;
  const periodId = params.periodId as string;
  const [entity, setEntity] = useState<Entity | null>(null);
  const [period, setPeriod] = useState<ReportingPeriod | null>(null);
  const [expenditures, setExpenditures] = useState<ExpenditureRecord[]>([]);
  const [employment, setEmployment] = useState<EmploymentRecord[]>([]);
  const [capacity, setCapacity] = useState<CapacityDevelopmentRecord[]>([]);
  const [narratives, setNarratives] = useState<NarrativeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const [entityRes, periodRes, expRes, empRes, capRes, narRes] = await Promise.all([
        supabase.from("entities").select("*").eq("id", entityId).single(),
        supabase.from("reporting_periods").select("*").eq("id", periodId).single(),
        supabase.from("expenditure_records").select("*").eq("reporting_period_id", periodId),
        supabase.from("employment_records").select("*").eq("reporting_period_id", periodId),
        supabase.from("capacity_development_records").select("*").eq("reporting_period_id", periodId),
        supabase.from("narrative_drafts").select("*").eq("reporting_period_id", periodId),
      ]);
      setEntity(entityRes.data);
      setPeriod(periodRes.data);
      setExpenditures(expRes.data || []);
      setEmployment(empRes.data || []);
      setCapacity(capRes.data || []);
      setNarratives(narRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [entityId, periodId, supabase]);

  const buildExportData = () => {
    if (!entity || !period) return null;
    return {
      entity,
      period,
      expenditures,
      employment,
      capacity,
      sectorCategories: [],
      jurisdictionCode: "GY",
      localContentMetrics: calculateLocalContentRate(expenditures),
      employmentMetrics: calculateEmploymentMetrics(employment),
      capacityMetrics: calculateCapacityMetrics(capacity),
      narratives: {
        expenditure: narratives.find((n) => n.section === "expenditure_narrative")?.draft_content || "",
        employment: narratives.find((n) => n.section === "employment_narrative")?.draft_content || "",
        capacity: narratives.find((n) => n.section === "capacity_narrative")?.draft_content || "",
      },
    };
  };

  const handleExportExcel = async () => {
    const data = buildExportData();
    if (!data) return;
    setExporting("excel");

    try {
      const response = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LCA_Report_${entity!.legal_name}_${period!.report_type}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Failed to export Excel report");
    }
    setExporting(null);
  };

  const handleExportPdf = async () => {
    const data = buildExportData();
    if (!data) return;
    setExporting("pdf");

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LCA_Narrative_${entity!.legal_name}_${period!.report_type}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF narrative downloaded");
    } catch {
      toast.error("Failed to export PDF");
    }
    setExporting(null);
  };

  const handleMarkSubmitted = async () => {
    if (!period) return;

    await supabase
      .from("reporting_periods")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", periodId);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("submission_logs").insert({
        reporting_period_id: periodId,
        entity_id: entityId,
        submitted_by: user.id,
        submission_method: "email",
        submitted_to_email: "localcontent@nre.gov.gy",
        email_subject: formatSubmissionSubject(
          "GY",
          period.report_type === "half_yearly_h1" ? "H1 " + period.fiscal_year : "H2 " + period.fiscal_year,
          entity!.legal_name
        ),
        status: "sent",
      });
    }

    setPeriod({ ...period, status: "submitted", submitted_at: new Date().toISOString() });
    toast.success("Report marked as submitted");
  };

  if (loading || !entity || !period) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const periodLabel = period.report_type === "half_yearly_h1" ? "H1" : "H2";
  const subjectLine = formatSubmissionSubject("GY", `${periodLabel} ${period.fiscal_year}`, entity.legal_name);

  return (
    <div>
      <TopBar title={`${entity.legal_name} — Export & Submit`} />
      <div className="p-8">
        <PageHeader
          title="Export & Submit"
          description="Generate official reports and submit to the Local Content Secretariat."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: entity.legal_name, href: `/dashboard/entities/${entityId}` },
            { label: "Export" },
          ]}
        />

        <PeriodChecklist
          entityId={entityId}
          periodId={periodId}
          currentStep="export"
          completedSteps={["company_info", "expenditure", "employment", "capacity", "narrative", "review"]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Excel Export */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <FileSpreadsheet className="h-6 w-6 text-success" />
                </div>
                <div>
                  <CardTitle className="text-base">Excel Report</CardTitle>
                  <p className="text-sm text-text-muted mt-1">Secretariat Version 4.1 format</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary mb-4">
                Generates the official half-yearly report Excel file with Background, General Information,
                Expenditure, Employment, and Capacity Development worksheets.
              </p>
              <Button onClick={handleExportExcel} loading={exporting === "excel"} className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download Excel Report
              </Button>
            </CardContent>
          </Card>

          {/* PDF Export */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-danger/10">
                  <FileText className="h-6 w-6 text-danger" />
                </div>
                <div>
                  <CardTitle className="text-base">Narrative PDF</CardTitle>
                  <p className="text-sm text-text-muted mt-1">Comparative Analysis Report</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary mb-4">
                Generates the Comparative Analysis Report as a professional PDF with company information,
                narrative sections, and signature block.
              </p>
              <Button onClick={handleExportPdf} variant="secondary" loading={exporting === "pdf"} className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Download Narrative PDF
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Submission Instructions */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-accent" />
              <CardTitle className="text-base">Submission Instructions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-text-secondary">
                Submit both files (Excel report + Narrative PDF) via email:
              </p>
              <div className="bg-bg-surface rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-text-muted w-16 shrink-0">To:</span>
                  <span className="font-mono text-accent">localcontent@nre.gov.gy</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-text-muted w-16 shrink-0">Subject:</span>
                  <span className="font-mono text-text-primary text-xs">{subjectLine}</span>
                </div>
              </div>
              <p className="text-text-muted text-xs">
                Keep the Secretariat acknowledgement email for your records. Upload it here once received.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mark as Submitted */}
        {period.status !== "submitted" && period.status !== "acknowledged" ? (
          <Button onClick={handleMarkSubmitted} size="lg" className="w-full">
            <CheckCircle className="h-5 w-5 mr-2" />
            Mark as Submitted
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-success py-4">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Report submitted</span>
            {period.submitted_at && (
              <span className="text-text-muted text-sm">
                on {new Date(period.submitted_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
