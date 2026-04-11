"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, BookOpen, Clock, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import { fetchAdminCourses, createCourse, updateCourse, addModule } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { SecretariatShell } from "@/app/secretariat/SecretariatShell";
import { CourseWizard } from "@/components/training/CourseWizard";

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
};

export default function SecretariatCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  async function load() {
    try {
      const data = await fetchAdminCourses();
      setCourses(data);
    } catch { toast.error("Failed to load courses"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleActive(course: Course) {
    try {
      await updateCourse(course.id, { active: !course.active });
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, active: !c.active } : c));
      toast.success(course.active ? "Course deactivated" : "Course activated");
    } catch { toast.error("Failed to update"); }
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
    });
    for (const mod of data.modules) {
      await addModule(course.id, {
        title: mod.title,
        content: mod.content,
        quizQuestions: mod.quizQuestions,
      });
    }
    await updateCourse(course.id, { active: true });
    toast.success("Course created and published!");
    setShowWizard(false);
    load();
  }

  return (
    <SecretariatShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-primary">Courses</h1>
            <p className="text-sm text-text-muted mt-1">Manage training courses available to users</p>
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
          <div className="space-y-3">
            {courses.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-text-muted">
                  <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No courses yet.</p>
                </CardContent>
              </Card>
            )}
            {courses.map(course => (
              <Card key={course.id} className={cn("transition-colors", !course.active && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary">{course.title}</h3>
                        <Badge variant={course.active ? "success" : "default"} className="text-xs">
                          {course.active ? "Active" : "Inactive"}
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
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleActive(course)} className="p-1.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent transition-colors">
                        {course.active ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <Link href={`/secretariat/courses/${course.id}/modules`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          Modules <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
