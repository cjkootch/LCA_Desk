"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { EmploymentRecord } from "@/types/database.types";

interface EmploymentTableProps {
  records: EmploymentRecord[];
  onDelete: (id: string) => void;
}

const POSITION_TYPE_LABEL: Record<string, string> = {
  managerial: "Managerial",
  technical: "Technical",
  non_technical: "Non-Technical",
};

export function EmploymentTable({ records, onDelete }: EmploymentTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Job Title</TableHead>
          <TableHead>ISCO-08</TableHead>
          <TableHead>Position Type</TableHead>
          <TableHead>Guyanese</TableHead>
          <TableHead>Nationality</TableHead>
          <TableHead className="text-right">Headcount</TableHead>
          <TableHead>Band</TableHead>
          <TableHead className="text-right">Remuneration (GYD)</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, i) => (
          <TableRow key={record.id}>
            <TableCell className="text-text-muted">{i + 1}</TableCell>
            <TableCell className="font-medium">{record.job_title}</TableCell>
            <TableCell className="font-mono text-xs">{record.isco_08_code || "—"}</TableCell>
            <TableCell>
              <Badge variant="default">{POSITION_TYPE_LABEL[record.position_type] || record.position_type}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={record.is_guyanese ? "success" : "default"}>
                {record.is_guyanese ? "Yes" : "No"}
              </Badge>
            </TableCell>
            <TableCell>{record.is_guyanese ? "GY" : record.nationality || "—"}</TableCell>
            <TableCell className="text-right font-mono">{record.headcount}</TableCell>
            <TableCell>{record.remuneration_band || "—"}</TableCell>
            <TableCell className="text-right font-mono">
              {record.total_remuneration_local
                ? formatCurrency(record.total_remuneration_local, "GYD")
                : "—"}
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
