"use client";

import { Badge } from "@/components/ui/badge";
import type { Entity } from "@/types/database.types";

interface EntityHeaderProps {
  entity: Entity;
}

const TYPE_VARIANT: Record<string, "accent" | "warning" | "gold"> = {
  contractor: "accent",
  subcontractor: "warning",
  licensee: "gold",
};

export function EntityHeader({ entity }: EntityHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            {entity.legal_name}
          </h1>
          {entity.company_type && (
            <Badge variant={TYPE_VARIANT[entity.company_type] || "default"}>
              {entity.company_type}
            </Badge>
          )}
        </div>
        {entity.trading_name && (
          <p className="text-text-muted mt-1">Trading as {entity.trading_name}</p>
        )}
      </div>
      <div className="text-right text-sm">
        <p className="text-text-secondary">
          LCS Cert: <span className="text-text-primary font-mono">{entity.lcs_certificate_id || "—"}</span>
        </p>
        {entity.registration_number && (
          <p className="text-text-muted">Reg: {entity.registration_number}</p>
        )}
      </div>
    </div>
  );
}
