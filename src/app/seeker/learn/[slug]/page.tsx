"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, BookOpen, CheckCircle, XCircle, Trophy, ArrowRight, Lock,
} from "lucide-react";
import { fetchCourseWithModules, completeModule } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CoursePage() {
  const params = useParams();
  const slug = params.slug as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number; badgeEarned?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCourseWithModules(slug).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Loading..." />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <SeekerTopBar title="Course not found" />
        <div className="p-8 text-center">
          <Link href="/seeker/learn"><Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" /> Back to courses</Button></Link>
        </div>
      </>
    );
  }

  const { course, modules, progress } = data;
  const currentModule = modules[activeModule];
  const isModuleComplete = (moduleId: string) => progress.some((p: { moduleId: string; status: string }) => p.moduleId === moduleId && p.status === "completed");
  const completedCount = modules.filter((m: { id: string }) => isModuleComplete(m.id)).length;
  const hasBadge = progress.some((p: { badgeEarnedAt: Date | null }) => p.badgeEarnedAt);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let quizQuestions: any[] = [];
  try {
    if (currentModule?.quizQuestions) {
      const parsed = JSON.parse(currentModule.quizQuestions);
      if (Array.isArray(parsed) && parsed.length > 0) quizQuestions = parsed;
    }
  } catch {}

  const handleSubmitQuiz = async () => {
    if (quizQuestions.length === 0) {
      toast.error("Quiz data unavailable. Please try again later.");
      return;
    }
    if (Object.keys(answers).length < quizQuestions.length) {
      toast.error("Please answer all questions");
      return;
    }

    setSubmitting(true);
    try {
      // Send answers to server for validation — don't trust client scoring
      const result = await completeModule(course.id, currentModule.id, answers);
      setQuizResult(result);
      if (result.passed) {
        toast.success(result.badgeEarned ? `Quiz passed! You earned the "${course.badgeLabel}" badge!` : "Quiz passed! Module complete.");
        const refreshed = await fetchCourseWithModules(slug);
        if (refreshed) setData(refreshed);
      } else {
        toast.error(`Score: ${result.score}%. You need ${currentModule.passingScore || 80}% to pass.`);
      }
    } catch { toast.error("Failed to submit quiz"); }
    setSubmitting(false);
  };

  return (
    <>
      <SeekerTopBar
        title={course.title}
        action={
          <Link href="/seeker/learn"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        }
      />

      <div className="p-4 sm:p-8 max-w-5xl">
        {/* Badge earned banner */}
        {hasBadge && (
          <Card className="border-gold/30 bg-gold-light mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-gold" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Course Complete — {course.badgeLabel} Earned!</p>
                <p className="text-xs text-text-muted">This badge is visible on your talent pool profile.</p>
              </div>
              <Badge variant="accent" className="ml-auto gap-1"><CheckCircle className="h-3 w-3" /> {course.badgeLabel}</Badge>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Module sidebar */}
          <div className="space-y-1">
            <p className="text-xs text-text-muted mb-2">{completedCount}/{modules.length} modules</p>
            {modules.map((m: { id: string; title: string; orderIndex: number }, i: number) => {
              const complete = isModuleComplete(m.id);
              const locked = i > 0 && !isModuleComplete(modules[i - 1].id) && !complete;
              return (
                <button
                  key={m.id}
                  onClick={() => { if (!locked) { setActiveModule(i); setShowQuiz(false); setQuizResult(null); setAnswers({}); } }}
                  disabled={locked}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                    activeModule === i ? "bg-accent text-white" :
                    complete ? "bg-success-light text-success" :
                    locked ? "text-text-muted cursor-not-allowed" :
                    "text-text-secondary hover:bg-bg-primary"
                  )}
                >
                  {complete ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> :
                   locked ? <Lock className="h-3.5 w-3.5 shrink-0" /> :
                   <span className="h-3.5 w-3.5 rounded-full border border-current shrink-0 flex items-center justify-center text-[9px]">{i + 1}</span>}
                  <span className="truncate">{m.title}</span>
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div className="lg:col-span-3">
            {!showQuiz ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[10px]">Module {activeModule + 1}</Badge>
                    {isModuleComplete(currentModule.id) && <Badge variant="success" className="text-[10px] gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> Complete</Badge>}
                  </div>
                  <CardTitle className="text-lg mt-1">{currentModule.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Render markdown content */}
                  <div className="prose prose-sm max-w-none mb-6">
                    {currentModule.content.split("\n").map((line: string, i: number) => {
                      const t = line.trim();
                      if (t.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-text-primary mt-4 mb-2">{t.slice(3)}</h2>;
                      if (t.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold text-text-primary mt-3 mb-1">{t.slice(4)}</h3>;
                      if (t.startsWith("- ")) return <li key={i} className="text-sm text-text-secondary ml-4">{t.slice(2)}</li>;
                      if (t.startsWith("**") && t.endsWith("**")) return <p key={i} className="text-sm font-bold text-text-primary">{t.replace(/\*\*/g, "")}</p>;
                      if (t.length === 0) return <div key={i} className="h-2" />;
                      return <p key={i} className="text-sm text-text-secondary">{t.replace(/\*\*/g, "")}</p>;
                    })}
                  </div>

                  <Button onClick={() => { setShowQuiz(true); setAnswers({}); setQuizResult(null); }} className="gap-1.5">
                    Take Quiz <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quiz — {currentModule.title}</CardTitle>
                  <p className="text-xs text-text-muted">Pass with {currentModule.passingScore || 80}% to complete this module</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {quizQuestions.map((q: { question: string; options: string[]; correctIndex: number }, qi: number) => (
                    <div key={qi}>
                      <p className="text-sm font-medium text-text-primary mb-2">{qi + 1}. {q.question}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt: string, oi: number) => {
                          const selected = answers[qi] === oi;
                          const showResult = quizResult !== null;
                          const isCorrect = oi === q.correctIndex;
                          return (
                            <button
                              key={oi}
                              onClick={() => { if (!quizResult) setAnswers({ ...answers, [qi]: oi }); }}
                              disabled={!!quizResult}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors",
                                showResult && isCorrect ? "border-success bg-success-light text-success" :
                                showResult && selected && !isCorrect ? "border-danger bg-danger-light text-danger" :
                                selected ? "border-accent bg-accent-light text-accent" :
                                "border-border hover:border-accent/30"
                              )}
                            >
                              {opt}
                              {showResult && isCorrect && <CheckCircle className="inline h-3.5 w-3.5 ml-2" />}
                              {showResult && selected && !isCorrect && <XCircle className="inline h-3.5 w-3.5 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {quizResult ? (
                    <div className={cn("rounded-lg p-4", quizResult.passed ? "bg-success-light" : "bg-danger-light")}>
                      <p className="text-sm font-semibold">{quizResult.passed ? "Passed!" : "Not Passed"} — Score: {quizResult.score}%</p>
                      {quizResult.badgeEarned && <p className="text-xs mt-1">You earned the {course.badgeLabel} badge!</p>}
                      {!quizResult.passed && (
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => { setAnswers({}); setQuizResult(null); }}>
                          Retry Quiz
                        </Button>
                      )}
                      {quizResult.passed && activeModule < modules.length - 1 && (
                        <Button size="sm" className="mt-2" onClick={() => { setActiveModule(activeModule + 1); setShowQuiz(false); setAnswers({}); setQuizResult(null); }}>
                          Next Module <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowQuiz(false)}>Back to Reading</Button>
                      <Button onClick={handleSubmitQuiz} loading={submitting}>Submit Answers</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
