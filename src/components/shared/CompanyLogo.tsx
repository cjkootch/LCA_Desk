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
  const logoUrl = getCompanyLogoUrl(companyName, size * 2);

  if (!logoUrl || failed) {
    return (
      <div
        className={`rounded-md bg-bg-primary border border-border-light flex items-center justify-center shrink-0 ${className || ""}`}
        style={{ width: size, height: size }}
      >
        <span className="font-bold text-text-muted" style={{ fontSize: size * 0.35 }}>
          {companyName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={logoUrl}
      alt={companyName}
      width={size}
      height={size}
      className={`rounded-md border border-border-light bg-white object-contain shrink-0 ${className || ""}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
