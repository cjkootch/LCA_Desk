"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { getCompanyLogoUrl } from "@/lib/company-logos";

interface CompanyLogoProps {
  companyName: string;
  size?: number;
  className?: string;
}

export function CompanyLogo({ companyName, size = 32, className }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const logoUrl = getCompanyLogoUrl(companyName, size * 2); // 2x for retina

  if (!logoUrl || failed) {
    return (
      <div
        className={`rounded-lg bg-bg-primary flex items-center justify-center shrink-0 ${className || ""}`}
        style={{ width: size, height: size }}
      >
        <Building2 className="text-text-muted" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={companyName}
      width={size}
      height={size}
      className={`rounded-lg bg-white object-contain shrink-0 ${className || ""}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
