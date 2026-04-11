"use client";

import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string;
  title?: string;
  className?: string;
}

export function InfoTooltip({ content, title, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, isMobile]);

  return (
    <div className={cn("relative inline-flex", className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-0.5 rounded-full hover:bg-accent/10 transition-colors"
        aria-label="More info"
      >
        <Info className="h-4 w-4 text-text-muted hover:text-accent transition-colors" />
      </button>

      {/* Desktop popover */}
      {open && !isMobile && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 rounded-xl border border-border bg-bg-card shadow-lg p-4">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t border-border bg-bg-card" />
          {title && <p className="text-sm font-semibold text-text-primary mb-1.5">{title}</p>}
          <p className="text-xs text-text-secondary leading-relaxed">{content}</p>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {open && isMobile && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-bg-card shadow-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              {title
                ? <p className="text-sm font-semibold text-text-primary">{title}</p>
                : <p className="text-sm font-semibold text-text-primary">About this section</p>
              }
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-full hover:bg-bg-primary transition-colors ml-4 shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-text-muted" />
              </button>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{content}</p>
          </div>
        </>
      )}
    </div>
  );
}
