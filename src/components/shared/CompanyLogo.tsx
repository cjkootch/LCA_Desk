"use client";

import { useState } from "react";
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
    // Generate a consistent color from company name
    const colors = ["#047857", "#2563EB", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#4F46E5", "#059669"];
    const hash = companyName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const bg = colors[hash % colors.length];

    return (
      <div
        className={`rounded-md flex items-center justify-center shrink-0 ${className || ""}`}
        style={{ width: size, height: size, backgroundColor: bg }}
      >
        <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
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
