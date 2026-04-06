"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CsvImportProps {
  type: "expenditure" | "employment";
  periodId: string;
  entityId: string;
  onImported: () => void;
}

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

const TEMPLATES: Record<string, string[]> = {
  expenditure: ["type_of_item_procured", "related_sector", "description", "supplier_name", "supplier_certificate_id", "actual_payment", "outstanding_payment", "payment_method", "currency"],
  employment: ["job_title", "employment_category", "classification", "total_employees", "guyanese_employed", "remuneration", "remuneration_guyanese"],
};

export function CsvImport({ type, periodId, entityId, onImported }: CsvImportProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result as string);
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, periodId, entityId, rows }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ imported: data.imported, skipped: data.skipped });
        toast.success(`Imported ${data.imported} records`);
        onImported();
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch {
      toast.error("Import failed");
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const headers = TEMPLATES[type];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lca_desk_${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="h-3.5 w-3.5" /> Import CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-accent" />
              Import {type === "expenditure" ? "Expenditure" : "Employment"} Records
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-accent/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="h-8 w-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-primary font-medium">Upload CSV file</p>
              <p className="text-xs text-text-muted mt-1">CSV with headers matching the template</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

            <button onClick={downloadTemplate} className="text-xs text-accent hover:text-accent-hover">
              Download CSV template →
            </button>

            {rows.length > 0 && !result && (
              <div className="bg-bg-primary rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-text-primary">{rows.length} rows parsed</p>
                  <Badge variant="accent">{Object.keys(rows[0]).length} columns</Badge>
                </div>
                <div className="text-xs text-text-muted space-y-0.5">
                  <p>Columns: {Object.keys(rows[0]).join(", ")}</p>
                  <p>Preview: {rows[0][Object.keys(rows[0])[0]]} — {rows[0][Object.keys(rows[0])[1]]}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-success-light rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{result.imported} records imported</p>
                  {result.skipped > 0 && <p className="text-xs text-text-muted">{result.skipped} rows skipped (errors)</p>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setOpen(false); setRows([]); setResult(null); }}>
                {result ? "Done" : "Cancel"}
              </Button>
              {!result && rows.length > 0 && (
                <Button onClick={handleImport} loading={importing}>
                  Import {rows.length} Records
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
