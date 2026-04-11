"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, BookOpen, Clock, Users, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";
import { checkSuperAdmin, fetchAdminCourses, createCourse, updateCourse } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

function NewCourseModal({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ slug: "", title: "", description: "", audience: "all", badgeLabel: "", estimatedMinutes: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug || !form.title) { toast.error("Slug and title are required"); return; }
    setSaving(true);
    try {
      await createCourse({
        slug: form.slug,
        title: form.title,
        description: form.description || undefined,
        audience: form.audience,
        badgeLabel: form.badgeLabel || undefined,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
      });
      toast.success("Course created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-bg-surface rounded-xl border border-border shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">New Course</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-text-muted">Slug (URL-safe, unique)</label>
            <input className="input mt-1 w-full" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="my-course-slug" required />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted">Title</label>
            <input className="input mt-1 w-full" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Course title" required />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted">Description</label>
            <textarea className="input mt-1 w-full resize-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-muted">Audience</label>
              <select className="input mt-1 w-full" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                <option value="all">All</option>
                <option value="filer">Filer</option>
                <option value="secretariat">Secretariat</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted">Est. Minutes</label>
              <input className="input mt-1 w-full" type="number" value={form.estimatedMinutes} onChange={e => setForm({ ...form, estimatedMinutes: e.target.value })} placeholder="60" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted">Badge Label</label>
            <input className="input mt-1 w-full" value={form.badgeLabel} onChange={e => setForm({ ...form, badgeLabel: e.target.value })} placeholder="LCA Certified" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Course</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCoursesPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

  async function load() {
    try {
      const data = await fetchAdminCourses();
      setCourses(data);
    } catch { toast.error("Failed to load courses"); }
  }

  useEffect(() => {
    checkSuperAdmin().then(isAdmin => {
      if (!isAdmin) { router.replace("/dashboard"); return; }
      setAuthorized(true);
      load().finally(() => setLoading(false));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleActive(course: Course) {
    try {
      await updateCourse(course.id, { active: !course.active });
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, active: !c.active } : c));
      toast.success(course.active ? "Course deactivated" : "Course activated");
    } catch { toast.error("Failed to update course"); }
  }

  if (!authorized || loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <TopBar title="Course Management" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-primary">Courses</h1>
            <p className="text-sm text-text-muted mt-1">{courses.length} course{courses.length !== 1 ? "s" : ""} total</p>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Course
          </Button>
        </div>

        <div className="space-y-3">
          {courses.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-text-muted">
                <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No courses yet. Create your first course.</p>
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
                    <p className="text-xs text-text-muted mt-0.5">{course.slug}</p>
                    {course.description && <p className="text-sm text-text-secondary mt-1 line-clamp-2">{course.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{course.moduleCount ?? 0} modules</span>
                      {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{course.estimatedMinutes} min</span>}
                      {course.badgeLabel && <span className="flex items-center gap-1">🏅 {course.badgeLabel}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(course)} className="p-1.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent transition-colors" title={course.active ? "Deactivate" : "Activate"}>
                      {course.active ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <Link href={`/dashboard/admin/courses/${course.id}/modules`}>
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
      </div>

      {showNew && (
        <NewCourseModal
          onCreated={() => { setShowNew(false); load(); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  );
}
