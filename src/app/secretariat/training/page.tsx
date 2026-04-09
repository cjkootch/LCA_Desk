"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Clock, CheckCircle, Trophy, ChevronRight } from "lucide-react";
import { fetchCourses } from "@/server/actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function SecretariatTrainingPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses("all").then(setCourses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <GraduationCap className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Training & Resources</h1>
          <p className="text-sm text-text-secondary">Learn about the Local Content Act, Secretariat procedures, and compliance requirements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map(course => (
          <Card key={course.id} className="hover:shadow-md transition-shadow group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">{course.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{course.description}</p>
                </div>
                <Badge variant={course.audience === "seeker" ? "accent" : course.audience === "filer" ? "gold" : "default"} className="text-xs shrink-0">
                  {course.audience === "seeker" ? "Workforce" : course.audience === "filer" ? "Compliance" : "General"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{course.moduleCount || 0} modules</span>
                {course.estimatedMinutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{course.estimatedMinutes} min</span>}
                {course.badgeLabel && <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-gold" />{course.badgeLabel}</span>}
              </div>
              {course.progress !== undefined && course.progress > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${course.progress}%` }} />
                  </div>
                  <p className="text-xs text-text-muted mt-1">{course.progress}% complete</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {courses.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <GraduationCap className="h-10 w-10 text-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-text-muted">No training courses available yet.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
