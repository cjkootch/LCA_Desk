"use client";

import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string;
  title?: string;
  className?: string;
}

export function InfoTooltip({ content, title, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={cn("relative inline-flex", className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-0.5 rounded-full hover:bg-accent/10 transition-colors"
        aria-label="More info"
      >
        <Info className="h-4 w-4 text-text-muted hover:text-accent transition-colors" />
      </button>
      {open && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 rounded-xl border border-border bg-bg-card shadow-lg p-4">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t border-border bg-bg-card" />
          {title && <p className="text-sm font-semibold text-text-primary mb-1.5">{title}</p>}
          <p className="text-xs text-text-secondary leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
}
