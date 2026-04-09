"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Briefcase, FileText, Bookmark, TrendingUp, CheckCircle, XCircle,
  Clock, ArrowRight, AlertCircle, Search, Trophy,
} from "lucide-react";
import { fetchSeekerDashboardStats, fetchMyApplications } from "@/server/actions";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import Link from "next/link";

const STATUS_VARIANT: Record<string, "default" | "accent" | "warning" | "success" | "danger"> = {
  received: "default",
  reviewing: "accent",
  shortlisted: "warning",
  interviewed: "warning",
  selected: "success",
  rejected: "danger",
};

export default function SeekerDashboard() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchSeekerDashboardStats>>>(null);
  const [recentApps, setRecentApps] = useState<Awaited<ReturnType<typeof fetchMyApplications>>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSeekerDashboardStats(),
      fetchMyApplications(),
    ])
      .then(([s, a]) => {
        setStats(s);
        setRecentApps(a.slice(0, 5));
        setRecommendedJobs(s?.recommendedJobs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Dashboard" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  const completionItems = [
    { label: "Job title", done: !!stats?.profile?.currentJobTitle },
    { label: "Employment category", done: !!stats?.profile?.employmentCategory },
    { label: "Skills", done: (stats?.profile?.skills?.length || 0) > 0 },
    { label: "Education", done: !!stats?.profile?.educationLevel },
    { label: "Certifications", done: (stats?.profile?.certifications?.length || 0) > 0 },
    { label: "Location preference", done: !!stats?.profile?.locationPreference && stats.profile.locationPreference !== "Any" },
    { label: "LCA attestation", done: !!stats?.profile?.lcaAttestationDate },
  ];
  const completedCount = completionItems.filter(i => i.done).length;
  const profileCompletion = Math.round((completedCount / completionItems.length) * 100);

  return (
    <>
      <SeekerTopBar title="Dashboard" description="Your job search at a glance" />

      <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
        <AnnouncementBanner userRole="seeker" />
        {/* Profile completion banner */}
        {!stats?.profileComplete && (
          <Card className="border-accent/20 bg-accent-light">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Complete your profile</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      A complete profile helps employers find you and improves your application quality.
                    </p>
                  </div>
                </div>
                <Link href="/seeker/profile">
                  <Button size="sm">Complete Profile</Button>
                </Link>
              </div>
              <div className="mt-3">
                <Progress value={profileCompletion} className="h-1.5" />
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {completionItems.filter(i => !i.done).map(i => (
                    <span key={i.label} className="text-[10px] text-text-muted">· {i.label}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/seeker/applications">
            <Card className="hover:border-accent/30 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center">
                    <FileText className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stats?.totalApplications || 0}</p>
                    <p className="text-xs text-text-muted">Applications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/seeker/applications">
            <Card className="hover:border-accent/30 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stats?.activeApplications || 0}</p>
                    <p className="text-xs text-text-muted">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success-light flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats?.selectedCount || 0}</p>
                  <p className="text-xs text-text-muted">Selected</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/seeker/jobs">
            <Card className="hover:border-accent/30 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gold-light flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{stats?.openJobsCount || 0}</p>
                    <p className="text-xs text-text-muted">Open Jobs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Earned badges */}
        {stats?.earnedBadges && stats.earnedBadges.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {stats.earnedBadges.map((b: { id: string; badgeLabel: string | null; badgeColor: string | null }) => (
              <div key={b.id} className="flex items-center gap-1.5 rounded-full bg-bg-primary border border-border px-3 py-1.5">
                <Trophy className={`h-3.5 w-3.5 ${b.badgeColor === "gold" ? "text-gold" : b.badgeColor === "success" ? "text-success" : "text-accent"}`} />
                <span className="text-xs font-medium text-text-primary">{b.badgeLabel}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Recent applications */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-semibold text-text-primary">Recent Applications</h2>
              <Link href="/seeker/applications" className="text-xs text-accent hover:text-accent-hover">
                View all <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>

            {recentApps.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <EmptyState
                    icon={FileText}
                    title="No applications yet"
                    description="Start applying to jobs to track your progress here."
                    actionLabel="Find Jobs"
                    onAction={() => window.location.href = "/seeker/jobs"}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentApps.map((app) => (
                  <Card key={app.id}>
                    <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{app.jobTitle}</p>
                        <p className="text-xs text-text-secondary">{app.companyName}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Applied {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[app.status || "received"] || "default"} className="shrink-0">
                        {(app.status || "received").replace(/_/g, " ")}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions & saved */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick actions */}
            <div className="space-y-3">
              <h2 className="text-sm font-heading font-semibold text-text-primary">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/seeker/jobs" className="block">
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Search className="h-4 w-4 text-accent" />
                      <span className="text-sm text-text-primary">Search open positions</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/seeker/opportunities" className="block">
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                    <CardContent className="p-3 flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 text-accent" />
                      <span className="text-sm text-text-primary">Browse LCS opportunities</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/seeker/saved" className="block">
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Bookmark className="h-4 w-4 text-accent" />
                      <span className="text-sm text-text-primary">Saved items ({(stats?.savedOpportunities || 0) + (stats?.savedJobs || 0)})</span>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Recommended jobs */}
        {recommendedJobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-semibold text-text-primary">Recommended for You</h2>
              <Link href="/seeker/jobs" className="text-xs text-accent hover:text-accent-hover">
                View all <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {recommendedJobs.map((job: { id: string; title: string; company: string; category: string }) => (
                <Link key={job.id} href={`/seeker/jobs/${job.id}`}>
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer h-full">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-text-primary">{job.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{job.company}</p>
                      {job.category && (
                        <Badge variant="default" className="text-[10px] mt-2">{job.category}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Industry News */}
        <IndustryNewsFeed userType="seeker" />
      </div>
    </>
  );
}
