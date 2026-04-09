"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, XCircle, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VerificationResult {
  found: boolean;
  company?: {
    certId: string;
    legalName: string;
    tradingName: string | null;
    status: string;
    expirationDate: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    serviceCategories: string[] | null;
  };
}

interface CertVerificationProps {
  certId: string;
  onCompanyFound?: (company: VerificationResult["company"]) => void;
}

export function CertVerification({ certId, onCompanyFound }: CertVerificationProps) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");

  const lookup = useCallback(async (id: string) => {
    if (id.length < 5) {
      setResult(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/lcs-lookup?cert_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setResult(data);
      setSearched(id);
      if (data.found && data.company && onCompanyFound) {
        onCompanyFound(data.company);
      }
    } catch {
      setResult(null);
    }
    setLoading(false);
  }, [onCompanyFound]);

  // Auto-lookup when certId changes and looks complete (LCSR-XXXXXXXX)
  useEffect(() => {
    const normalized = certId.trim();
    if (normalized !== searched && /^LCSR-[a-f0-9]{8}$/i.test(normalized)) {
      lookup(normalized);
    } else if (normalized.length < 5) {
      setResult(null);
      setSearched("");
    }
  }, [certId, searched, lookup]);

  if (!certId || certId.length < 5) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verifying certificate...
      </div>
    );
  }

  if (!result) return null;

  if (!result.found) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
        <Search className="h-3 w-3" />
        Not found in LCS Register
      </div>
    );
  }

  const company = result.company!;
  const isExpired = company.expirationDate && new Date(company.expirationDate) < new Date();
  const isExpiringSoon = company.expirationDate && !isExpired &&
    new Date(company.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className={cn(
      "rounded-lg border p-3 mt-2 text-sm",
      isExpired
        ? "bg-danger-light border-danger/20"
        : isExpiringSoon
        ? "bg-warning-light border-warning/20"
        : "bg-success-light border-success/20"
    )}>
      <div className="flex items-start gap-2">
        {isExpired ? (
          <XCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
        ) : isExpiringSoon ? (
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text-primary">{company.legalName}</p>
            <Badge variant={isExpired ? "danger" : isExpiringSoon ? "warning" : "success"}>
              {isExpired ? "Expired" : company.status === "approved" ? "Verified" : company.status || "Unknown"}
            </Badge>
          </div>
          {company.tradingName && (
            <p className="text-xs text-text-muted">Trading as: {company.tradingName}</p>
          )}
          <div className="flex gap-4 mt-1.5 text-xs text-text-secondary">
            <span>Cert: {company.certId}</span>
            {company.expirationDate && (
              <span className={isExpired ? "text-danger font-medium" : ""}>
                {isExpired ? "Expired" : "Expires"}: {company.expirationDate}
              </span>
            )}
          </div>
          {company.serviceCategories && company.serviceCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {company.serviceCategories.slice(0, 3).map((cat, i) => (
                <Badge key={i} variant="default" className="text-xs">{cat}</Badge>
              ))}
              {company.serviceCategories.length > 3 && (
                <span className="text-xs text-text-muted">+{company.serviceCategories.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
