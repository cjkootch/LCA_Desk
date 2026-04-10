"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  GraduationCap, BookOpen, CheckCircle, Clock, Trophy,
  ArrowRight, Zap, Star, Award, Target, Users,
} from "lucide-react";
import {
  fetchCourses, fetchUserBadges,
  seedLcaCourse, seedPlatformCourse, seedSupplierCourse,
  seedFirstReportCourse, seedFirstScheduleCourse, seedAuditPrepCourse,
  seedWinningContractsCourse, seedLcsCertCourse,
  seedCareerGuideCourse, seedInterviewPrepCourse, seedEsgCourse,
} from "@/server/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SecretariatTrainingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courseList, setCourseList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCourses("all"), fetchUserBadges()])
      .then(async ([c, b]) => {
        setBadges(b);
        if (c.length === 0) {
          try {
            await seedLcaCourse(); await seedPlatformCourse(); await seedSupplierCourse();
            await seedFirstReportCourse(); await seedFirstScheduleCourse(); await seedAuditPrepCourse();
            await seedWinningContractsCourse(); await seedLcsCertCourse();
            await seedCareerGuideCourse(); await seedInterviewPrepCourse(); await seedEsgCourse();
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
  const totalModules = courseList.reduce((s, c) => s + (c.moduleCount || 0), 0);
  const xp = completedCourses * 500;
  const level = Math.floor(xp / 1000) + 1;
  const progressPct = courseList.length > 0 ? Math.round((completedCourses / courseList.length) * 100) : 0;

  // Split courses into categories
  const essentialCourses = courseList.filter(c => ["lca-fundamentals", "mastering-lca-desk", "first-report"].includes(c.slug));
  const complianceCourses = courseList.filter(c => ["first-schedule", "audit-prep", "esg-local-content", "supplier-management"].includes(c.slug));
  const otherCourses = courseList.filter(c => !essentialCourses.includes(c) && !complianceCourses.includes(c));

  const CourseCard = ({ course }: { course: typeof courseList[0] }) => {
    const hasBadge = badges.some((b: { courseId: string }) => b.courseId === course.id);
    return (
      <Link href={`/learn/${course.slug}`}>
        <Card className={cn(
          "hover:border-accent/30 hover:shadow-md transition-all cursor-pointer h-full",
          hasBadge && "border-success/20 bg-success/[0.02]"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-xl shrink-0", hasBadge ? "bg-success/10" : "bg-accent-light")}>
                {hasBadge ? <CheckCircle className="h-5 w-5 text-success" /> : <BookOpen className="h-5 w-5 text-accent" />}
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
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Training & Resources</h1>
          <p className="text-sm text-text-secondary">Build your team's knowledge of the Local Content Act, compliance procedures, and regulatory tools</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-3 text-center bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
          <Zap className="h-4 w-4 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-accent">{level}</p>
          <p className="text-xs text-text-muted">Level</p>
        </Card>
        <Card className="p-3 text-center">
          <BookOpen className="h-4 w-4 text-text-muted mx-auto mb-1" />
          <p className="text-2xl font-bold">{courseList.length}</p>
          <p className="text-xs text-text-muted">Courses</p>
        </Card>
        <Card className="p-3 text-center bg-gradient-to-br from-success/5 to-transparent border-success/20">
          <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">{completedCourses}</p>
          <p className="text-xs text-text-muted">Completed</p>
        </Card>
        <Card className="p-3 text-center bg-gradient-to-br from-gold/5 to-transparent border-gold/20">
          <Trophy className="h-4 w-4 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold text-gold">{badges.length}</p>
          <p className="text-xs text-text-muted">Badges</p>
        </Card>
        <Card className="p-3 text-center">
          <BookOpen className="h-4 w-4 text-text-muted mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalModules}</p>
          <p className="text-xs text-text-muted">Modules</p>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-text-primary">Training Progress</span>
            </div>
            <span className="text-xs text-text-muted">{completedCourses} of {courseList.length} courses · {xp} XP</span>
          </div>
          <Progress value={progressPct} className="h-2.5" indicatorClassName={progressPct === 100 ? "bg-success" : "bg-accent"} />
          {progressPct === 100 && (
            <p className="text-xs text-success font-medium mt-1.5 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> All courses completed!</p>
          )}
        </CardContent>
      </Card>

      {/* Earned badges */}
      {badges.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-gold" />
              <p className="text-sm font-semibold text-text-primary">Earned Certifications</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {badges.map((b: { courseId: string; badgeLabel: string; badgeColor: string }) => (
                <div key={b.courseId} className="flex items-center gap-2 rounded-xl bg-white/80 border border-gold/20 px-4 py-3 shrink-0 shadow-sm">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center",
                    b.badgeColor === "gold" ? "bg-gold/10" : b.badgeColor === "success" ? "bg-success/10" : "bg-accent/10"
                  )}>
                    <Trophy className={cn("h-4 w-4", b.badgeColor === "gold" ? "text-gold" : b.badgeColor === "success" ? "text-success" : "text-accent")} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">{b.badgeLabel}</p>
                    <p className="text-xs text-text-muted">Certified</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Course sections */}
      {courseList.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Training courses loading" description="Courses are being set up. Refresh in a moment." />
      ) : (
        <>
          {essentialCourses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-1 rounded-full bg-accent" />
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Fundamentals</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {essentialCourses.map(c => <CourseCard key={c.id} course={c} />)}
              </div>
            </div>
          )}

          {complianceCourses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-1 rounded-full bg-gold" />
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Compliance & Regulatory</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {complianceCourses.map(c => <CourseCard key={c.id} course={c} />)}
              </div>
            </div>
          )}

          {otherCourses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-1 rounded-full bg-success" />
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Professional Development</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {otherCourses.map(c => <CourseCard key={c.id} course={c} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
