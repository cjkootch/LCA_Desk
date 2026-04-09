"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Check, X, ClipboardPaste } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExpenditureRecord } from "@/types/database.types";

interface ExpenditureTableProps {
  records: ExpenditureRecord[];
  onDelete: (id: string) => void;
  onEdit?: (record: ExpenditureRecord) => void;
  onInlineUpdate?: (id: string, field: string, value: string | number) => Promise<void>;
  onPasteRows?: (rows: Record<string, string>[]) => Promise<void>;
  locked?: boolean;
}

// Editable cell types
type EditableField = "supplier_name" | "actual_payment" | "outstanding_payment" | "supplier_certificate_id" | "notes";

const EDITABLE_FIELDS: EditableField[] = ["supplier_name", "actual_payment", "outstanding_payment", "supplier_certificate_id"];

function InlineCell({
  value,
  field,
  recordId,
  isNumeric,
  onSave,
  locked,
  className,
}: {
  value: string | number | null;
  field: string;
  recordId: string;
  isNumeric?: boolean;
  onSave: (id: string, field: string, value: string | number) => Promise<void>;
  locked?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    if (editValue === String(value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const saveValue = isNumeric ? parseFloat(editValue) || 0 : editValue;
      await onSave(recordId, field, saveValue);
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setEditValue(String(value ?? ""));
      setEditing(false);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      handleSave();
    }
  };

  if (locked || !onSave) {
    return <span className={className}>{isNumeric && value ? formatCurrency(Number(value)) : (value || "—")}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={isNumeric ? "number" : "text"}
        step={isNumeric ? "0.01" : undefined}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={saving}
        className={cn(
          "w-full h-7 px-1.5 rounded border border-accent bg-white text-sm focus:outline-none focus:ring-1 focus:ring-accent",
          isNumeric && "text-right font-mono",
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={() => { setEditValue(String(value ?? "")); setEditing(true); }}
      className={cn("cursor-pointer hover:bg-accent-light rounded px-1 py-0.5 -mx-1 transition-colors", className)}
      title="Click to edit"
    >
      {isNumeric && value ? formatCurrency(Number(value)) : (value || "—")}
    </span>
  );
}

// Parse pasted TSV/CSV from clipboard
function parsePastedData(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map(line => {
    const cells = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ""));
    return cells;
  });

  // Check if first row looks like headers
  const firstRow = rows[0];
  const isHeader = firstRow.some(c =>
    /supplier|payment|amount|type|sector|certificate/i.test(c)
  );

  if (isHeader && rows.length > 1) {
    const headers = firstRow;
    return rows.slice(1).map(cells => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ""; });
      return row;
    });
  }

  // No headers — assume column order: Type, Sector, Description, Supplier, Amount
  return rows.map(cells => ({
    type_of_item_procured: cells[0] || "Goods",
    related_sector: cells[1] || "",
    description_of_good_service: cells[2] || "",
    supplier_name: cells[3] || cells[0] || "Unknown",
    actual_payment: cells[4] || cells[1] || "0",
    supplier_certificate_id: cells[5] || "",
    currency_of_payment: cells[6] || "GYD",
  }));
}

export function ExpenditureTable({ records, onDelete, onEdit, onInlineUpdate, onPasteRows, locked }: ExpenditureTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  // Paste handler
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!onPasteRows || locked) return;

    // Only handle paste when focused on the table area
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;

    // Check if it looks like multi-line data (Excel paste)
    const lines = text.trim().split("\n");
    if (lines.length < 2) return; // Single line — not a paste from Excel

    e.preventDefault();

    const rows = parsePastedData(text);
    if (rows.length === 0) {
      toast.error("Could not parse pasted data");
      return;
    }

    try {
      await onPasteRows(rows);
      toast.success(`${rows.length} records pasted from clipboard`);
    } catch {
      toast.error("Failed to import pasted data");
    }
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
        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2 px-1">
          <ClipboardPaste className="h-3 w-3" />
          <span>Tip: Copy rows from Excel and paste here to bulk-add records</span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Cert ID</TableHead>
            <TableHead className="text-right">Payment</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Ccy</TableHead>
            {!locked && <TableHead className="w-16">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow key={r.id} className="group">
              <TableCell className="text-text-muted text-xs">{i + 1}</TableCell>
              <TableCell className="text-xs max-w-[140px] truncate">{r.type_of_item_procured}</TableCell>
              <TableCell className="text-xs max-w-[120px] truncate">{r.related_sector || "—"}</TableCell>
              <TableCell>
                {onInlineUpdate ? (
                  <InlineCell value={r.supplier_name} field="supplier_name" recordId={r.id} onSave={handleInlineSave} locked={locked} className="text-sm" />
                ) : (
                  <span className="text-sm">{r.supplier_name}</span>
                )}
                {!r.supplier_certificate_id && (r as unknown as Record<string, string>).supplier_type === "Non-Guyanese" && !r.sole_source_code && (
                  <Badge variant="warning" className="text-[11px] ml-1">Sole Source?</Badge>
                )}
              </TableCell>
              <TableCell>
                {(r as unknown as Record<string, string>).supplier_type === "Guyanese" || r.supplier_certificate_id ? (
                  <Badge variant="success" className="text-xs">GY</Badge>
                ) : (r as unknown as Record<string, string>).supplier_type === "Non-Guyanese" ? (
                  <Badge variant="default" className="text-xs">Intl</Badge>
                ) : (
                  <span className="text-text-muted text-xs">—</span>
                )}
              </TableCell>
              <TableCell>
                {onInlineUpdate ? (
                  <InlineCell value={r.supplier_certificate_id} field="supplier_certificate_id" recordId={r.id} onSave={handleInlineSave} locked={locked} className="font-mono text-xs" />
                ) : (
                  <span className="font-mono text-xs">{r.supplier_certificate_id || "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <InlineCell value={r.actual_payment} field="actual_payment" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono text-sm" />
                ) : (
                  <span className="font-mono">{formatCurrency(r.actual_payment, r.currency_of_payment)}</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {onInlineUpdate ? (
                  <InlineCell value={r.outstanding_payment} field="outstanding_payment" recordId={r.id} isNumeric onSave={handleInlineSave} locked={locked} className="font-mono text-sm" />
                ) : (
                  <span className="font-mono">{r.outstanding_payment ? formatCurrency(r.outstanding_payment, r.currency_of_payment) : "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-xs">{r.currency_of_payment}</TableCell>
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
