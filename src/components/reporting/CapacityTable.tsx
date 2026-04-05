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
          <TableHead>Type</TableHead>
          <TableHead>Activity Name</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Local/Intl</TableHead>
          <TableHead className="text-right">Participants</TableHead>
          <TableHead className="text-right">Guyanese</TableHead>
          <TableHead className="text-right">Hours</TableHead>
          <TableHead className="text-right">Cost (GYD)</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, i) => (
          <TableRow key={record.id}>
            <TableCell className="text-text-muted">{i + 1}</TableCell>
            <TableCell>
              <Badge variant="default">{record.activity_type.replace(/_/g, " ")}</Badge>
            </TableCell>
            <TableCell className="font-medium">{record.activity_name}</TableCell>
            <TableCell>{record.provider_name || "—"}</TableCell>
            <TableCell>
              {record.provider_type ? (
                <Badge variant={record.provider_type === "local" ? "success" : "warning"}>
                  {record.provider_type}
                </Badge>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-right">{record.participant_count}</TableCell>
            <TableCell className="text-right">{record.guyanese_participant_count}</TableCell>
            <TableCell className="text-right">{record.total_hours || "—"}</TableCell>
            <TableCell className="text-right font-mono">
              {record.cost_local ? formatCurrency(record.cost_local, "GYD") : "—"}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(record.id)}
                className="text-danger hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
