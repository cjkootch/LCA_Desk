"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyIdentityProps {
  name: string;
  subtitle?: string;
  certId?: string;
  status?: "active" | "trial" | "expired" | "pending";
  planName?: string;
  avatarUrl?: string;
  className?: string;
}

export function CompanyIdentity({
  name, subtitle, certId, status, planName, avatarUrl, className,
}: CompanyIdentityProps) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const statusConfig = {
    active: { label: "Active", variant: "success" as const, dot: "bg-success" },
    trial: { label: "Trial", variant: "accent" as const, dot: "bg-accent" },
    expired: { label: "Expired", variant: "danger" as const, dot: "bg-danger" },
    pending: { label: "Pending", variant: "warning" as const, dot: "bg-warning" },
  };

  const s = status ? statusConfig[status] : null;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/10 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="text-2xl font-bold text-accent">{initial}</span>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">{name}</h2>
          {s && (
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", s.dot)} />
              <span className={cn("text-xs font-medium", `text-${s.variant}`)}>{s.label}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {subtitle && <span className="text-sm text-text-muted">{subtitle}</span>}
          {certId && (
            <>
              {subtitle && <span className="text-text-muted">·</span>}
              <span className="text-xs font-mono text-text-muted">{certId}</span>
            </>
          )}
          {planName && (
            <>
              <span className="text-text-muted">·</span>
              <Badge variant="accent" className="text-xs">{planName}</Badge>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
