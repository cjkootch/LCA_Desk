"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, FileText } from "lucide-react";
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
  } else if (entityCount === 0) {
    summaryText = "Get started by adding your first entity.";
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-sidebar-bg to-accent p-6 mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white mb-1">
            {greeting}, {firstName}
          </h1>
          <p className="text-white/80 text-sm">{summaryText}</p>
        </div>
        <div className="flex gap-2">
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
