"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { LocalContentMetrics } from "@/types/reporting.types";

interface LocalContentRateCardProps {
  metrics: LocalContentMetrics;
  currencyCode?: string;
}

export function LocalContentRateCard({ metrics, currencyCode = "GYD" }: LocalContentRateCardProps) {
  const rateColor =
    metrics.local_content_rate >= 70
      ? "bg-success"
      : metrics.local_content_rate >= 50
      ? "bg-warning"
      : "bg-danger";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text-secondary">Local Content Rate</h4>
        <span className="text-2xl font-bold text-gold">
          {formatPercentage(metrics.local_content_rate)}
        </span>
      </div>
      <Progress value={metrics.local_content_rate} indicatorClassName={rateColor} className="mb-4" />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-text-muted">Total</p>
          <p className="font-medium">{formatCurrency(metrics.total_expenditure, currencyCode)}</p>
        </div>
        <div>
          <p className="text-text-muted">Guyanese</p>
          <p className="font-medium text-success">{formatCurrency(metrics.guyanese_expenditure, currencyCode)}</p>
        </div>
        <div>
          <p className="text-text-muted">Guyanese Suppliers</p>
          <p className="font-medium">{metrics.supplier_count_guyanese}</p>
        </div>
        <div>
          <p className="text-text-muted">Non-Guyanese Suppliers</p>
          <p className="font-medium">{metrics.supplier_count_non_guyanese}</p>
        </div>
      </div>
    </Card>
  );
}
