"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ExpenditureRecord, SectorCategory } from "@/types/database.types";

interface ExpenditureTableProps {
  records: ExpenditureRecord[];
  categories: SectorCategory[];
  onDelete: (id: string) => void;
}

export function ExpenditureTable({ records, categories, onDelete }: ExpenditureTableProps) {
  const getCategoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? `${cat.code} - ${cat.name}` : id;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Sector Category</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>LCS Cert</TableHead>
          <TableHead>Guyanese</TableHead>
          <TableHead>Sole Sourced</TableHead>
          <TableHead className="text-right">Amount (GYD)</TableHead>
          <TableHead className="text-right">Amount (USD)</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, i) => (
          <TableRow key={record.id}>
            <TableCell className="text-text-muted">{i + 1}</TableCell>
            <TableCell className="text-xs max-w-[200px] truncate">
              {getCategoryName(record.sector_category_id)}
            </TableCell>
            <TableCell className="font-medium">{record.supplier_name}</TableCell>
            <TableCell className="font-mono text-xs">
              {record.supplier_lcs_cert_id || "—"}
            </TableCell>
            <TableCell>
              <Badge variant={record.is_guyanese_supplier ? "success" : "default"}>
                {record.is_guyanese_supplier ? "Yes" : "No"}
              </Badge>
            </TableCell>
            <TableCell>
              {record.is_sole_sourced ? (
                <Badge variant="warning">
                  {record.sole_source_code || "Yes"}
                </Badge>
              ) : (
                "No"
              )}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatCurrency(record.amount_local, "GYD")}
            </TableCell>
            <TableCell className="text-right font-mono text-text-muted">
              {record.amount_usd ? formatCurrency(record.amount_usd, "USD") : "—"}
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
