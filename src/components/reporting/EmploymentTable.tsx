"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { EmploymentRecord } from "@/types/database.types";

interface EmploymentTableProps {
  records: EmploymentRecord[];
  onDelete: (id: string) => void;
  onEdit?: (record: EmploymentRecord) => void;
}

const CATEGORY_VARIANT: Record<string, "accent" | "gold" | "default"> = {
  Managerial: "accent",
  Technical: "gold",
  "Non-Technical": "default",
};

export function EmploymentTable({ records, onDelete, onEdit }: EmploymentTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Job Title</TableHead>
          <TableHead>Employment Category</TableHead>
          <TableHead>Classification</TableHead>
          <TableHead>Related Company</TableHead>
          <TableHead className="text-right">Total Employees</TableHead>
          <TableHead className="text-right">Guyanese Employed</TableHead>
          <TableHead className="text-right">Total Remuneration</TableHead>
          <TableHead className="text-right">Remuneration (Guyanese)</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((r, i) => (
          <TableRow key={r.id}>
            <TableCell className="text-text-muted">{i + 1}</TableCell>
            <TableCell className="font-medium">{r.job_title}</TableCell>
            <TableCell>
              <Badge variant={CATEGORY_VARIANT[r.employment_category] || "default"}>
                {r.employment_category}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{r.employment_classification || "—"}</TableCell>
            <TableCell>{r.related_company || "—"}</TableCell>
            <TableCell className="text-right font-mono">{r.total_employees}</TableCell>
            <TableCell className="text-right font-mono">{r.guyanese_employed}</TableCell>
            <TableCell className="text-right font-mono">
              {r.total_remuneration_paid ? formatCurrency(r.total_remuneration_paid, "GYD") : "—"}
            </TableCell>
            <TableCell className="text-right font-mono">
              {r.remuneration_guyanese_only ? formatCurrency(r.remuneration_guyanese_only, "GYD") : "—"}
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onDelete(r.id)} className="text-danger hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
