"use client";

import { cn } from "@/lib/utils";

interface KPI {
  label: string;
  value: string;
  sublabel?: string;
  color?: string; // tailwind text color for label
}

interface DashboardHeroProps {
  badge?: string;
  title: string;
  subtitle?: string;
  date?: string;
  kpis?: KPI[];
  gradient?: string; // tailwind gradient classes
  children?: React.ReactNode;
}

export function DashboardHero({
  badge,
  title,
  subtitle,
  date,
  kpis,
  gradient = "from-[#1e293b] to-[#334155]",
  children,
}: DashboardHeroProps) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-r p-6 sm:p-8 mb-6 text-white", gradient)}>
      {badge && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold text-gold uppercase tracking-widest">{badge}</span>
        </div>
      )}
      <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-1">{title}</h1>
      {subtitle && <p className="text-white/60 text-sm">{subtitle}</p>}
      {date && <p className="text-white/40 text-xs mt-0.5">{date}</p>}

      {children}

      {kpis && kpis.length > 0 && (
        <div className={cn("grid gap-4 mt-6", kpis.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1", kpi.color || "text-white/70")}>{kpi.label}</p>
              <p className="text-3xl font-bold">{kpi.value}</p>
              {kpi.sublabel && <p className="text-[11px] text-white/50 mt-1">{kpi.sublabel}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
