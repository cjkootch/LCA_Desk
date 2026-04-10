"use client";

import { useMemo } from "react";
import type { Entity, ExpenditureRecord, EmploymentRecord } from "@/types/database.types";
import { calculateLocalContentRate, calculateEmploymentMetrics } from "@/lib/compliance/calculators";
import { getEmploymentMinimums } from "@/lib/compliance/jurisdiction-config";

interface ComplianceAlert {
  level: "error" | "warning" | "info";
  entity_name: string;
  message: string;
}

export function useComplianceAlerts(
  entities: Entity[],
  expendituresByEntity: Record<string, ExpenditureRecord[]>,
  employmentByEntity: Record<string, EmploymentRecord[]>,
  jurisdictionCode: string
): ComplianceAlert[] {
  return useMemo(() => {
    const alerts: ComplianceAlert[] = [];
    const minimums = getEmploymentMinimums(jurisdictionCode);

    for (const entity of entities) {
      // Check LCS certificate expiry
      if (entity.lcs_certificate_expiry) {
        const expiry = new Date(entity.lcs_certificate_expiry);
        const today = new Date();
        const days = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (days < 0) {
          alerts.push({
            level: "error",
            entity_name: entity.legal_name,
            message: `LCS certificate expired ${Math.abs(days)} days ago`,
          });
        } else if (days < 30) {
          alerts.push({
            level: "warning",
            entity_name: entity.legal_name,
            message: `LCS certificate expiring in ${days} days`,
          });
        }
      }

      // Check employment metrics
      const empRecords = employmentByEntity[entity.id] || [];
      if (empRecords.length > 0) {
        const metrics = calculateEmploymentMetrics(empRecords, jurisdictionCode);
        if (metrics.managerial_total > 0 && metrics.managerial_guyanese_pct < minimums.managerial) {
          alerts.push({
            level: "warning",
            entity_name: entity.legal_name,
            message: `Guyanese employment rate of ${metrics.managerial_guyanese_pct.toFixed(0)}% for managerial positions — below the required ${minimums.managerial}%`,
          });
        }
      }

      // Check supplier certs
      const expRecords = expendituresByEntity[entity.id] || [];
      const missingCerts = expRecords.filter(
        (e) => e.sole_source_code && !e.supplier_certificate_id
      );
      if (missingCerts.length > 0) {
        alerts.push({
          level: "warning",
          entity_name: entity.legal_name,
          message: `${missingCerts.length} Guyanese supplier(s) without LCS certificate ID`,
        });
      }
    }

    return alerts;
  }, [entities, expendituresByEntity, employmentByEntity, jurisdictionCode]);
}
