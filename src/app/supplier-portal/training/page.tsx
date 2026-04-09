"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  GraduationCap, BookOpen, CheckCircle, Clock, ArrowRight, Trophy,
  Star, Zap, Award,
} from "lucide-react";
import { fetchCourses, fetchUserBadges, seedLcaCourse, seedSupplierCourse, seedWinningContractsCourse, seedLcsCertCourse, seedCareerGuideCourse, seedEsgCourse } from "@/server/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SupplierTrainingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courseList, setCourseList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch courses visible to suppliers: audience "all" covers it
    Promise.all([fetchCourses("all"), fetchUserBadges()])
      .then(async ([c, b]) => {
        if (c.length === 0) {
          try { await seedLcaCourse(); await seedSupplierCourse(); await seedWinningContractsCourse(); await seedLcsCertCourse(); await seedCareerGuideCourse(); await seedEsgCourse(); c = await fetchCourses("all"); } catch {}
        }
        setCourseList(c);
        setBadges(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const completedCourses = badges.length;
  const xp = completedCourses * 500;

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Training</h1>
      <p className="text-sm text-text-secondary mb-6">Build your knowledge and earn certifications</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <Zap className="h-4 w-4 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-accent">{Math.floor(xp / 1000) + 1}</p>
          <p className="text-xs text-text-muted">Level ({xp} XP)</p>
        </Card>
        <Card className="p-4 text-center">
          <BookOpen className="h-4 w-4 text-text-muted mx-auto mb-1" />
          <p className="text-2xl font-bold">{courseList.length}</p>
          <p className="text-xs text-text-muted">Courses</p>
        </Card>
        <Card className="p-4 text-center">
          <Trophy className="h-4 w-4 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold text-gold">{completedCourses}</p>
          <p className="text-xs text-text-muted">Badges Earned</p>
        </Card>
      </div>

      {/* Earned badges */}
      {badges.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-gold" />
              <p className="text-sm font-semibold text-text-primary">Your Certifications</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {badges.map((b: { courseId: string; badgeLabel: string; badgeColor: string }) => (
                <div key={b.courseId} className="flex items-center gap-2 rounded-xl bg-white/80 border border-gold/20 px-4 py-3 shrink-0">
                  <Trophy className={cn("h-5 w-5", b.badgeColor === "gold" ? "text-gold" : b.badgeColor === "success" ? "text-success" : "text-accent")} />
                  <div>
                    <p className="text-sm font-bold text-text-primary">{b.badgeLabel}</p>
                    <p className="text-xs text-text-muted">Verified</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Course list */}
      {courseList.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Courses loading" description="Training courses are being set up." />
      ) : (
        <div className="space-y-4">
          {courseList.map(course => {
            const hasBadge = badges.some((b: { courseId: string }) => b.courseId === course.id);
            return (
              <Link key={course.id} href={`/seeker/learn/${course.slug}`}>
                <Card className={cn("hover:border-accent/30 transition-all cursor-pointer hover:shadow-md", hasBadge && "border-success/20 bg-success/[0.02]")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn("p-2.5 rounded-xl shrink-0", hasBadge ? "bg-success/10" : "bg-accent-light")}>
                          {hasBadge ? <CheckCircle className="h-5 w-5 text-success" /> : <BookOpen className="h-5 w-5 text-accent" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-text-primary">{course.title}</h3>
                            {hasBadge && <Badge variant="success" className="text-xs gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> Completed</Badge>}
                          </div>
                          <p className="text-sm text-text-secondary mt-1">{course.description}</p>
                          <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-muted">
                            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {course.moduleCount} modules</span>
                            {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{course.estimatedMinutes} min</span>}
                            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-gold" /> +500 XP</span>
                            {course.badgeLabel && <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-gold" /> {course.badgeLabel}</span>}
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
  );
}
