"use client";

import { useRef, useEffect, useCallback } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, ClipboardPaste } from "lucide-react";
import { InlineCell } from "./InlineCell";
import { toast } from "sonner";
import type { EmploymentRecord } from "@/types/database.types";

interface EmploymentTableProps {
  records: EmploymentRecord[];
  onDelete: (id: string) => void;
  onEdit?: (record: EmploymentRecord) => void;
  onInlineUpdate?: (id: string, field: string, value: string | number) => Promise<void>;
  onPasteRows?: (rows: Record<string, string>[]) => Promise<void>;
  locked?: boolean;
}

const CATEGORY_VARIANT: Record<string, "accent" | "gold" | "default"> = {
  Managerial: "accent",
  Technical: "gold",
  "Non-Technical": "default",
};

export function EmploymentTable({ records, onDelete, onEdit, onInlineUpdate, onPasteRows, locked }: EmploymentTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!onPasteRows || locked) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    const text = e.clipboardData?.getData("text/plain");
    if (!text || text.trim().split("\n").length < 2) return;
    e.preventDefault();

    const lines = text.trim().split("\n");
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const rows = lines.map(l => l.split(delimiter).map(c => c.trim().replace(/^"|"$/g, "")));
    const firstRow = rows[0];
    const isHeader = firstRow.some(c => /job|title|category|employee|guyanese/i.test(c));

    let parsed: Record<string, string>[];
    if (isHeader && rows.length > 1) {
      parsed = rows.slice(1).map(cells => {
        const row: Record<string, string> = {};
        firstRow.forEach((h, i) => { row[h] = cells[i] || ""; });
        return row;
      });
    } else {
      parsed = rows.map(cells => ({
        job_title: cells[0] || "Unknown",
        employment_category: cells[1] || "Technical",
        total_employees: cells[2] || "1",
        guyanese_employed: cells[3] || "0",
      }));
    }

    try {
      await onPasteRows(parsed);
      toast.success(`${parsed.length} employment records pasted`);
    } catch { toast.error("Failed to import pasted data"); }
  }, [onPasteRows, locked]);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const handler = handlePaste as unknown as EventListener;
    el.addEventListener("paste", handler);
    return () => el.removeEventListener("paste", handler);
  }, [handlePaste]);

  const handleInlineSave = async (id: string, field: string, value: string | number) => {
    if (!onInlineUpdate) return;
    await onInlineUpdate(id, field, value);
  };

  return (
    <div ref={tableRef} tabIndex={0} className="outline-none">
      {onPasteRows && !locked && (
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-2 px-1">
          <ClipboardPaste className="h-3 w-3" />
          <span>Tip: Copy rows from Excel and paste here to bulk-add records</span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Job Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Classification</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Guyanese</TableHead>
            <TableHead className="text-right">%</TableHead>
            {!locked && <TableHead className="w-16">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => {
            const pct = r.total_employees > 0 ? Math.round((r.guyanese_employed / r.total_employees) * 100) : 0;
            return (
              <TableRow key={r.id} className="group">
                <TableCell className="text-text-muted text-xs">{i + 1}</TableCell>
                <TableCell>
                  {onInlineUpdate ? (
                    <InlineCell value={r.job_title} field="job_title" recordId={r.id} onSave={handleInlineSave} locked={locked} className="text-sm font-medium" />
                  ) : (
                    <span className="font-medium">{r.job_title}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={CATEGORY_VARIANT[r.employment_category] || "default"} className="text-[9px]">
                    {r.employment_category}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.employment_classification || "—"}</TableCell>
                <TableCell className="text-right">
                  {onInlineUpdate ? (
                    <InlineCell value={r.total_employees} field="total_employees" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono" />
                  ) : (
                    <span className="font-mono">{r.total_employees}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {onInlineUpdate ? (
                    <InlineCell value={r.guyanese_employed} field="guyanese_employed" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono" />
                  ) : (
                    <span className="font-mono">{r.guyanese_employed}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className={pct >= 60 ? "text-success font-medium" : "text-warning font-medium"}>{pct}%</span>
                </TableCell>
                {!locked && (
                  <TableCell>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(r)} className="h-7 w-7 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onDelete(r.id)} className="h-7 w-7 p-0 text-danger hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
