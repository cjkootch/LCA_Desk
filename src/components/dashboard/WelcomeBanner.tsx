"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

interface WelcomeBannerProps {
  entityCount: number;
  overdueCount: number;
  dueSoonCount: number;
}

export function WelcomeBanner({ entityCount, overdueCount, dueSoonCount }: WelcomeBannerProps) {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  let summaryText = "Your compliance dashboard is ready.";
  if (overdueCount > 0) {
    summaryText = `You have ${overdueCount} overdue report${overdueCount > 1 ? "s" : ""} that need${overdueCount === 1 ? "s" : ""} immediate attention.`;
  } else if (dueSoonCount > 0) {
    summaryText = `${dueSoonCount} report${dueSoonCount > 1 ? "s" : ""} due within the next 14 days.`;
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-sidebar-bg to-accent p-4 sm:p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-white mb-1">
            {greeting}, {firstName}
          </h1>
          <p className="text-white/80 text-sm">{summaryText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {entityCount > 0 && (
            <Link href="/dashboard/entities">
              <Button variant="secondary" size="sm" className="bg-white text-sidebar-bg hover:bg-white/90">
                <FileText className="h-4 w-4 mr-1" />
                Start New Report
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          )}
          <Link href="/dashboard/entities/new">
            <Button variant="secondary" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              <Plus className="h-4 w-4 mr-1" />
              Add Entity
            </Button>
          </Link>
          <Link href="/dashboard/expert">
            <Button variant="secondary" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              <Sparkles className="h-4 w-4 mr-1" />
              LCA Expert
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
