"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slideshow } from "@/components/training/Slideshow";
import { cn } from "@/lib/utils";
import { X, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Eye, Edit2 } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CourseWizardProps {
  jurisdictionCode?: string;
  lockJurisdiction?: boolean;
  onSave: (data: {
    title: string;
    slug: string;
    description: string;
    audience: string;
    jurisdictionCode: string;
    badgeLabel: string;
    badgeColor: string;
    estimatedMinutes: number;
    modules: Array<{ title: string; content: string; quizQuestions: string }>;
  }) => Promise<void>;
  onClose: () => void;
}

interface GeneratedModule {
  title: string;
  content: string;
  quiz: unknown[];
}

// ---------------------------------------------------------------------------
// Template defaults
// ---------------------------------------------------------------------------

const TEMPLATE_TOPICS: Record<string, string[]> = {
  compliance_overview: ["Legal framework", "Filing obligations", "Penalties", "Compliance cycle", "Enforcement"],
  practical_guide: ["Getting started", "Data entry", "Common mistakes", "Tips & tricks", "Submission process"],
  industry_orientation: ["Sector overview", "Key players", "Career paths", "Opportunities", "Getting started"],
  skills_training: ["Fundamentals", "Core techniques", "Practice exercises", "Advanced topics", "Assessment"],
};

const TEMPLATES = [
  { value: "compliance_overview", label: "Compliance Overview", description: "Regulation deep-dive" },
  { value: "practical_guide", label: "Practical Guide", description: "Step-by-step" },
  { value: "industry_orientation", label: "Industry Orientation", description: "Sector overview" },
  { value: "skills_training", label: "Skills Training", description: "Skill development" },
];

const BADGE_COLORS = [
  { value: "accent", label: "Green", hex: "#047857" },
  { value: "gold", label: "Gold", hex: "#D4AF37" },
  { value: "success", label: "Emerald", hex: "#10B981" },
  { value: "danger", label: "Red", hex: "#EF4444" },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Settings", "Topics", "Generating", "Review"];
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                isActive && "bg-accent border-accent text-white",
                isDone && "bg-accent/20 border-accent text-accent",
                !isActive && !isDone && "bg-bg-surface border-border text-text-muted"
              )}
            >
              {step}
            </div>
            <span
              className={cn(
                "text-xs font-medium hidden sm:block",
                isActive ? "text-text-primary" : "text-text-muted"
              )}
            >
              {labels[i]}
            </span>
            {step < total && <div className="w-8 h-px bg-border hidden sm:block" />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function CourseWizard({ jurisdictionCode: defaultJurisdiction = "GY", lockJurisdiction = false, onSave, onClose }: CourseWizardProps) {
  const [step, setStep] = useState(1);

  // Step 1 state
  const [settings, setSettings] = useState({
    title: "",
    description: "",
    audience: "all",
    jurisdictionCode: defaultJurisdiction,
    moduleCount: 5,
    template: "compliance_overview",
  });

  // Step 2 state
  const [topics, setTopics] = useState<string[]>(TEMPLATE_TOPICS["compliance_overview"]);

  // Step 3 state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 4 state
  const [modules, setModules] = useState<GeneratedModule[]>([]);
  const [expandedModule, setExpandedModule] = useState<number | null>(0);
  const [editingContent, setEditingContent] = useState<Set<number>>(new Set());
  const [editingQuiz, setEditingQuiz] = useState<Set<number>>(new Set());
  const [slideshowModule, setSlideshowModule] = useState<number | null>(null);
  const [showFullContent, setShowFullContent] = useState<Set<number>>(new Set());
  const [showBadgeSettings, setShowBadgeSettings] = useState(false);
  const [badgeLabel, setBadgeLabel] = useState("");
  const [badgeColor, setBadgeColor] = useState("accent");
  const [estimatedMinutes, setEstimatedMinutes] = useState(75);
  const [saving, setSaving] = useState(false);
  const [regeneratingQuiz, setRegeneratingQuiz] = useState<Set<number>>(new Set());

  // Sync estimatedMinutes when moduleCount changes
  useEffect(() => {
    setEstimatedMinutes(settings.moduleCount * 15);
  }, [settings.moduleCount]);

  // Update topics when template changes
  function handleTemplateChange(template: string) {
    setSettings(s => ({ ...s, template }));
    setTopics(TEMPLATE_TOPICS[template] ?? []);
  }

  // ---------------------------------------------------------------------------
  // Step 1 → 2
  // ---------------------------------------------------------------------------

  function goToTopics() {
    if (!settings.title.trim()) {
      toast.error("Please enter a course title");
      return;
    }
    setStep(2);
  }

  // ---------------------------------------------------------------------------
  // Step 2 → 3 (generate)
  // ---------------------------------------------------------------------------

  async function generate() {
    setStep(3);
    setGenerating(true);
    setGenError(null);
    setProgress(0);

    // Fake progress up to 95%
    progressRef.current = setInterval(() => {
      setProgress(p => (p < 95 ? p + 2 : p));
    }, 500);

    try {
      const res = await fetch("/api/ai/course-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settings.title,
          topics: topics.filter(t => t.trim()),
          audience: settings.audience,
          jurisdictionCode: settings.jurisdictionCode,
          moduleCount: settings.moduleCount,
          template: settings.template,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Generation failed");
      }

      const data = (await res.json()) as { modules: GeneratedModule[] };

      if (!data.modules || !Array.isArray(data.modules)) {
        throw new Error("Invalid response from AI");
      }

      setModules(data.modules);
      setProgress(100);
      setStep(4);
      setExpandedModule(0);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      setGenerating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 4 helpers
  // ---------------------------------------------------------------------------

  function updateModuleTitle(idx: number, title: string) {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, title } : m));
  }

  function updateModuleContent(idx: number, content: string) {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, content } : m));
  }

  function updateModuleQuiz(idx: number, quizStr: string) {
    try {
      const parsed = JSON.parse(quizStr) as unknown[];
      setModules(prev => prev.map((m, i) => i === idx ? { ...m, quiz: parsed } : m));
    } catch {
      // Keep raw string in quiz field as-is — will be serialized as string later
      setModules(prev => prev.map((m, i) => i === idx ? { ...m, quiz: quizStr as unknown as unknown[] } : m));
    }
  }

  async function regenerateQuiz(idx: number) {
    const mod = modules[idx];
    if (!mod) return;

    setRegeneratingQuiz(prev => new Set(prev).add(idx));
    try {
      const res = await fetch("/api/ai/quiz-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: mod.content, moduleTitle: mod.title, questionCount: 6 }),
      });
      if (!res.ok) throw new Error("Failed to regenerate quiz");
      const data = (await res.json()) as { questions: unknown[] };
      setModules(prev => prev.map((m, i) => i === idx ? { ...m, quiz: data.questions } : m));
      toast.success("Quiz regenerated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate quiz");
    } finally {
      setRegeneratingQuiz(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!settings.title.trim()) {
      toast.error("Course title is required");
      return;
    }
    if (modules.length === 0) {
      toast.error("No modules to save");
      return;
    }
    setSaving(true);
    try {
      const slug = settings.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      await onSave({
        title: settings.title,
        slug,
        description: settings.description,
        audience: settings.audience,
        jurisdictionCode: settings.jurisdictionCode,
        badgeLabel: badgeLabel || `${settings.title} Certified`,
        badgeColor,
        estimatedMinutes,
        modules: modules.map(m => ({
          title: m.title,
          content: m.content,
          quizQuestions: typeof m.quiz === "string" ? (m.quiz as string) : JSON.stringify(m.quiz),
        })),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save course");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-bg-primary overflow-auto" style={{ top: "var(--demo-banner-h, 0px)" }}>
      {/* Header */}
      <div className="sticky z-10 bg-bg-primary border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between" style={{ top: 0 }}>
        <StepIndicator current={step} total={4} />
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* ------------------------------------------------------------------ */}
        {/* Step 1 — Course Settings                                           */}
        {/* ------------------------------------------------------------------ */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">Course Settings</h1>
              <p className="text-sm text-text-muted mt-1">Configure the basics for your new AI-generated course</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-primary">Course Title *</label>
                <input
                  className="input mt-1 w-full"
                  value={settings.title}
                  onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
                  placeholder="e.g. Local Content Compliance Fundamentals"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Description</label>
                <textarea
                  className="input mt-1 w-full resize-none"
                  rows={3}
                  value={settings.description}
                  onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
                  placeholder="Brief description of this course..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-primary">Audience</label>
                  <select
                    className="input mt-1 w-full"
                    value={settings.audience}
                    onChange={e => setSettings(s => ({ ...s, audience: e.target.value }))}
                  >
                    <option value="all">All</option>
                    <option value="filer">Filer</option>
                    <option value="seeker">Seeker</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-text-primary">Jurisdiction</label>
                  <select
                    className="input mt-1 w-full"
                    value={settings.jurisdictionCode}
                    onChange={e => setSettings(s => ({ ...s, jurisdictionCode: e.target.value }))}
                    disabled={lockJurisdiction}
                  >
                    <option value="GY">GY — Guyana</option>
                    <option value="NG">NG — Nigeria</option>
                    <option value="NA">NA — Namibia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Number of Modules</label>
                <input
                  className="input mt-1 w-28"
                  type="number"
                  min={3}
                  max={8}
                  value={settings.moduleCount}
                  onChange={e => setSettings(s => ({ ...s, moduleCount: Math.min(8, Math.max(3, Number(e.target.value))) }))}
                />
                <p className="text-xs text-text-muted mt-1">Between 3 and 8 modules</p>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">Template</label>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTemplateChange(t.value)}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-colors",
                        settings.template === t.value
                          ? "border-accent bg-accent/10"
                          : "border-border bg-bg-surface hover:border-accent/40"
                      )}
                    >
                      <div className="font-medium text-sm text-text-primary">{t.label}</div>
                      <div className="text-xs text-text-muted mt-0.5">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={goToTopics} className="gap-2">
                Next: Add Topics →
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 2 — Topics                                                    */}
        {/* ------------------------------------------------------------------ */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">Course Topics</h1>
              <p className="text-sm text-text-muted mt-1">Add the topics you want to cover. The AI will generate content for each.</p>
            </div>

            <div className="space-y-2">
              {topics.map((topic, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-5 text-right">{idx + 1}.</span>
                  <input
                    className="input flex-1"
                    value={topic}
                    onChange={e => {
                      const next = [...topics];
                      next[idx] = e.target.value;
                      setTopics(next);
                    }}
                    placeholder={`Topic ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => setTopics(topics.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded hover:bg-bg-surface text-text-muted hover:text-red-500 transition-colors"
                    aria-label="Remove topic"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTopics([...topics, ""])}
                className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors mt-1 font-medium"
              >
                <Plus className="h-4 w-4" /> Add topic
              </button>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button
                onClick={generate}
                disabled={topics.filter(t => t.trim()).length === 0}
                className="gap-2"
              >
                Generate with AI →
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 3 — Generating                                                */}
        {/* ------------------------------------------------------------------ */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
            {!genError ? (
              <>
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl">✨</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-heading font-bold text-text-primary">Generating your course...</h2>
                  <p className="text-text-muted text-sm max-w-sm">
                    Claude is creating {settings.moduleCount} modules with slides, diagrams, and quizzes. This takes about 30 seconds.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-1">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-text-muted text-right">{progress}%</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-heading font-bold text-text-primary">Generation Failed</h2>
                  <p className="text-text-muted text-sm max-w-sm">{genError}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>← Back to Topics</Button>
                  <Button onClick={generate}>Try Again</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Step 4 — Review & Edit                                             */}
        {/* ------------------------------------------------------------------ */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">Review &amp; Edit</h1>
              <p className="text-sm text-text-muted mt-1">
                {modules.length} modules generated. Review and edit before publishing.
              </p>
            </div>

            {/* Module accordion */}
            <div className="space-y-3">
              {modules.map((mod, idx) => {
                const isExpanded = expandedModule === idx;
                const isEditingContent = editingContent.has(idx);
                const isEditingQuiz = editingQuiz.has(idx);
                const isShowingFull = showFullContent.has(idx);
                const quizCount = Array.isArray(mod.quiz) ? mod.quiz.length : 0;
                const isRegenerating = regeneratingQuiz.has(idx);

                return (
                  <div key={idx} className="border border-border rounded-lg overflow-hidden bg-bg-surface">
                    {/* Accordion header */}
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-4 hover:bg-bg-primary transition-colors"
                      onClick={() => setExpandedModule(isExpanded ? null : idx)}
                    >
                      <div className="flex items-center gap-3 min-w-0 text-left">
                        <span className="h-6 w-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-text-primary truncate">{mod.title || `Module ${idx + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {quizCount > 0 && (
                          <Badge variant="default" className="text-xs">{quizCount} Q</Badge>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                      </div>
                    </button>

                    {/* Accordion content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border">
                        {/* Title edit */}
                        <div className="pt-3">
                          <label className="text-xs font-medium text-text-muted">Module Title</label>
                          <input
                            className="input mt-1 w-full"
                            value={mod.title}
                            onChange={e => updateModuleTitle(idx, e.target.value)}
                          />
                        </div>

                        {/* Content section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-text-muted">Content</label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSlideshowModule(idx)}
                                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" /> Preview Slideshow
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingContent(prev => {
                                  const next = new Set(prev);
                                  if (next.has(idx)) next.delete(idx); else next.add(idx);
                                  return next;
                                })}
                                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary font-medium transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> {isEditingContent ? "Collapse" : "Edit Content"}
                              </button>
                            </div>
                          </div>

                          {isEditingContent ? (
                            <textarea
                              className="input w-full resize-y font-mono text-xs"
                              rows={12}
                              value={mod.content}
                              onChange={e => updateModuleContent(idx, e.target.value)}
                            />
                          ) : (
                            <div className="bg-bg-primary rounded-lg p-3 text-sm text-text-secondary border border-border">
                              <p className="whitespace-pre-wrap break-words">
                                {isShowingFull ? mod.content : (mod.content.slice(0, 200) + (mod.content.length > 200 ? "..." : ""))}
                              </p>
                              {mod.content.length > 200 && (
                                <button
                                  type="button"
                                  className="text-xs text-accent hover:text-accent/80 mt-1 font-medium transition-colors"
                                  onClick={() => setShowFullContent(prev => {
                                    const next = new Set(prev);
                                    if (next.has(idx)) next.delete(idx); else next.add(idx);
                                    return next;
                                  })}
                                >
                                  {isShowingFull ? "Show less" : "Show full"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quiz section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-text-muted">
                              Quiz{" "}
                              <Badge variant="default" className="text-xs ml-1">{quizCount} questions</Badge>
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => regenerateQuiz(idx)}
                                disabled={isRegenerating}
                                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
                                {isRegenerating ? "Regenerating..." : "Regenerate Quiz"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingQuiz(prev => {
                                  const next = new Set(prev);
                                  if (next.has(idx)) next.delete(idx); else next.add(idx);
                                  return next;
                                })}
                                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary font-medium transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> {isEditingQuiz ? "Collapse" : "Edit JSON"}
                              </button>
                            </div>
                          </div>

                          {isEditingQuiz && (
                            <textarea
                              className="input w-full resize-y font-mono text-xs"
                              rows={8}
                              value={typeof mod.quiz === "string" ? (mod.quiz as string) : JSON.stringify(mod.quiz, null, 2)}
                              onChange={e => updateModuleQuiz(idx, e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Badge settings */}
            <div className="border border-border rounded-lg overflow-hidden bg-bg-surface">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-bg-primary transition-colors"
                onClick={() => setShowBadgeSettings(v => !v)}
              >
                <span className="font-medium text-text-primary text-sm">Badge &amp; Completion Settings</span>
                {showBadgeSettings ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              </button>
              {showBadgeSettings && (
                <div className="px-4 pb-4 space-y-4 border-t border-border">
                  <div className="pt-3">
                    <label className="text-xs font-medium text-text-muted">Badge Label</label>
                    <input
                      className="input mt-1 w-full"
                      value={badgeLabel}
                      onChange={e => setBadgeLabel(e.target.value)}
                      placeholder={`${settings.title} Certified`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted block mb-2">Badge Color</label>
                    <div className="flex gap-3">
                      {BADGE_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setBadgeColor(c.value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-colors",
                            badgeColor === c.value ? "border-accent" : "border-transparent"
                          )}
                        >
                          <div className="h-6 w-6 rounded-full" style={{ backgroundColor: c.hex }} />
                          <span className="text-xs text-text-muted">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted">Estimated Minutes</label>
                    <input
                      className="input mt-1 w-32"
                      type="number"
                      min={1}
                      value={estimatedMinutes}
                      onChange={e => setEstimatedMinutes(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-between pt-2 pb-8">
              <Button variant="outline" onClick={() => setStep(1)}>← Back to Settings</Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  loading={saving}
                  disabled={saving || modules.length === 0}
                >
                  Save as Draft
                </Button>
                <Button
                  onClick={handleSave}
                  loading={saving}
                  disabled={saving || modules.length === 0}
                >
                  Save &amp; Publish
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slideshow overlay */}
      {slideshowModule !== null && modules[slideshowModule] && (
        <Slideshow
          content={modules[slideshowModule].content}
          title={`${settings.title} — ${modules[slideshowModule].title}`}
          courseTitle={settings.title}
          moduleTitle={modules[slideshowModule].title}
          onClose={() => setSlideshowModule(null)}
          isModuleComplete={false}
        />
      )}
    </div>
  );
}
