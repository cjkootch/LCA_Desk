"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface FilingItem {
  entityName: string;
  reportType: string;
  status: string;
}

interface FilingProgressProps {
  filings: FilingItem[];
}

const STATUS_PROGRESS: Record<string, number> = {
  not_started: 0,
  in_progress: 40,
  review: 70,
  submitted: 100,
  acknowledged: 100,
};

const STATUS_VARIANT: Record<string, "default" | "accent" | "warning" | "success"> = {
  not_started: "default",
  in_progress: "accent",
  review: "warning",
  submitted: "success",
  acknowledged: "success",
};

export function FilingProgress({ filings }: FilingProgressProps) {
  const inProgress = filings.filter((f) => f.status !== "submitted" && f.status !== "acknowledged");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Filing Progress</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {inProgress.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No filings in progress</p>
        ) : (
          <div className="space-y-4">
            {inProgress.slice(0, 5).map((filing, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm">
                    <span className="font-medium text-text-primary">{filing.entityName}</span>
                    <span className="text-text-muted ml-2 text-xs">
                      {filing.reportType.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <Badge variant={STATUS_VARIANT[filing.status] || "default"}>
                    {filing.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <Progress value={STATUS_PROGRESS[filing.status] || 0} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
