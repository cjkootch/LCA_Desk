"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { DashboardIdentity, DashboardStats, StatusCard, DashboardSection } from "@/components/dashboard/shared/DashboardTemplate";
import { PromoCTA } from "@/components/shared/PromoCTA";
import {
  ArrowRight, AlertCircle,
} from "lucide-react";
import { fetchSeekerDashboardStats, fetchMyApplications } from "@/server/actions";
import { IndustryNewsFeed } from "@/components/dashboard/IndustryNewsFeed";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "accent" | "warning" | "success" | "danger"> = {
  received: "default",
  reviewing: "accent",
  shortlisted: "warning",
  interviewed: "warning",
  selected: "success",
  hired: "success",
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
    { label: "Location", done: !!stats?.profile?.locationPreference && stats.profile.locationPreference !== "Any" },
    { label: "LCA attestation", done: !!stats?.profile?.lcaAttestationDate },
  ];
  const completedCount = completionItems.filter(i => i.done).length;
  const profileCompletion = Math.round((completedCount / completionItems.length) * 100);

  return (
    <>
      <SeekerTopBar title="Dashboard" description="Your job search at a glance" />

      <div className="p-4 sm:p-6 max-w-5xl space-y-4">
        <AnnouncementBanner userRole="seeker" />

        {/* Identity */}
        <DashboardIdentity
          name={stats?.profile?.currentJobTitle ? `${stats.profile.currentJobTitle}` : "Job Seeker"}
          subtitle={[
            stats?.profile?.employmentCategory,
            stats?.profile?.isGuyanese ? "Guyanese National" : null,
            stats?.profile?.locationPreference && stats.profile.locationPreference !== "Any" ? stats.profile.locationPreference : null,
          ].filter(Boolean).join(" · ")}
          status={
            stats?.profileComplete
              ? { label: "Profile Complete", variant: "success" }
              : { label: `Profile ${profileCompletion}%`, variant: "warning" }
          }
          badge={(stats?.earnedBadges?.length ?? 0) >= 2 ? "Certified" : undefined}
        />

        {/* Stats */}
        <DashboardStats items={[
          { label: "Applications", value: String(stats?.totalApplications || 0), color: "accent", onClick: () => window.location.href = "/seeker/applications" },
          { label: "Saved", value: String((stats?.savedJobs || 0) + (stats?.savedOpportunities || 0)), color: "gold", onClick: () => window.location.href = "/seeker/saved" },
          { label: "Open Jobs", value: String(stats?.openJobsCount || 0), color: "success" },
          { label: "Profile Score", value: `${profileCompletion}%`, color: profileCompletion >= 80 ? "success" : "warning", sublabel: profileCompletion >= 80 ? "Strong profile" : "Needs work" },
        ]} />

        {/* Profile status card */}
        {!stats?.profileComplete && (
          <StatusCard
            title="Profile Completion"
            status={profileCompletion >= 80 ? "Almost There" : profileCompletion >= 50 ? "In Progress" : "Getting Started"}
            statusVariant={profileCompletion >= 80 ? "success" : profileCompletion >= 50 ? "warning" : "danger"}
            details={completionItems.map(i => ({ label: i.label, value: i.done ? "Done" : "Missing" }))}
            footer="Complete your profile to increase visibility with employers and improve job matches."
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent applications */}
          <DashboardSection title="Recent Applications" action={
            <Link href="/seeker/applications" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          }>
            {recentApps.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-text-muted">
                No applications yet. <Link href="/seeker/jobs" className="text-accent hover:underline">Browse jobs</Link>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {recentApps.map((app) => (
                  <Card key={app.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{app.jobTitle}</p>
                        <p className="text-xs text-text-muted">{app.companyName} · Applied {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ""}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[app.status || "received"] || "default"} className="shrink-0 text-xs">
                        {(app.status || "received").replace(/_/g, " ")}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DashboardSection>

          {/* Recommended jobs */}
          <DashboardSection title="Recommended for You" action={
            <Link href="/seeker/jobs" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1">
              Browse All <ArrowRight className="h-3 w-3" />
            </Link>
          }>
            {recommendedJobs.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-text-muted">
                Complete your profile to get personalized job recommendations.
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {recommendedJobs.slice(0, 5).map((job: { id: string; title: string; company: string; category: string }) => (
                  <Link key={job.id} href={`/seeker/jobs/${job.id}`}>
                    <Card className="hover:border-accent/20 transition-colors cursor-pointer">
                      <CardContent className="p-3">
                        <p className="text-sm font-medium text-text-primary">{job.title}</p>
                        <p className="text-xs text-text-muted">{job.company}{job.category ? ` · ${job.category}` : ""}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </DashboardSection>
        </div>

        {/* CTA tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PromoCTA
            variant="accent"
            title="Build Your Resume"
            description="Create a professional resume that highlights your petroleum sector experience."
            tags={["3 Templates", "Export PDF", "Auto-fill"]}
            buttonText="Resume Builder"
            buttonHref="/seeker/resume"
          />
          <PromoCTA
            variant="dark"
            title="Get Certified"
            description="Complete compliance courses to earn badges that boost your visibility."
            tags={["Free Courses", "Earn Badges", "Stand Out"]}
            buttonText="Start Learning"
            buttonHref="/seeker/learn"
          />
        </div>

        {/* News */}
        <IndustryNewsFeed userType="seeker" />
      </div>
    </>
  );
}
