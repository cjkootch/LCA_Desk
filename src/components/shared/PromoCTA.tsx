"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PromoCTAProps {
  title: string;
  description: string;
  tags?: string[];
  buttonText: string;
  buttonHref?: string;
  onButtonClick?: () => void;
  variant?: "dark" | "accent" | "gold";
  icon?: React.ReactNode;
  className?: string;
}

export function PromoCTA({
  title, description, tags, buttonText, buttonHref, onButtonClick,
  variant = "dark", icon, className,
}: PromoCTAProps) {
  const bg = {
    dark: "bg-gradient-to-br from-[var(--slate-dark)] to-[var(--slate-medium)]",
    accent: "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)]",
    gold: "bg-gradient-to-br from-amber-700 to-amber-900",
  }[variant];

  const content = (
    <div className={cn("rounded-xl p-5 text-white relative overflow-hidden", bg, className)}>
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5" />
      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">{title}</h3>
            <p className="text-sm text-white/70 mb-3 leading-relaxed">{description}</p>
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-md bg-white/10 text-xs font-medium text-white/90 backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {icon && <div className="shrink-0 opacity-20">{icon}</div>}
        </div>
        <Button
          variant="outline"
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white gap-1.5"
          onClick={onButtonClick}
        >
          {buttonText} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  if (buttonHref && !onButtonClick) {
    return <Link href={buttonHref}>{content}</Link>;
  }
  return content;
}
