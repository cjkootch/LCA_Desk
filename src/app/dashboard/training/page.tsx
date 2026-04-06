"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  GraduationCap, BookOpen, CheckCircle, Clock, Users, Trophy,
  ArrowRight, Shield,
} from "lucide-react";
import { fetchCourses, fetchUserBadges, seedLcaCourse, seedPlatformCourse, fetchTeamMembers } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";

export default function TrainingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courseList, setCourseList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCourses("filer"), fetchUserBadges(), fetchTeamMembers()])
      .then(([c, b, t]) => { setCourseList(c); setBadges(b); setTeamMembers(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSeed = async () => {
    try {
      await seedLcaCourse();
      await seedPlatformCourse();
      const c = await fetchCourses("filer");
      setCourseList(c);
      toast.success("Training courses created");
    } catch { toast.error("Failed to create courses"); }
  };

  if (loading) {
    return (
      <>
        <TopBar title="Training" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <div>
      <TopBar title="Training" description="LCA compliance training for your team" />
      <div className="p-4 sm:p-8 max-w-5xl">
        {/* Admin info */}
        <Card className="border-accent/20 bg-accent-light mb-6">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Compliance Training</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Ensure your team understands the Local Content Act before filing. Completed courses earn badges
                visible in the audit trail, demonstrating your organization&apos;s commitment to compliance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Team status */}
        {teamMembers.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Team Training Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teamMembers.map((m: { id: string; user: { name: string; email: string } }) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-text-primary">{m.user.name || m.user.email}</p>
                      <p className="text-xs text-text-muted">{m.user.email}</p>
                    </div>
                    <Badge variant="default" className="text-[10px]">Pending</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My badges */}
        {badges.length > 0 && (
          <Card className="border-success/20 mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-gold" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Your Badges</p>
                <div className="flex gap-2 mt-1">
                  {badges.map(b => (
                    <Badge key={b.courseId} variant="accent" className="gap-1">
                      <CheckCircle className="h-3 w-3" /> {b.badgeLabel || b.courseTitle}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Courses */}
        {courseList.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No training courses available"
            description="Set up the LCA Fundamentals course for your team."
            actionLabel="Create LCA Course"
            onAction={handleSeed}
          />
        ) : (
          <div className="space-y-4">
            {courseList.map(course => {
              const hasBadge = badges.some(b => b.courseId === course.id);
              return (
                <Link key={course.id} href={`/seeker/learn/${course.slug}`}>
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-accent-light shrink-0">
                            <BookOpen className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-text-primary">{course.title}</h3>
                              {hasBadge && <Badge variant="success" className="text-[10px] gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> Completed</Badge>}
                            </div>
                            <p className="text-sm text-text-secondary mt-1">{course.description}</p>
                            <div className="flex gap-3 mt-2 text-xs text-text-muted">
                              <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {course.moduleCount} modules</span>
                              {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{course.estimatedMinutes} min</span>}
                              {course.badgeLabel && <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-gold" /> Earn: {course.badgeLabel}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-text-muted shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
