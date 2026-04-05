"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CapacityDevelopmentRecord } from "@/types/database.types";

interface CapacityTableProps {
  records: CapacityDevelopmentRecord[];
  onDelete: (id: string) => void;
}

export function CapacityTable({ records, onDelete }: CapacityTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Activity</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Participant Type</TableHead>
          <TableHead className="text-right">Guyanese</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead className="text-right">Days</TableHead>
          <TableHead className="text-right">Expenditure</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r, i) => (
          <TableRow key={r.id}>
            <TableCell className="text-text-muted">{i + 1}</TableCell>
            <TableCell className="font-medium">{r.activity}</TableCell>
            <TableCell>{r.category || "—"}</TableCell>
            <TableCell>
              {r.participant_type ? (
                <Badge variant="default">{r.participant_type}</Badge>
              ) : "—"}
            </TableCell>
            <TableCell className="text-right">{r.guyanese_participants_only}</TableCell>
            <TableCell className="text-right">{r.total_participants}</TableCell>
            <TableCell>{r.start_date || "—"}</TableCell>
            <TableCell className="text-right">{r.duration_days || "—"}</TableCell>
            <TableCell className="text-right font-mono">
              {r.expenditure_on_capacity ? formatCurrency(r.expenditure_on_capacity, "GYD") : "—"}
            </TableCell>
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
