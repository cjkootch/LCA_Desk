"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, AlertTriangle, XCircle, Info, CheckCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanIssue {
  level: "error" | "warning" | "info";
  category: string;
  title: string;
  detail: string;
  recommendation: string;
}

interface ComplianceScanProps {
  scanData: Record<string, unknown>;
}

const LEVEL_CONFIG = {
  error: { icon: XCircle, color: "text-danger", bg: "bg-danger-light", border: "border-danger/20" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning-light", border: "border-warning/20" },
  info: { icon: Info, color: "text-accent", bg: "bg-accent-light", border: "border-accent/20" },
};

export function ComplianceScan({ scanData }: ComplianceScanProps) {
  const [issues, setIssues] = useState<ScanIssue[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const runScan = async () => {
    setScanning(true);
    setIssues([]);

    try {
      const response = await fetch("/api/ai/compliance-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: scanData }),
      });

      if (!response.ok) throw new Error("Scan failed");

      const text = await response.text();
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setIssues(parsed);
      }
    } catch {
      setIssues([{
        level: "info",
        category: "general",
        title: "Scan unavailable",
        detail: "Could not complete AI compliance scan. Please review manually.",
        recommendation: "Check all fields against the Version 4.1 Guideline before submission.",
      }]);
    }

    setScanning(false);
    setScanned(true);
  };

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">AI Compliance Scan</CardTitle>
          </div>
          <Button
            onClick={runScan}
            loading={scanning}
            disabled={scanning}
            size="sm"
            variant={scanned ? "outline" : "primary"}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {scanned ? "Re-scan" : "Run AI Scan"}
          </Button>
        </div>
        <p className="text-sm text-text-muted mt-1">
          AI analyzes your submission data and flags issues the Secretariat is likely to scrutinize.
        </p>
      </CardHeader>
      <CardContent>
        {!scanned && !scanning && (
          <div className="text-center py-8 text-text-muted text-sm">
            Click &quot;Run AI Scan&quot; to check your submission for compliance issues before filing.
          </div>
        )}

        {scanning && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
            <span className="text-sm text-text-secondary">Analyzing submission data...</span>
          </div>
        )}

        {scanned && !scanning && (
          <div className="space-y-4">
            {/* Summary */}
            {issues.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-success-light text-success">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">No issues detected</p>
                  <p className="text-sm opacity-80">Your submission appears compliant with LCA requirements.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-3 text-sm">
                  {errors.length > 0 && (
                    <span className="text-danger font-medium">{errors.length} critical issue{errors.length !== 1 ? "s" : ""}</span>
                  )}
                  {warnings.length > 0 && (
                    <span className="text-warning font-medium">{warnings.length} warning{warnings.length !== 1 ? "s" : ""}</span>
                  )}
                </div>

                {/* Issues list */}
                <div className="space-y-3">
                  {issues.map((issue, i) => {
                    const config = LEVEL_CONFIG[issue.level];
                    const Icon = config.icon;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border p-4",
                          config.bg,
                          config.border
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
                          <div className="flex-1">
                            <p className="font-medium text-text-primary text-sm">{issue.title}</p>
                            <p className="text-sm text-text-secondary mt-1">{issue.detail}</p>
                            <p className="text-sm text-accent mt-2 font-medium">{issue.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
