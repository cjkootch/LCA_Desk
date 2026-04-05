"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ExpenditureRecord } from "@/types/database.types";

interface ExpenditureTableProps {
  records: ExpenditureRecord[];
  onDelete: (id: string) => void;
}

export function ExpenditureTable({ records, onDelete }: ExpenditureTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Type of Item</TableHead>
          <TableHead>Related Sector</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Certificate ID</TableHead>
          <TableHead className="text-right">Actual Payment</TableHead>
          <TableHead className="text-right">Outstanding</TableHead>
          <TableHead>Currency</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r, i) => (
          <TableRow key={r.id}>
            <TableCell className="text-text-muted">{i + 1}</TableCell>
            <TableCell className="font-medium max-w-[180px] truncate">{r.type_of_item_procured}</TableCell>
            <TableCell className="text-xs max-w-[160px] truncate">{r.related_sector || "—"}</TableCell>
            <TableCell>{r.supplier_name}</TableCell>
            <TableCell className="font-mono text-xs">{r.supplier_certificate_id || "—"}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(r.actual_payment, r.currency_of_payment)}</TableCell>
            <TableCell className="text-right font-mono">{r.outstanding_payment ? formatCurrency(r.outstanding_payment, r.currency_of_payment) : "—"}</TableCell>
            <TableCell className="text-xs">{r.currency_of_payment}</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" onClick={() => onDelete(r.id)} className="text-danger hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
