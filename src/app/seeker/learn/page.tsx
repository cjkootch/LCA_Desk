"use client";

import { useEffect, useState } from "react";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { GraduationCap, BookOpen, CheckCircle, Clock, ArrowRight, Trophy } from "lucide-react";
import { fetchCourses, fetchUserBadges, seedLcaCourse, seedPlatformCourse } from "@/server/actions";
import Link from "next/link";
import { toast } from "sonner";

export default function LearnPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courseList, setCourseList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCourses("seeker"), fetchUserBadges()])
      .then(([c, b]) => { setCourseList(c); setBadges(b); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSeed = async () => {
    try {
      await seedLcaCourse();
      const c = await fetchCourses("seeker");
      setCourseList(c);
      toast.success("LCA Fundamentals course created");
    } catch { toast.error("Failed to create course"); }
  };

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Learn" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <>
      <SeekerTopBar title="Learn" description="Build your knowledge of Guyana's petroleum sector" />

      <div className="p-4 sm:p-8 max-w-4xl space-y-6">
        {/* Badges earned */}
        {badges.length > 0 && (
          <Card className="border-success/20 bg-success-light/30">
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

        {/* Course list */}
        {courseList.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No courses available yet"
            description="Courses will appear here once they're created."
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
                        <div className="flex items-start gap-3 flex-1">
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
    </>
  );
}
