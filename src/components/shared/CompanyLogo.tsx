"use client";

import { useState } from "react";
import { Factory } from "lucide-react";
import { getCompanyDomain } from "@/lib/company-logos";

interface CompanyLogoProps {
  companyName: string;
  size?: number;
  className?: string;
}

function getLogoUrls(domain: string): string[] {
  return [
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}

export function CompanyLogo({ companyName, size = 32, className }: CompanyLogoProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const domain = getCompanyDomain(companyName);
  const urls = domain ? getLogoUrls(domain) : [];
  const isUnknown = companyName === "Unknown" || !companyName;

  if (!domain || allFailed || isUnknown) {
    if (isUnknown) {
      return (
        <div
          className={`rounded-md bg-border-light flex items-center justify-center shrink-0 ${className || ""}`}
          style={{ width: size, height: size }}
        >
          <Factory className="text-text-muted" style={{ width: size * 0.55, height: size * 0.55 }} />
        </div>
      );
    }

    // Known company but no domain / all sources failed — colored initial
    const colors = ["#047857", "#2563EB", "#D97706", "#7C3AED", "#0891B2", "#4F46E5", "#059669", "#0D9488"];
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
      src={urls[srcIndex]}
      alt={companyName}
      width={size}
      height={size}
      className={`rounded-md border border-border-light bg-white object-contain shrink-0 ${className || ""}`}
      style={{ width: size, height: size }}
      onError={() => {
        if (srcIndex < urls.length - 1) {
          setSrcIndex(srcIndex + 1);
        } else {
          setAllFailed(true);
        }
      }}
    />
  );
}
