"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, BookOpen, CheckCircle, XCircle, Trophy, ArrowRight, Lock,
  Star, Zap, PartyPopper,
} from "lucide-react";
import { fetchCourseWithModules, completeModule } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Confetti Animation ─────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const colors = ["#047857", "#D4AF37", "#EF4444", "#3B82F6", "#F59E0B", "#10B981"];
  return (
    <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 2;
        const size = 6 + Math.random() * 8;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const rotation = Math.random() * 360;
        return (
          <div key={i} className="absolute animate-confetti-fall"
            style={{
              left: `${left}%`, top: "-20px",
              width: size, height: size * 0.6,
              backgroundColor: color,
              transform: `rotate(${rotation}deg)`,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              opacity: 0.9,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall { animation: confetti-fall linear forwards; }
      `}</style>
    </div>
  );
}

// ─── Celebration Modal ──────────────────────────────────────────
function CelebrationModal({ show, badgeLabel, badgeColor, onClose }: {
  show: boolean; badgeLabel: string; badgeColor: string; onClose: () => void;
}) {
  if (!show) return null;
  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[151] flex items-center justify-center p-4">
        <div className="bg-bg-card rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-celebration-enter">
          <div className="relative mx-auto mb-4">
            <div className={cn("h-20 w-20 rounded-full mx-auto flex items-center justify-center",
              badgeColor === "gold" ? "bg-gold/10" : badgeColor === "success" ? "bg-success/10" : "bg-accent/10"
            )}>
              <Trophy className={cn("h-10 w-10",
                badgeColor === "gold" ? "text-gold" : badgeColor === "success" ? "text-success" : "text-accent"
              )} />
            </div>
            <div className="absolute -top-2 -right-2 animate-bounce">
              <PartyPopper className="h-8 w-8 text-gold" />
            </div>
          </div>
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">Congratulations!</h2>
          <p className="text-text-secondary mb-4">You've completed the course and earned a new badge.</p>
          <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6",
            badgeColor === "gold" ? "bg-gold/10 text-gold" : badgeColor === "success" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
          )}>
            <Trophy className="h-5 w-5" />
            <span className="font-bold text-lg">{badgeLabel}</span>
          </div>
          <div className="space-y-2 text-xs text-text-muted mb-6">
            <p className="flex items-center justify-center gap-1"><Star className="h-3 w-3 text-gold" /> +500 XP earned</p>
            <p className="flex items-center justify-center gap-1"><Zap className="h-3 w-3 text-accent" /> Badge visible on your Talent Pool profile</p>
          </div>
          <Button onClick={onClose} className="w-full">Continue Learning</Button>
        </div>
      </div>
      <style>{`
        @keyframes celebration-enter {
          0% { transform: scale(0.8) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-celebration-enter { animation: celebration-enter 0.4s ease-out; }
      `}</style>
    </>
  );
}

export default function CoursePage() {
  const params = useParams();
  const slug = params.slug as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [activeModule, setActiveModule] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number; badgeEarned?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    fetchCourseWithModules(slug).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  const triggerCelebration = useCallback((badge: boolean) => {
    setShowConfetti(true);
    if (badge) setTimeout(() => setShowCelebration(true), 800);
    setTimeout(() => setShowConfetti(false), 4000);
  }, []);

  if (loading) {
    return (
      <>
        <div className="h-14 border-b border-border bg-bg-surface/95 flex items-center px-6"><p className="text-sm text-text-muted">Loading...</p></div>
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <div className="h-14 border-b border-border bg-bg-surface/95 flex items-center px-6"><p className="text-sm text-text-muted">Course not found</p></div>
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
  const progressPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let quizQuestions: any[] = [];
  try {
    if (currentModule?.quizQuestions) {
      const parsed = JSON.parse(currentModule.quizQuestions);
      if (Array.isArray(parsed) && parsed.length > 0) quizQuestions = parsed;
    }
  } catch {}

  const handleSubmitQuiz = async () => {
    if (quizQuestions.length === 0) { toast.error("Quiz data unavailable"); return; }
    if (Object.keys(answers).length < quizQuestions.length) { toast.error("Please answer all questions"); return; }

    setSubmitting(true);
    try {
      const result = await completeModule(course.id, currentModule.id, answers);
      setQuizResult(result);
      if (result.passed) {
        triggerCelebration(!!result.badgeEarned);
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
      <Confetti active={showConfetti} />
      <CelebrationModal
        show={showCelebration}
        badgeLabel={course.badgeLabel || "Certified"}
        badgeColor={course.badgeColor || "accent"}
        onClose={() => setShowCelebration(false)}
      />

      <div className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
        <h1 className="text-base font-heading font-semibold text-text-primary truncate">{course.title}</h1>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="p-4 sm:p-6 max-w-5xl">
        {/* Course progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{completedCount}/{modules.length} modules</span>
              {hasBadge && <Badge variant="success" className="text-xs gap-0.5"><Trophy className="h-2.5 w-2.5" /> {course.badgeLabel}</Badge>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Star className="h-3 w-3 text-gold" />
              <span>{completedCount * 100} / {modules.length * 100} XP</span>
            </div>
          </div>
          <Progress value={progressPct} className="h-2.5" indicatorClassName={hasBadge ? "bg-success" : "bg-accent"} />
        </div>

        {/* Badge earned banner */}
        {hasBadge && (
          <Card className="border-gold/30 bg-gradient-to-r from-gold/5 to-transparent mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                <Trophy className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Course Complete — {course.badgeLabel} Earned!</p>
                <p className="text-xs text-text-muted">This certification is visible to employers on your Talent Pool profile.</p>
              </div>
              <Badge variant="accent" className="ml-auto gap-1 shrink-0"><CheckCircle className="h-3 w-3" /> {course.badgeLabel}</Badge>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Module sidebar */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Modules</p>
            {modules.map((m: { id: string; title: string; orderIndex: number }, i: number) => {
              const complete = isModuleComplete(m.id);
              const locked = i > 0 && !isModuleComplete(modules[i - 1].id) && !complete;
              return (
                <button key={m.id}
                  onClick={() => { if (!locked) { setActiveModule(i); setShowQuiz(false); setQuizResult(null); setAnswers({}); } }}
                  disabled={locked}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2",
                    activeModule === i ? "bg-accent text-white shadow-sm" :
                    complete ? "bg-success/10 text-success hover:bg-success/15" :
                    locked ? "text-text-muted/50 cursor-not-allowed" :
                    "text-text-secondary hover:bg-bg-primary"
                  )}>
                  {complete ? <CheckCircle className="h-4 w-4 shrink-0" /> :
                   locked ? <Lock className="h-4 w-4 shrink-0" /> :
                   <div className="h-4 w-4 rounded-full border-2 border-current shrink-0 flex items-center justify-center text-[11px] font-bold">{i + 1}</div>}
                  <span className="truncate">{m.title}</span>
                  {complete && <Star className="h-3 w-3 ml-auto text-gold shrink-0" />}
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
                    <Badge variant="default" className="text-xs">Module {activeModule + 1}</Badge>
                    {isModuleComplete(currentModule.id) && <Badge variant="success" className="text-xs gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> Complete</Badge>}
                    <span className="text-xs text-text-muted ml-auto flex items-center gap-0.5"><Star className="h-3 w-3 text-gold" /> +100 XP</span>
                  </div>
                  <CardTitle className="text-lg mt-1">{currentModule.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none mb-6">
                    {currentModule.content.split("\n").map((line: string, i: number) => {
                      const t = line.trim();
                      if (t.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-text-primary mt-5 mb-2">{t.slice(3)}</h2>;
                      if (t.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold text-text-primary mt-4 mb-1">{t.slice(4)}</h3>;
                      if (t.startsWith("- ")) return <li key={i} className="text-sm text-text-secondary ml-4">{t.slice(2)}</li>;
                      if (t.startsWith("**") && t.endsWith("**")) return <p key={i} className="text-sm font-bold text-text-primary">{t.replace(/\*\*/g, "")}</p>;
                      if (t.length === 0) return <div key={i} className="h-3" />;
                      return <p key={i} className="text-sm text-text-secondary leading-relaxed">{t.replace(/\*\*/g, "")}</p>;
                    })}
                  </div>
                  <Button onClick={() => { setShowQuiz(true); setAnswers({}); setQuizResult(null); }} className="gap-1.5" size="lg">
                    Take Quiz <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Quiz — {currentModule.title}</CardTitle>
                      <p className="text-xs text-text-muted mt-1">Pass with {currentModule.passingScore || 80}% to complete this module and earn XP</p>
                    </div>
                    <div className="text-right text-xs text-text-muted">
                      <p>{Object.keys(answers).length}/{quizQuestions.length} answered</p>
                    </div>
                  </div>
                  <Progress value={(Object.keys(answers).length / Math.max(quizQuestions.length, 1)) * 100} className="h-1.5 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                  {quizQuestions.map((q: { question: string; options: string[]; correctIndex: number }, qi: number) => (
                    <div key={qi} className={cn("rounded-lg p-4 transition-colors", answers[qi] !== undefined ? "bg-bg-primary" : "")}>
                      <p className="text-sm font-medium text-text-primary mb-3">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-white text-xs font-bold mr-2">{qi + 1}</span>
                        {q.question}
                      </p>
                      <div className="space-y-2 ml-7">
                        {q.options.map((opt: string, oi: number) => {
                          const selected = answers[qi] === oi;
                          const showResult = quizResult !== null;
                          const isCorrect = oi === q.correctIndex;
                          return (
                            <button key={oi}
                              onClick={() => { if (!quizResult) setAnswers({ ...answers, [qi]: oi }); }}
                              disabled={!!quizResult}
                              className={cn(
                                "w-full text-left px-4 py-2.5 rounded-lg text-sm border-2 transition-all",
                                showResult && isCorrect ? "border-success bg-success/5 text-success font-medium" :
                                showResult && selected && !isCorrect ? "border-danger bg-danger/5 text-danger" :
                                selected ? "border-accent bg-accent/5 text-accent font-medium shadow-sm" :
                                "border-border hover:border-accent/30 hover:bg-bg-primary"
                              )}>
                              <span className="flex items-center justify-between">
                                {opt}
                                {showResult && isCorrect && <CheckCircle className="h-4 w-4 shrink-0" />}
                                {showResult && selected && !isCorrect && <XCircle className="h-4 w-4 shrink-0" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {quizResult ? (
                    <div className={cn("rounded-xl p-5 text-center", quizResult.passed ? "bg-success/5 border border-success/20" : "bg-danger/5 border border-danger/20")}>
                      {quizResult.passed ? (
                        <>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <CheckCircle className="h-6 w-6 text-success" />
                            <span className="text-lg font-bold text-success">Passed!</span>
                          </div>
                          <p className="text-sm text-text-secondary">Score: {quizResult.score}%</p>
                          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gold">
                            <Star className="h-3.5 w-3.5" /> +100 XP earned
                          </div>
                          {quizResult.badgeEarned && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 text-gold text-sm font-medium">
                              <Trophy className="h-4 w-4" /> {course.badgeLabel} Badge Earned!
                            </div>
                          )}
                          {activeModule < modules.length - 1 && (
                            <Button className="mt-4 gap-1" onClick={() => { setActiveModule(activeModule + 1); setShowQuiz(false); setAnswers({}); setQuizResult(null); }}>
                              Next Module <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-6 w-6 text-danger mx-auto mb-2" />
                          <p className="text-lg font-bold text-danger">Not Passed</p>
                          <p className="text-sm text-text-secondary">Score: {quizResult.score}%. Need {currentModule.passingScore || 80}%</p>
                          <Button variant="outline" className="mt-3" onClick={() => { setAnswers({}); setQuizResult(null); }}>
                            Retry Quiz
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setShowQuiz(false)}>Back to Reading</Button>
                      <Button onClick={handleSubmitQuiz} loading={submitting} disabled={Object.keys(answers).length < quizQuestions.length}>
                        Submit Answers ({Object.keys(answers).length}/{quizQuestions.length})
                      </Button>
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
