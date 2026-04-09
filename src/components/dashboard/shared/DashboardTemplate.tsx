"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Company/User Identity Header ─────────────────────────────
interface IdentityProps {
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  status?: { label: string; variant: "success" | "warning" | "danger" | "accent" };
  badge?: string;
}

export function DashboardIdentity({ name, subtitle, avatarUrl, status, badge }: IdentityProps) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/10 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-contain rounded-xl p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="text-2xl font-bold text-accent">{initial}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-heading font-bold text-text-primary truncate">{name}</h1>
          {status && (
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full",
                status.variant === "success" ? "bg-success" :
                status.variant === "warning" ? "bg-warning" :
                status.variant === "danger" ? "bg-danger" : "bg-accent"
              )} />
              <span className="text-xs font-medium text-text-secondary">{status.label}</span>
            </div>
          )}
          {badge && <Badge variant="accent" className="text-xs">{badge}</Badge>}
        </div>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── KPI Stat Row ─────────────────────────────────────────────
interface StatItem {
  label: string;
  value: string;
  sublabel?: string;
  color?: string; // "accent" | "success" | "warning" | "danger" | "gold"
  onClick?: () => void;
}

export function DashboardStats({ items }: { items: StatItem[] }) {
  return (
    <div className={cn("grid gap-3 mb-4", items.length <= 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
      {items.map(item => {
        const colorClass = {
          accent: "text-accent",
          success: "text-success",
          warning: "text-warning",
          danger: "text-danger",
          gold: "text-gold",
        }[item.color || "accent"] || "text-text-primary";

        return (
          <Card key={item.label}
            className={cn("overflow-hidden transition-all", item.onClick && "cursor-pointer hover:shadow-md")}
            onClick={item.onClick}>
            <CardContent className="p-4">
              <p className="text-xs text-text-muted font-medium mb-1">{item.label}</p>
              <p className={cn("text-2xl font-bold", colorClass)}>{item.value}</p>
              {item.sublabel && <p className="text-xs text-text-muted mt-0.5">{item.sublabel}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Status Card (like LegalZoom's compliance status) ──────────
interface StatusCardProps {
  title: string;
  status: string;
  statusVariant: "success" | "warning" | "danger";
  details?: { label: string; value: string; benchmark?: string; met?: boolean }[];
  footer?: string;
}

export function StatusCard({ title, status, statusVariant, details, footer }: StatusCardProps) {
  const dotColor = statusVariant === "success" ? "bg-success" : statusVariant === "warning" ? "bg-warning" : "bg-danger";
  const textColor = statusVariant === "success" ? "text-success" : statusVariant === "warning" ? "text-warning" : "text-danger";

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{title}</p>
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("h-3 w-3 rounded-full", dotColor)} />
          <span className={cn("text-lg font-bold", textColor)}>{status}</span>
        </div>
        {details && details.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 pt-3 border-t border-border-light">
            {details.map(d => (
              <div key={d.label} className="flex justify-between text-sm">
                <span className="text-text-muted">{d.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-medium", d.met === true ? "text-success" : d.met === false ? "text-danger" : "text-text-primary")}>{d.value}</span>
                  {d.benchmark && <span className="text-xs text-text-muted">/ {d.benchmark}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {footer && <p className="text-xs text-text-muted mt-3">{footer}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Section Header ────────────────────────────────────────────
export function DashboardSection({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-heading font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
