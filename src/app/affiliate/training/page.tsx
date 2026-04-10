"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  GraduationCap, BookOpen, CheckCircle, Clock, Trophy,
  ArrowRight, Star, Target,
} from "lucide-react";
import { fetchCourses, fetchUserBadges, seedAffiliateSalesCourse, seedAffiliateMarketingCourse } from "@/server/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AffiliateTrainingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courseList, setCourseList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCourses("all"), fetchUserBadges()])
      .then(async ([c, b]) => {
        setBadges(b);
        // Auto-seed affiliate courses if none exist
        const hasAffiliateCourses = c.some((course: {slug: string}) => course.slug === "affiliate-sales");
        if (!hasAffiliateCourses) {
          try {
            await seedAffiliateSalesCourse();
            await seedAffiliateMarketingCourse();
            c = await fetchCourses("all");
          } catch {}
        }
        setCourseList(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;

  const completedCourses = badges.length;
  const progressPct = courseList.length > 0 ? Math.round((completedCourses / courseList.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Affiliate Training</h1>
          <p className="text-sm text-text-secondary">Learn how to effectively promote LCA Desk and maximize your commissions</p>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium text-text-primary">Training Progress</span>
            </div>
            <span className="text-xs text-text-muted">{completedCourses} of {courseList.length} courses</span>
          </div>
          <Progress value={progressPct} className="h-2.5" indicatorClassName={progressPct === 100 ? "bg-gold" : "bg-accent"} />
        </CardContent>
      </Card>

      {/* Courses */}
      {courseList.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <GraduationCap className="h-10 w-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-text-muted">Training courses are being set up. Check back soon.</p>
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {courseList.map(course => {
            const hasBadge = badges.some((b: { courseId: string }) => b.courseId === course.id);
            return (
              <Link key={course.id} href={`/learn/${course.slug}`}>
                <Card className={cn(
                  "hover:border-accent/30 hover:shadow-md transition-all cursor-pointer h-full",
                  hasBadge && "border-success/20 bg-success/[0.02]"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-xl shrink-0", hasBadge ? "bg-success/10" : "bg-gold/10")}>
                        {hasBadge ? <CheckCircle className="h-5 w-5 text-success" /> : <BookOpen className="h-5 w-5 text-gold" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-text-primary">{course.title}</h3>
                          {hasBadge && <Badge variant="success" className="text-xs gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> Done</Badge>}
                        </div>
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{course.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-text-muted">
                          <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" /> {course.moduleCount}</span>
                          {course.estimatedMinutes && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {course.estimatedMinutes}m</span>}
                          {course.badgeLabel && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-gold" /> {course.badgeLabel}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-muted shrink-0 mt-1" />
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
