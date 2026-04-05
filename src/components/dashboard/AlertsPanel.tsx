"use client";

import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Alert {
  level: "error" | "warning" | "info";
  entity_name: string;
  message: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
}

const LEVEL_CONFIG = {
  error: { icon: XCircle, color: "text-danger", bg: "bg-danger-light" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning-light" },
  info: { icon: Info, color: "text-accent", bg: "bg-accent-light" },
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <CardTitle className="text-base">Compliance Alerts</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const config = LEVEL_CONFIG[alert.level];
            const Icon = config.icon;
            return (
              <div
                key={i}
                className={cn("flex items-start gap-3 rounded-lg p-3 text-sm", config.bg)}
              >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                <div>
                  <span className="font-medium text-text-primary">{alert.entity_name}:</span>{" "}
                  <span className="text-text-secondary">{alert.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
