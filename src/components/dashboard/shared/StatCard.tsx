"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  icon?: React.ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  iconColor?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({ icon: Icon, label, value, sublabel, color, iconColor, className, onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card p-4 transition-all",
        onClick && "cursor-pointer hover:border-accent/30 hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      {Icon && (
        <div className="mb-2">
          <Icon className={cn("h-5 w-5", iconColor || "text-text-muted")} />
        </div>
      )}
      <p className={cn("text-2xl sm:text-3xl font-bold", color || "text-text-primary")}>{value}</p>
      <p className="text-xs font-medium text-text-muted mt-0.5">{label}</p>
      {sublabel && <p className={cn("text-[10px] mt-0.5", color ? color.replace("text-", "text-") : "text-text-muted")}>{sublabel}</p>}
    </div>
  );
}
