"use client";

import { Badge } from "@/components/ui/badge";

interface JurisdictionBadgeProps {
  code: string;
  name?: string;
}

const FLAG_MAP: Record<string, string> = {
  GY: "🇬🇾",
  SR: "🇸🇷",
  NA: "🇳🇦",
  TT: "🇹🇹",
};

export function JurisdictionBadge({ code, name }: JurisdictionBadgeProps) {
  return (
    <Badge variant="default">
      <span className="mr-1">{FLAG_MAP[code] || ""}</span>
      {name || code}
    </Badge>
  );
}
