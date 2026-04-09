"use client";

import { useEffect, useState } from "react";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  GraduationCap, BookOpen, CheckCircle, Clock, ArrowRight, Trophy,
  Flame, Star, Zap, Award, X,
} from "lucide-react";
import { fetchCourses, fetchUserBadges, seedLcaCourse, seedPlatformCourse, seedSupplierCourse, seedWinningContractsCourse, seedLcsCertCourse, seedCareerGuideCourse, seedInterviewPrepCourse, seedEsgCourse } from "@/server/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function LearnPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courseList, setCourseList] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCourses("seeker"), fetchUserBadges()])
      .then(async ([c, b]) => {
        if (c.length === 0) {
          try { await seedLcaCourse(); await seedPlatformCourse(); await seedSupplierCourse(); await seedWinningContractsCourse(); await seedLcsCertCourse(); await seedCareerGuideCourse(); await seedInterviewPrepCourse(); await seedEsgCourse(); c = await fetchCourses("seeker"); } catch {}
        }
        setCourseList(c);
        setBadges(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Learn" />
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      </>
    );
  }

  const totalModules = courseList.reduce((s, c) => s + (c.moduleCount || 0), 0);
  const completedCourses = badges.length;
  const xp = completedCourses * 500 + badges.length * 200;
  const level = Math.floor(xp / 1000) + 1;

  const [tipDismissed, setTipDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTipDismissed(localStorage.getItem("lca-learn-tip-dismissed") === "true");
    }
  }, []);

  const dismissTip = () => {
    setTipDismissed(true);
    localStorage.setItem("lca-learn-tip-dismissed", "true");
  };

  return (
    <>
      <SeekerTopBar title="Learn" description="Build your knowledge and earn certifications" />

      <div className="p-4 sm:p-8 max-w-4xl space-y-6">
        {/* Benefits tip — dismissable */}
        {!tipDismissed && completedCourses < 2 && (
          <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gold/10 shrink-0 mt-0.5">
                    <Trophy className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Stand out to employers</p>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      Complete at least 2 courses to earn the <strong className="text-gold">"Certified"</strong> badge on your Talent Pool profile.
                      Certified candidates get a gold highlight that makes them visible to every contractor browsing for hires.
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-success" /> Gold ring on your avatar</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-success" /> "Certified" badge next to your name</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-success" /> Priority visibility</span>
                    </div>
                  </div>
                </div>
                <button onClick={dismissTip} className="text-text-muted hover:text-text-secondary shrink-0 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gamification header */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 text-center bg-gradient-to-br from-accent/5 to-transparent border-accent/20">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Zap className="h-4 w-4 text-accent" />
              <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Level</span>
            </div>
            <p className="text-3xl font-bold text-accent">{level}</p>
            <p className="text-[10px] text-text-muted">{xp} XP earned</p>
          </Card>

          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BookOpen className="h-4 w-4 text-text-muted" />
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Courses</span>
            </div>
            <p className="text-3xl font-bold">{courseList.length}</p>
            <p className="text-[10px] text-text-muted">{totalModules} modules total</p>
          </Card>

          <Card className="p-4 text-center bg-gradient-to-br from-success/5 to-transparent border-success/20">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-[10px] font-semibold text-success uppercase tracking-wider">Completed</span>
            </div>
            <p className="text-3xl font-bold text-success">{completedCourses}</p>
            <p className="text-[10px] text-text-muted">{completedCourses === courseList.length && courseList.length > 0 ? "All done!" : `${courseList.length - completedCourses} remaining`}</p>
          </Card>

          <Card className="p-4 text-center bg-gradient-to-br from-gold/5 to-transparent border-gold/20">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Trophy className="h-4 w-4 text-gold" />
              <span className="text-[10px] font-semibold text-gold uppercase tracking-wider">Badges</span>
            </div>
            <p className="text-3xl font-bold text-gold">{badges.length}</p>
            <p className="text-[10px] text-text-muted">{badges.length === 0 ? "Start a course" : "Earned"}</p>
          </Card>
        </div>

        {/* Earned badges showcase */}
        {badges.length > 0 && (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-5 w-5 text-gold" />
                <p className="text-sm font-semibold text-text-primary">Your Certifications</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {badges.map(b => (
                  <div key={b.courseId} className="flex items-center gap-2 rounded-xl bg-white/80 border border-gold/20 px-4 py-3 shrink-0 shadow-sm">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center",
                      b.badgeColor === "gold" ? "bg-gold/10" : b.badgeColor === "success" ? "bg-success/10" : "bg-accent/10"
                    )}>
                      <Trophy className={cn("h-5 w-5",
                        b.badgeColor === "gold" ? "text-gold" : b.badgeColor === "success" ? "text-success" : "text-accent"
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{b.badgeLabel || b.courseTitle}</p>
                      <p className="text-[10px] text-text-muted">Verified Certification</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Course list */}
        {courseList.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Courses loading" description="Courses are being set up. Refresh in a moment." />
        ) : (
          <div className="space-y-4">
            {courseList.map((course, idx) => {
              const hasBadge = badges.some(b => b.courseId === course.id);
              const xpReward = 500;
              return (
                <Link key={course.id} href={`/seeker/learn/${course.slug}`}>
                  <Card className={cn(
                    "hover:border-accent/30 transition-all cursor-pointer hover:shadow-md",
                    hasBadge && "border-success/20 bg-success/[0.02]"
                  )}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={cn("p-2.5 rounded-xl shrink-0",
                            hasBadge ? "bg-success/10" : "bg-accent-light"
                          )}>
                            {hasBadge ? <CheckCircle className="h-5 w-5 text-success" /> : <BookOpen className="h-5 w-5 text-accent" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-semibold text-text-primary">{course.title}</h3>
                              {hasBadge && (
                                <Badge variant="success" className="text-[10px] gap-0.5">
                                  <CheckCircle className="h-2.5 w-2.5" /> Completed
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-text-secondary mt-1">{course.description}</p>
                            <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-muted">
                              <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {course.moduleCount} modules</span>
                              {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{course.estimatedMinutes} min</span>}
                              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-gold" /> +{xpReward} XP</span>
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
    </>
  );
}
