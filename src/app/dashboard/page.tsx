"use client";

import { useEffect, useState } from "react";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { ComplianceCalendar } from "@/components/dashboard/ComplianceCalendar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ComplianceHealthWidget } from "@/components/dashboard/ComplianceHealthWidget";
import { DashboardHero } from "@/components/dashboard/shared/DashboardHero";
import { StatCard } from "@/components/dashboard/shared/StatCard";
import { SectionHeader } from "@/components/dashboard/shared/SectionHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

import { Building2, FileText, AlertTriangle, TrendingUp, Plus, GraduationCap, Clock, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { calculateDeadlines, enrichDeadline } from "@/lib/compliance/deadlines";
import { fetchEntities, fetchComplianceHealth } from "@/server/actions";
import { mapDrizzleEntity } from "@/lib/mappers";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";
import type { Entity } from "@/types/database.types";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function DashboardPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEntities();
        setEntities(data.map(mapDrizzleEntity));
      } catch {}
      setLoading(false);
      fetchComplianceHealth().then(setHealth).catch(() => {});
    };
    load();
  }, []);

  const currentYear = new Date().getFullYear();
  const deadlines: DeadlineWithStatus[] = entities.flatMap((entity) => {
    const jCode = (entity as unknown as Record<string, string>).country || "GY";
    const rawDeadlines = calculateDeadlines(jCode, currentYear);
    return rawDeadlines.map((d) => enrichDeadline(d, false, entity.id, entity.legal_name));
  });

  const upcomingDeadlines = deadlines
    .filter((d) => d.status !== "completed" && d.days_remaining > -30)
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
    .slice(0, 10);

  const overdueCount = deadlines.filter((d) => d.status === "overdue").length;
  const dueSoonCount = deadlines.filter((d) => d.status === "due_soon").length;

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const lcRate = health?.lcRate || 0;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 sm:p-8">
      {/* Hero */}
      <DashboardHero
        title={`${greeting}`}
        subtitle={
          overdueCount > 0
            ? `${overdueCount} overdue report${overdueCount !== 1 ? "s" : ""} — immediate attention required`
            : dueSoonCount > 0
            ? `${dueSoonCount} report${dueSoonCount !== 1 ? "s" : ""} due soon`
            : entities.length > 0
            ? "Your compliance dashboard is up to date"
            : "Let's set up your first entity and start filing"
        }
        date={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        gradient="from-accent to-emerald-800"
        kpis={entities.length > 0 ? [
          { label: "LC Rate", value: `${lcRate.toFixed(1)}%`, color: lcRate >= 50 ? "text-emerald-300" : "text-amber-300", sublabel: lcRate >= 50 ? "Meeting target" : "Below target" },
          { label: "Entities", value: String(entities.length), color: "text-sky-300", sublabel: `${entities.length} active` },
          { label: "Due Soon", value: String(dueSoonCount), color: dueSoonCount > 0 ? "text-amber-300" : "text-emerald-300", sublabel: dueSoonCount > 0 ? "Action needed" : "All clear" },
          { label: "Overdue", value: String(overdueCount), color: overdueCount > 0 ? "text-red-300" : "text-emerald-300", sublabel: overdueCount > 0 ? "Immediate attention" : "None" },
        ] : undefined}
      >
        {entities.length === 0 && (
          <div className="flex gap-3 mt-6">
            <Button onClick={() => router.push("/dashboard/entities/new")} className="bg-white text-accent hover:bg-white/90">
              <Plus className="h-4 w-4 mr-1" /> Add Your First Entity
            </Button>
            <Link href="/dashboard/training">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                <GraduationCap className="h-4 w-4 mr-1" /> Take Onboarding Course
              </Button>
            </Link>
          </div>
        )}
      </DashboardHero>

      {entities.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No entities yet"
          description="Add your first company or entity to start tracking local content compliance."
          actionLabel="Add Entity"
          onAction={() => router.push("/dashboard/entities/new")}
          secondaryLabel="Take the Onboarding Course"
          secondaryOnAction={() => router.push("/dashboard/training")}
        />
      ) : (
        <>
          {/* Mobile: compliance widget */}
          <div className="lg:hidden mb-6">
            <ComplianceHealthWidget />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <SectionHeader title="Your Entities" action={
                <Link href="/dashboard/entities/new">
                  <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Entity</Button>
                </Link>
              } />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entities.map((entity) => (
                  <PortfolioCard key={entity.id} entity={entity} />
                ))}
              </div>

              {/* Upcoming deadlines inline */}
              {upcomingDeadlines.length > 0 && (
                <div>
                  <SectionHeader title="Upcoming Deadlines" action={
                    <Link href="/dashboard/calendar" className="text-xs text-accent hover:text-accent-hover">
                      View Calendar <ArrowRight className="inline h-3 w-3" />
                    </Link>
                  } />
                  <div className="space-y-2">
                    {upcomingDeadlines.slice(0, 5).map((d, i) => (
                      <Card key={i} className={cn("border-0 shadow-sm", d.status === "overdue" ? "bg-danger/5" : d.status === "due_soon" ? "bg-warning/5" : "")}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-2 w-2 rounded-full shrink-0",
                              d.status === "overdue" ? "bg-danger" : d.status === "due_soon" ? "bg-warning" : "bg-accent"
                            )} />
                            <div>
                              <p className="text-sm font-medium text-text-primary">{d.label}</p>
                              <p className="text-xs text-text-muted">{d.entity_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-xs font-medium",
                              d.status === "overdue" ? "text-danger" : d.status === "due_soon" ? "text-warning" : "text-text-secondary"
                            )}>
                              {d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}d overdue` : d.days_remaining === 0 ? "Due today" : `${d.days_remaining}d left`}
                            </p>
                            <p className="text-[10px] text-text-muted">{d.due_date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="hidden lg:block">
                <ComplianceHealthWidget />
              </div>
              <ComplianceCalendar deadlines={upcomingDeadlines} />
              <RecentActivity />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
