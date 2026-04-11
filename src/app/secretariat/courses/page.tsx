"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, BookOpen, Clock, ChevronRight, Trash2, Send, EyeOff } from "lucide-react";
import { fetchAdminCourses, createCourse, addModule, deleteCourse, publishCourse, unpublishCourse } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { SecretariatShell } from "@/app/secretariat/SecretariatShell";
import { CourseWizard } from "@/components/training/CourseWizard";
import { useAuth } from "@/hooks/useAuth";

type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  audience: string | null;
  jurisdictionCode: string | null;
  moduleCount: number | null;
  badgeLabel: string | null;
  badgeColor: string | null;
  estimatedMinutes: number | null;
  mandatory: boolean | null;
  active: boolean | null;
  isPublished: boolean | null;
  createdBy: string | null;
};

export default function SecretariatCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const { profile } = useAuth();
  const currentUserId = profile?.id ?? null;

  async function load() {
    try {
      const data = await fetchAdminCourses();
      // Drafts first, then published
      const sorted = [...data].sort((a, b) => {
        if (!!a.isPublished !== !!b.isPublished) return a.isPublished ? 1 : -1;
        return (a.title ?? "").localeCompare(b.title ?? "");
      });
      setCourses(sorted as Course[]);
    } catch { toast.error("Failed to load courses"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(course: Course) {
    if (!confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    try {
      await deleteCourse(course.id);
      setCourses(prev => prev.filter(c => c.id !== course.id));
      toast.success("Course deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete"); }
  }

  async function handlePublish(course: Course) {
    try {
      await publishCourse(course.id);
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, isPublished: true, active: true } : c));
      toast.success("Course published");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to publish"); }
  }

  async function handleUnpublish(course: Course) {
    try {
      await unpublishCourse(course.id);
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, isPublished: false, active: false } : c));
      toast.success("Course unpublished");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to unpublish"); }
  }

  async function handleWizardSave(data: {
    title: string;
    slug: string;
    description: string;
    audience: string;
    jurisdictionCode: string;
    badgeLabel: string;
    badgeColor: string;
    estimatedMinutes: number;
    isPublished: boolean;
    modules: Array<{ title: string; content: string; quizQuestions: string }>;
  }) {
    const course = await createCourse({
      slug: data.slug,
      title: data.title,
      description: data.description || undefined,
      audience: data.audience,
      jurisdictionCode: data.jurisdictionCode,
      badgeLabel: data.badgeLabel,
      badgeColor: data.badgeColor,
      estimatedMinutes: data.estimatedMinutes,
      isPublished: data.isPublished,
    });
    for (const mod of data.modules) {
      await addModule(course.id, {
        title: mod.title,
        content: mod.content,
        quizQuestions: mod.quizQuestions,
      });
    }
    toast.success(data.isPublished ? "Course created and published!" : "Course saved as draft");
    setShowWizard(false);
    load();
  }

  const drafts = courses.filter(c => !c.isPublished);
  const published = courses.filter(c => c.isPublished);

  return (
    <SecretariatShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-primary">Courses</h1>
            <p className="text-sm text-text-muted mt-1">
              {drafts.length} draft{drafts.length !== 1 ? "s" : ""} · {published.length} published
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Course
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : (
          <>
            {courses.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-text-muted">
                  <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No courses yet.</p>
                </CardContent>
              </Card>
            )}

            {[
              { label: "Drafts", items: drafts },
              { label: "Published", items: published },
            ].map(({ label, items }) =>
              items.length === 0 ? null : (
                <div key={label} className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted px-1">{label}</h2>
                  <div className="space-y-2">
                    {items.map(course => {
                      const isOwner = currentUserId && course.createdBy === currentUserId;
                      return (
                        <Card key={course.id} className={cn("transition-colors", !course.isPublished && "border-dashed opacity-80")}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                <GraduationCap className="h-5 w-5 text-accent" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-text-primary">{course.title}</h3>
                                  <Badge variant={course.isPublished ? "success" : "default"} className="text-xs">
                                    {course.isPublished ? "Published" : "Draft"}
                                  </Badge>
                                  {course.mandatory && <Badge variant="warning" className="text-xs">Mandatory</Badge>}
                                  {course.audience && <Badge variant="default" className="text-xs capitalize">{course.audience}</Badge>}
                                </div>
                                {course.description && <p className="text-sm text-text-secondary mt-1 line-clamp-2">{course.description}</p>}
                                <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{course.moduleCount ?? 0} modules</span>
                                  {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{course.estimatedMinutes} min</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {course.isPublished ? (
                                  <button
                                    onClick={() => handleUnpublish(course)}
                                    className="p-1.5 rounded hover:bg-bg-primary text-text-muted hover:text-warning transition-colors"
                                    title="Unpublish"
                                  >
                                    <EyeOff className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePublish(course)}
                                    className="p-1.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent transition-colors"
                                    title="Publish"
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                )}
                                {isOwner && (
                                  <button
                                    onClick={() => handleDelete(course)}
                                    className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                                <Link href={`/secretariat/courses/${course.id}/modules`}>
                                  <Button variant="outline" size="sm" className="gap-1">
                                    Modules <ChevronRight className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {showWizard && (
        <CourseWizard
          jurisdictionCode="GY"
          lockJurisdiction={true}
          onSave={handleWizardSave}
          onClose={() => setShowWizard(false)}
        />
      )}
    </SecretariatShell>
  );
}
