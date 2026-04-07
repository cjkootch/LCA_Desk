"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";

interface SpreadsheetImportProps {
  type: "expenditure" | "employment" | "capacity" | "all";
  periodId: string;
  entityId: string;
  onImported: () => void;
}

const CSV_TEMPLATES: Record<string, string[]> = {
  expenditure: ["type_of_item_procured", "related_sector", "description", "supplier_name", "supplier_certificate_id", "actual_payment", "outstanding_payment", "payment_method", "currency"],
  employment: ["job_title", "employment_category", "classification", "total_employees", "guyanese_employed", "remuneration", "remuneration_guyanese"],
  capacity: ["activity", "category", "participant_type", "guyanese_participants", "total_participants", "start_date", "duration_days", "cost_to_participants", "expenditure_on_capacity"],
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  }).filter(row => Object.values(row).some(v => v.length > 0));
}

export function CsvImport({ type, periodId, entityId, onImported }: SpreadsheetImportProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    format?: string;
    details?: { expenditures: number; employment: number; capacity: number };
    generalInfo?: { companyName?: string; reportingPeriod?: string } | null;
    warnings?: string[];
  } | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setImporting(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "xlsx" || ext === "xls") {
        // ── Excel import via multipart form ──
        const formData = new FormData();
        formData.append("file", file);
        formData.append("periodId", periodId);
        formData.append("entityId", entityId);
        formData.append("type", type);

        const res = await fetch("/api/import", { method: "POST", body: formData });
        const data = await res.json();

        if (data.success) {
          setResult({
            imported: data.imported,
            skipped: data.skipped,
            format: data.format,
            details: data.details,
            generalInfo: data.generalInfo,
            warnings: data.warnings,
          });
          toast.success(`Imported ${data.imported} records from Excel`);
          onImported();
        } else {
          toast.error(data.error || "Import failed");
        }
      } else if (ext === "csv") {
        // ── CSV import (legacy) ──
        const text = await file.text();
        const rows = parseCsv(text);
        if (rows.length === 0) { toast.error("No data found in CSV"); setImporting(false); return; }

        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: type === "all" ? "expenditure" : type, periodId, entityId, rows }),
        });
        const data = await res.json();

        if (data.success) {
          setResult({ imported: data.imported, skipped: data.skipped });
          toast.success(`Imported ${data.imported} records`);
          onImported();
        } else {
          toast.error(data.error || "Import failed");
        }
      } else {
        toast.error("Unsupported file type. Use .xlsx, .xls, or .csv");
      }
    } catch {
      toast.error("Import failed");
    }

    setImporting(false);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const templateType = type === "all" ? "expenditure" : type;
    const headers = CSV_TEMPLATES[templateType];
    if (!headers) return;
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lca_desk_${templateType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="h-3.5 w-3.5" /> Import
      </Button>

      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setResult(null); setFileName(""); } else setOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-accent" />
              Import {type === "all" ? "All Records" : type === "expenditure" ? "Expenditure" : type === "employment" ? "Employment" : "Capacity"} Records
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Upload zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-accent/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {importing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
                  <p className="text-sm text-text-muted">Importing {fileName}...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-primary font-medium">Upload spreadsheet</p>
                  <p className="text-xs text-text-muted mt-1">
                    Accepts the <strong>LCS Secretariat Excel template (v4.1)</strong> or any .xlsx / .csv file
                  </p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />

            {/* Secretariat template note */}
            <div className="bg-accent-light rounded-lg p-3 flex items-start gap-2">
              <FileText className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-text-primary">Using the Secretariat template?</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Upload the official v4.1 Excel file directly. We auto-detect the Expenditure, Employment, and Capacity Development tabs and import all records at once.
                </p>
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className="space-y-3">
                <div className="bg-success-light rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{result.imported} records imported</p>
                    {result.skipped > 0 && <p className="text-xs text-text-muted">{result.skipped} rows skipped (errors)</p>}
                  </div>
                </div>

                {result.format === "secretariat_v4" && (
                  <Badge variant="accent" className="text-[10px]">Detected: LCS Secretariat v4.1 Template</Badge>
                )}

                {result.details && (result.details.expenditures > 0 || result.details.employment > 0 || result.details.capacity > 0) && (
                  <div className="text-xs text-text-muted space-y-0.5">
                    {result.details.expenditures > 0 && <p>{result.details.expenditures} expenditure records</p>}
                    {result.details.employment > 0 && <p>{result.details.employment} employment records</p>}
                    {result.details.capacity > 0 && <p>{result.details.capacity} capacity development records</p>}
                  </div>
                )}

                {result.generalInfo?.companyName && (
                  <p className="text-xs text-text-muted">Company: {result.generalInfo.companyName} · Period: {result.generalInfo.reportingPeriod}</p>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <div className="bg-warning-light rounded-lg p-2">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-warning flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              {type !== "all" && (
                <button onClick={downloadTemplate} className="text-xs text-accent hover:text-accent-hover">
                  Download CSV template →
                </button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => { setOpen(false); setResult(null); setFileName(""); }}>
                {result ? "Done" : "Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
