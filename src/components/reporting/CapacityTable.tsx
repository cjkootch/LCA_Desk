"use client";

import { useRef, useEffect, useCallback } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, ClipboardPaste } from "lucide-react";
import { InlineCell } from "./InlineCell";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { CapacityDevelopmentRecord } from "@/types/database.types";

interface CapacityTableProps {
  records: CapacityDevelopmentRecord[];
  onDelete: (id: string) => void;
  onEdit?: (record: CapacityDevelopmentRecord) => void;
  onInlineUpdate?: (id: string, field: string, value: string | number) => Promise<void>;
  onPasteRows?: (rows: Record<string, string>[]) => Promise<void>;
  locked?: boolean;
}

export function CapacityTable({ records, onDelete, onEdit, onInlineUpdate, onPasteRows, locked }: CapacityTableProps) {
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
    const isHeader = firstRow.some(c => /activity|category|participant|training/i.test(c));

    let parsed: Record<string, string>[];
    if (isHeader && rows.length > 1) {
      parsed = rows.slice(1).map(cells => {
        const row: Record<string, string> = {};
        firstRow.forEach((h, i) => { row[h] = cells[i] || ""; });
        return row;
      });
    } else {
      parsed = rows.map(cells => ({
        activity: cells[0] || "Training",
        category: cells[1] || "",
        total_participants: cells[2] || "0",
        guyanese_participants: cells[3] || "0",
        duration_days: cells[4] || "0",
      }));
    }

    try {
      await onPasteRows(parsed);
      toast.success(`${parsed.length} capacity records pasted`);
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
            <TableHead>Activity</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Participant Type</TableHead>
            <TableHead className="text-right">GY</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Start</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            {!locked && <TableHead className="w-16">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow key={r.id} className="group">
              <TableCell className="text-text-muted text-xs">{i + 1}</TableCell>
              <TableCell>
                {onInlineUpdate ? (
                  <InlineCell value={r.activity} field="activity" recordId={r.id} onSave={handleInlineSave} locked={locked} className="text-sm font-medium" />
                ) : (
                  <span className="font-medium">{r.activity}</span>
                )}
              </TableCell>
              <TableCell className="text-xs">{r.category || "—"}</TableCell>
              <TableCell>
                {r.participant_type ? <Badge variant="default" className="text-[9px]">{r.participant_type}</Badge> : "—"}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <InlineCell value={r.guyanese_participants_only} field="guyanese_participants_only" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono" />
                ) : (
                  <span className="font-mono">{r.guyanese_participants_only}</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <InlineCell value={r.total_participants} field="total_participants" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono" />
                ) : (
                  <span className="font-mono">{r.total_participants}</span>
                )}
              </TableCell>
              <TableCell className="text-xs">{r.start_date || "—"}</TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <InlineCell value={r.duration_days} field="duration_days" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono" />
                ) : (
                  <span className="font-mono">{r.duration_days || "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">
                {r.expenditure_on_capacity ? formatCurrency(r.expenditure_on_capacity, "GYD") : "—"}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
