"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slideshow } from "@/components/training/Slideshow";
import { cn } from "@/lib/utils";
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Eye, Edit2,
  CheckCircle, Sparkles, Users, Briefcase, Building2, GraduationCap,
  GripVertical, Scale, BookOpen, Globe, Zap, FileText, Trophy, ImageIcon,
  Presentation,
} from "lucide-react";
import { ImageUpload } from "@/components/training/ImageUpload";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CourseWizardProps {
  jurisdictionCode?: string;
  lockJurisdiction?: boolean;
  onSave: (data: {
    title: string; slug: string; description: string; audience: string;
    jurisdictionCode: string; badgeLabel: string; badgeColor: string;
    estimatedMinutes: number; isPublished: boolean;
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
// Static data
// ---------------------------------------------------------------------------

const TEMPLATE_TOPICS: Record<string, string[]> = {
  compliance_overview: ["Legal framework", "Filing obligations", "Penalties & enforcement", "Compliance cycle", "Key definitions"],
  practical_guide: ["Getting started", "Data entry step-by-step", "Common mistakes", "Tips & tricks", "Submission process"],
  industry_orientation: ["Sector overview", "Key players & regulators", "Career pathways", "Business opportunities", "Getting registered"],
  skills_training: ["Core fundamentals", "Essential techniques", "Practical exercises", "Advanced application", "Assessment & review"],
};

const TEMPLATES = [
  { value: "compliance_overview", label: "Compliance Overview", description: "Regulation deep-dive with legal references", icon: Scale, recommended: true },
  { value: "practical_guide", label: "Practical Guide", description: "Step-by-step how-to for practitioners", icon: BookOpen, recommended: false },
  { value: "industry_orientation", label: "Industry Orientation", description: "Sector overview for newcomers", icon: Globe, recommended: false },
  { value: "skills_training", label: "Skills Training", description: "Targeted skill development with exercises", icon: Zap, recommended: false },
];

const AUDIENCES = [
  { value: "all", label: "All Users", description: "General petroleum sector", icon: Users },
  { value: "filer", label: "Filers", description: "Compliance professionals", icon: FileText },
  { value: "seeker", label: "Job Seekers", description: "Entering the sector", icon: GraduationCap },
  { value: "supplier", label: "Suppliers", description: "LCS certification", icon: Building2 },
];

const JURISDICTIONS = [
  { value: "GY", label: "Guyana", sub: "Local Content Act 2021" },
  { value: "NG", label: "Nigeria", sub: "NOGICD Act 2010" },
  { value: "NA", label: "Namibia", sub: "NAMCOR oversight" },
  { value: "SR", label: "Suriname", sub: "Emerging framework" },
];

const BADGE_COLORS = [
  { value: "accent", label: "Green", hex: "#047857" },
  { value: "gold", label: "Gold", hex: "#D4AF37" },
  { value: "success", label: "Emerald", hex: "#10B981" },
  { value: "danger", label: "Red", hex: "#EF4444" },
];

const STEP_LABELS = ["Course Details", "Topics", "Generate", "Review & Publish"];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {STEP_LABELS.map((label, i) => {
        const done = i + 1 < step;
        const active = i + 1 === step;
        return (
          <div key={i} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
              done ? "bg-accent text-white" :
              active ? "bg-accent text-white ring-4 ring-accent/20" :
              "bg-bg-surface border border-border text-text-muted"
            )}>
              {done ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium hidden sm:block truncate",
              active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
            )}>{label}</span>
            {i < 3 && (
              <div className={cn("flex-1 h-0.5 rounded min-w-2", done ? "bg-accent" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function CourseWizard({
  jurisdictionCode: defaultJurisdiction = "GY",
  lockJurisdiction = false,
  onSave,
  onClose,
}: CourseWizardProps) {
  const [step, setStep] = useState(1);

  // Step 1
  const [settings, setSettings] = useState({
    title: "",
    description: "",
    audience: "all",
    jurisdictionCode: defaultJurisdiction,
    moduleCount: 5,
    template: "compliance_overview",
  });

  // Step 2
  const [topics, setTopics] = useState<string[]>(TEMPLATE_TOPICS.compliance_overview);
  const [aiSuggestedIndices, setAiSuggestedIndices] = useState<Set<number>>(new Set());
  const [suggestingTopics, setSuggestingTopics] = useState(false);

  // Step 3
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [genStage, setGenStage] = useState("Initialising...");
  const stageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Step 4
  const [modules, setModules] = useState<GeneratedModule[]>([]);
  const [expandedModule, setExpandedModule] = useState<number | null>(0);
  const [editingContent, setEditingContent] = useState<Set<number>>(new Set());
  const [editingQuiz, setEditingQuiz] = useState<Set<number>>(new Set());
  const [showFullContent, setShowFullContent] = useState<Set<number>>(new Set());
  const [showBadgeSettings, setShowBadgeSettings] = useState(false);
  const [badgeLabel, setBadgeLabel] = useState("");
  const [badgeColor, setBadgeColor] = useState("accent");
  const [estimatedMinutes, setEstimatedMinutes] = useState(75);
  const [saving, setSaving] = useState(false);
  const [regeneratingQuiz, setRegeneratingQuiz] = useState<Set<number>>(new Set());
  const [showImageUpload, setShowImageUpload] = useState<Set<number>>(new Set());
  const [slideshowModule, setSlideshowModule] = useState<number | null>(null);
  const [previewAllMode, setPreviewAllMode] = useState(false);
  const [previewModule, setPreviewModule] = useState<number | null>(null);

  // Sync est. minutes from module count
  useEffect(() => {
    setEstimatedMinutes(settings.moduleCount * 15);
  }, [settings.moduleCount]);

  // ---------------------------------------------------------------------------
  // Template change — update topics to defaults
  // ---------------------------------------------------------------------------

  function handleTemplateChange(template: string) {
    setSettings(s => ({ ...s, template }));
    setTopics(TEMPLATE_TOPICS[template] ?? []);
    setAiSuggestedIndices(new Set());
  }

  // ---------------------------------------------------------------------------
  // Step 1 → 2: call AI to suggest topics
  // ---------------------------------------------------------------------------

  async function goToTopics() {
    if (!settings.title.trim()) { toast.error("Please enter a course title"); return; }
    setStep(2);
    setSuggestingTopics(true);

    try {
      const res = await fetch("/api/ai/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settings.title,
          description: settings.description,
          audience: settings.audience,
          jurisdictionCode: settings.jurisdictionCode,
          template: settings.template,
          moduleCount: settings.moduleCount,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { topics: string[] };
        if (data.topics?.length > 0) {
          setTopics(data.topics);
          setAiSuggestedIndices(new Set(data.topics.map((_, i) => i)));
        }
      }
    } catch {
      // Silently fall back to template defaults — already set above
    } finally {
      setSuggestingTopics(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2 → 3: generate course
  // ---------------------------------------------------------------------------

  async function generate() {
    setStep(3);
    setGenerating(true);
    setGenError(null);
    setProgress(5);
    setGenStage("Analyzing your topics...");

    // Clear any previous timers
    stageTimersRef.current.forEach(clearTimeout);

    const stages = [
      { delay: 3000, stage: "Building module outlines...", progress: 15 },
      { delay: 6000, stage: "Writing slide content...", progress: 30 },
      { delay: 10000, stage: "Creating diagrams...", progress: 45 },
      { delay: 15000, stage: "Generating scenarios...", progress: 60 },
      { delay: 20000, stage: "Building quiz questions...", progress: 75 },
      { delay: 25000, stage: "Finalizing modules...", progress: 85 },
      { delay: 30000, stage: "Almost done...", progress: 92 },
    ];

    stageTimersRef.current = stages.map(s =>
      setTimeout(() => {
        setGenStage(s.stage);
        setProgress(s.progress);
      }, s.delay)
    );

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

      if (!res.ok) throw new Error((await res.text()) || "Generation failed");

      const data = (await res.json()) as { modules: GeneratedModule[] };
      if (!data.modules || !Array.isArray(data.modules)) throw new Error("Invalid AI response");

      stageTimersRef.current.forEach(clearTimeout);
      setModules(data.modules);
      setProgress(100);
      setGenStage("Done!");
      setStep(4);
      setExpandedModule(0);
    } catch (err) {
      stageTimersRef.current.forEach(clearTimeout);
      setGenError(err instanceof Error ? err.message : "Generation failed");
      setProgress(0);
    } finally {
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
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegeneratingQuiz(prev => { const s = new Set(prev); s.delete(idx); return s; });
    }
  }

  // LocalStorage autosave key
  const DRAFT_KEY = "lca_wizard_draft";

  // Autosave whenever meaningful state changes
  useEffect(() => {
    if (step >= 2 && (topics.length > 0 || modules.length > 0)) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ settings, topics, modules, step }));
      } catch { /* storage not available */ }
    }
  }, [settings, topics, modules, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { settings: typeof settings; topics: string[]; modules: GeneratedModule[]; step: number };
        if (draft.settings?.title) {
          setSettings(draft.settings);
          setTopics(draft.topics ?? []);
          setModules(draft.modules ?? []);
          setStep(draft.step ?? 1);
          toast.success("Draft restored — pick up where you left off");
        }
      }
    } catch { /* ignore corrupted draft */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(isPublished: boolean) {
    if (!settings.title.trim()) { toast.error("Course title required"); return; }
    if (modules.length === 0) { toast.error("No modules to save"); return; }
    setSaving(true);
    try {
      const slug = settings.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await onSave({
        title: settings.title,
        slug,
        description: settings.description,
        audience: settings.audience,
        jurisdictionCode: settings.jurisdictionCode,
        badgeLabel: badgeLabel || `${settings.title} Certified`,
        badgeColor,
        estimatedMinutes,
        isPublished,
        modules: modules.map(m => ({
          title: m.title,
          content: m.content,
          quizQuestions: typeof m.quiz === "string" ? (m.quiz as string) : JSON.stringify(m.quiz),
        })),
      });
      // Clear the draft on successful save
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 bg-bg-primary overflow-auto"
      style={{ top: "var(--demo-banner-h, 0px)" }}
    >
      {/* Sticky header */}
      <div
        className="sticky z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-border px-4 sm:px-8 py-4"
        style={{ top: 0 }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <StepIndicator step={step} />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors shrink-0"
            aria-label="Close wizard"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 pb-32">

        {/* ================================================================ */}
        {/* STEP 1 — Course Details                                          */}
        {/* ================================================================ */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">Create a New Course</h1>
              <p className="text-sm text-text-muted mt-1">Tell the AI what to build — it handles the rest.</p>
            </div>

            {/* Title + description */}
            <div className="rounded-xl border border-border bg-bg-card p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-text-primary">Course Title <span className="text-red-500">*</span></label>
                <input
                  className="input mt-1.5 w-full text-base"
                  value={settings.title}
                  onChange={e => setSettings(s => ({ ...s, title: e.target.value }))}
                  placeholder="e.g. Advanced Compliance Reporting for Contractors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary">Description <span className="text-text-muted font-normal">(optional)</span></label>
                <textarea
                  className="input mt-1.5 w-full resize-none"
                  rows={2}
                  value={settings.description}
                  onChange={e => setSettings(s => ({ ...s, description: e.target.value }))}
                  placeholder="What will learners be able to do after this course?"
                />
              </div>
            </div>

            {/* Audience */}
            <div>
              <label className="text-sm font-semibold text-text-primary block mb-3">Target Audience</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {AUDIENCES.map(a => {
                  const Icon = a.icon;
                  const active = settings.audience === a.value;
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, audience: a.value }))}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                        active
                          ? "border-accent bg-accent/5 shadow-sm"
                          : "border-border bg-bg-card hover:border-accent/40 hover:bg-bg-surface"
                      )}
                    >
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", active ? "bg-accent/10" : "bg-bg-primary")}>
                        <Icon className={cn("h-5 w-5", active ? "text-accent" : "text-text-muted")} />
                      </div>
                      <div>
                        <p className={cn("text-sm font-semibold", active ? "text-accent" : "text-text-primary")}>{a.label}</p>
                        <p className="text-xs text-text-muted mt-0.5">{a.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Jurisdiction */}
            {!lockJurisdiction && (
              <div>
                <label className="text-sm font-semibold text-text-primary block mb-3">Jurisdiction</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {JURISDICTIONS.map(j => {
                    const active = settings.jurisdictionCode === j.value;
                    return (
                      <button
                        key={j.value}
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, jurisdictionCode: j.value }))}
                        className={cn(
                          "flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all",
                          active
                            ? "border-accent bg-accent/5 shadow-sm"
                            : "border-border bg-bg-card hover:border-accent/40 hover:bg-bg-surface"
                        )}
                      >
                        <span className={cn("text-sm font-bold font-mono", active ? "text-accent" : "text-text-primary")}>{j.value}</span>
                        <span className={cn("text-sm font-medium", active ? "text-text-primary" : "text-text-secondary")}>{j.label}</span>
                        <span className="text-xs text-text-muted">{j.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Module count slider */}
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-text-primary">Number of Modules</label>
                <span className="text-3xl font-bold text-accent tabular-nums">{settings.moduleCount}</span>
              </div>
              <input
                type="range"
                min={3} max={8} step={1}
                value={settings.moduleCount}
                onChange={e => setSettings(s => ({ ...s, moduleCount: Number(e.target.value) }))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>Quick (3)</span>
                <span>~{settings.moduleCount * 15} min estimated</span>
                <span>Comprehensive (8)</span>
              </div>
            </div>

            {/* Template cards */}
            <div>
              <label className="text-sm font-semibold text-text-primary block mb-3">Course Template</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATES.map(t => {
                  const Icon = t.icon;
                  const active = settings.template === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTemplateChange(t.value)}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                        active
                          ? "border-accent bg-accent/5 shadow-sm"
                          : "border-border bg-bg-card hover:border-accent/40 hover:bg-bg-surface"
                      )}
                    >
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", active ? "bg-accent/10" : "bg-bg-primary")}>
                        <Icon className={cn("h-5 w-5", active ? "text-accent" : "text-text-muted")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold", active ? "text-accent" : "text-text-primary")}>{t.label}</span>
                          {t.recommended && <Badge variant="accent" className="text-[10px] px-1.5 py-0">Recommended</Badge>}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={goToTopics} className="gap-2 px-6">
                Next: Topics <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2 — Topics                                                  */}
        {/* ================================================================ */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">Course Topics</h1>
              <p className="text-sm text-text-muted mt-1">
                {suggestingTopics
                  ? "Asking AI to suggest topics based on your course details..."
                  : "Edit, reorder, or add topics. The AI will generate one module per topic."}
              </p>
            </div>

            {suggestingTopics ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <div className="h-12 w-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto" />
                  <p className="text-sm text-text-secondary font-medium">Generating topic suggestions...</p>
                </div>
              </div>
            ) : (
              <>
                {aiSuggestedIndices.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 text-sm text-accent">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>AI suggested these topics based on your course details. Edit freely.</span>
                  </div>
                )}

                <div className="space-y-2">
                  {topics.map((topic, idx) => {
                    const isAI = aiSuggestedIndices.has(idx);
                    return (
                      <div key={idx} className="flex items-center gap-2 group">
                        <GripVertical className="h-4 w-4 text-text-muted/40 shrink-0" />
                        <div className="relative flex-1">
                          <input
                            className="input w-full pr-24"
                            value={topic}
                            onChange={e => {
                              const next = [...topics];
                              next[idx] = e.target.value;
                              setTopics(next);
                              // Clear AI flag when manually edited
                              if (isAI) {
                                setAiSuggestedIndices(prev => {
                                  const s = new Set(prev); s.delete(idx); return s;
                                });
                              }
                            }}
                            placeholder={`Topic ${idx + 1}`}
                          />
                          {isAI && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                              AI
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTopics(topics.filter((_, i) => i !== idx));
                            setAiSuggestedIndices(prev => {
                              const s = new Set<number>();
                              prev.forEach(n => { if (n < idx) s.add(n); else if (n > idx) s.add(n - 1); });
                              return s;
                            });
                          }}
                          className="p-1.5 rounded text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add topic */}
                  <button
                    type="button"
                    onClick={() => setTopics([...topics, ""])}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-accent/40 hover:bg-accent/5 text-sm text-text-muted hover:text-accent transition-all mt-2"
                  >
                    <Plus className="h-4 w-4" /> Add Topic
                  </button>
                </div>

                <p className="text-xs text-text-muted text-center">
                  Drag to reorder · Edit any topic · AI will generate one module per topic
                </p>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button
                onClick={generate}
                disabled={suggestingTopics || topics.filter(t => t.trim()).length === 0}
                className="gap-2 px-6"
              >
                <Sparkles className="h-4 w-4" /> Generate Course
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3 — Generating                                              */}
        {/* ================================================================ */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-center space-y-8">
            {!genError ? (
              <>
                <div className="text-center py-8">
                  <div className="max-w-sm mx-auto">
                    <Sparkles className="h-10 w-10 text-accent mx-auto mb-6 animate-pulse" />
                    <h2 className="text-xl font-heading font-bold text-text-primary mb-1">Building your course...</h2>
                    <p className="text-sm font-semibold text-text-secondary mb-4">{genStage}</p>
                    <div className="h-2 bg-bg-primary rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted">{progress}% — usually takes 30–60 seconds</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="h-20 w-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                  <X className="h-10 w-10 text-red-500" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h2 className="text-xl font-heading font-bold text-text-primary">Generation Failed</h2>
                  <p className="text-sm text-text-muted">{genError}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>← Back to Topics</Button>
                  <Button onClick={generate} className="gap-2"><RefreshCw className="h-4 w-4" /> Try Again</Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 4 — Review & Edit                                           */}
        {/* ================================================================ */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-heading font-bold text-text-primary">Review &amp; Publish</h1>
                <p className="text-sm text-text-muted mt-1">
                  {modules.length} modules generated. Review, edit, then publish.
                </p>
              </div>
              <button
                onClick={() => { setPreviewAllMode(true); setPreviewModule(0); }}
                className="flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shrink-0"
              >
                <Presentation className="h-4 w-4" />
                Preview Course
              </button>
            </div>

            {/* Module accordion */}
            <div className="space-y-3">
              {modules.map((mod, idx) => {
                const isExpanded = expandedModule === idx;
                const quizArr = Array.isArray(mod.quiz) ? mod.quiz : [];
                const quizCount = quizArr.length;
                const slideCount = (mod.content.match(/^## /gm) || []).length;
                const isRegenerating = regeneratingQuiz.has(idx);

                return (
                  <div key={idx} className={cn("rounded-xl border-2 overflow-hidden transition-all", isExpanded ? "border-accent/30 shadow-sm" : "border-border")}>
                    {/* Header */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 hover:bg-bg-surface transition-colors text-left"
                      onClick={() => setExpandedModule(isExpanded ? null : idx)}
                    >
                      <div className="h-8 w-8 rounded-full bg-gold/10 text-gold text-sm font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-primary truncate">{mod.title || `Module ${idx + 1}`}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {slideCount > 0 && <span className="text-xs text-text-muted">{slideCount} slides</span>}
                          {quizCount > 0 && <span className="text-xs text-text-muted">{quizCount} quiz questions</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-text-muted" />
                          : <ChevronDown className="h-4 w-4 text-text-muted" />}
                      </div>
                    </button>

                    {/* Body */}
                    {isExpanded && (
                      <div className="border-t border-border bg-bg-card px-4 pb-5 space-y-4">
                        {/* Title */}
                        <div className="pt-4">
                          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Module Title</label>
                          <input
                            className="input mt-1 w-full font-medium"
                            value={mod.title}
                            onChange={e => updateModuleTitle(idx, e.target.value)}
                          />
                        </div>

                        {/* Content */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Content</label>
                            <div className="flex items-center gap-3">
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
                                  const s = new Set(prev);
                                  if (s.has(idx)) s.delete(idx); else s.add(idx);
                                  return s;
                                })}
                                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary font-medium transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                {editingContent.has(idx) ? "Collapse" : "Edit"}
                              </button>
                            </div>
                          </div>

                          {editingContent.has(idx) ? (
                            <div className="space-y-2">
                              <textarea
                                className="input w-full resize-y font-mono text-xs leading-relaxed"
                                rows={14}
                                value={mod.content}
                                onChange={e => updateModuleContent(idx, e.target.value)}
                              />
                              {showImageUpload.has(idx) ? (
                                <div className="rounded-lg border border-border p-3 bg-bg-primary space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Add Image</p>
                                    <button
                                      type="button"
                                      onClick={() => setShowImageUpload(prev => { const s = new Set(prev); s.delete(idx); return s; })}
                                      className="text-text-muted hover:text-text-primary transition-colors"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <ImageUpload
                                    onUpload={(url, description) => {
                                      updateModuleContent(idx, mod.content.trimEnd() + `\n\n![${description}](${url})\n`);
                                      setShowImageUpload(prev => { const s = new Set(prev); s.delete(idx); return s; });
                                    }}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowImageUpload(prev => new Set(prev).add(idx))}
                                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent font-medium transition-colors"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  Add Image
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="bg-bg-primary rounded-lg p-3 text-xs text-text-secondary border border-border font-mono leading-relaxed">
                              <p className="whitespace-pre-wrap break-words">
                                {showFullContent.has(idx)
                                  ? mod.content
                                  : mod.content.slice(0, 300) + (mod.content.length > 300 ? "…" : "")}
                              </p>
                              {mod.content.length > 300 && (
                                <button
                                  type="button"
                                  className="text-accent hover:text-accent/80 mt-2 font-sans font-medium transition-colors"
                                  onClick={() => setShowFullContent(prev => {
                                    const s = new Set(prev);
                                    if (s.has(idx)) s.delete(idx); else s.add(idx);
                                    return s;
                                  })}
                                >
                                  {showFullContent.has(idx) ? "Show less" : "Show full content"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quiz */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                              Quiz <Badge variant="default" className="ml-1 text-[10px]">{quizCount} questions</Badge>
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => regenerateQuiz(idx)}
                                disabled={isRegenerating}
                                className="flex items-center gap-1 text-xs text-text-muted hover:text-accent font-medium transition-colors disabled:opacity-40"
                              >
                                <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
                                {isRegenerating ? "Regenerating…" : "Regenerate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingQuiz(prev => {
                                  const s = new Set(prev);
                                  if (s.has(idx)) s.delete(idx); else s.add(idx);
                                  return s;
                                })}
                                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary font-medium transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                {editingQuiz.has(idx) ? "Collapse" : "Edit JSON"}
                              </button>
                            </div>
                          </div>

                          {editingQuiz.has(idx) && (
                            <textarea
                              className="input w-full resize-y font-mono text-xs leading-relaxed"
                              rows={10}
                              value={typeof mod.quiz === "string"
                                ? (mod.quiz as string)
                                : JSON.stringify(mod.quiz, null, 2)}
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
            <div className="rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-bg-surface transition-colors text-left"
                onClick={() => setShowBadgeSettings(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold" />
                  <span className="text-sm font-semibold text-text-primary">Badge &amp; Completion Settings</span>
                </div>
                {showBadgeSettings ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              </button>

              {showBadgeSettings && (
                <div className="border-t border-border px-4 pb-5 space-y-4">
                  <div className="pt-4">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Badge Label</label>
                    <input
                      className="input mt-1 w-full"
                      value={badgeLabel}
                      onChange={e => setBadgeLabel(e.target.value)}
                      placeholder={`${settings.title} Certified`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">Badge Color</label>
                    <div className="flex gap-3">
                      {BADGE_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setBadgeColor(c.value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-colors",
                            badgeColor === c.value ? "border-accent shadow-sm" : "border-transparent hover:border-border"
                          )}
                        >
                          <div className="h-7 w-7 rounded-full shadow-sm" style={{ backgroundColor: c.hex }} />
                          <span className="text-xs text-text-muted">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Estimated Minutes</label>
                    <input
                      className="input mt-1 w-28"
                      type="number" min={1}
                      value={estimatedMinutes}
                      onChange={e => setEstimatedMinutes(Number(e.target.value))}
                    />
                    <p className="text-xs text-text-muted mt-1">Auto-calculated from module count</p>
                  </div>
                </div>
              )}
            </div>

            {/* Spacer so sticky bar doesn't overlap last card */}
            <div className="h-4" />
          </div>
        )}
      </div>

      {/* Sticky bottom action bar — only on step 4 */}
      {step === 4 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-bg-primary/95 backdrop-blur-sm px-4 sm:px-8 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back to Settings
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                loading={saving}
                disabled={saving || modules.length === 0}
              >
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSave(true)}
                loading={saving}
                disabled={saving || modules.length === 0}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" /> Publish Course
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Slideshow preview overlay (single module) */}
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

      {/* Full course preview modal */}
      {previewAllMode && (
        <div className="fixed inset-0 z-[200] bg-bg-primary flex">
          {/* Sidebar */}
          <div className="w-64 border-r border-border p-4 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Course Preview</h3>
              <button onClick={() => setPreviewAllMode(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted mb-3 truncate">{settings.title}</p>
            {modules.map((mod, i) => (
              <button
                key={i}
                onClick={() => setPreviewModule(i)}
                className={cn(
                  "w-full text-left p-3 rounded-lg mb-1 text-sm transition-colors",
                  previewModule === i
                    ? "bg-accent/10 text-accent font-medium"
                    : "hover:bg-bg-primary text-text-secondary"
                )}
              >
                <span className="text-xs text-text-muted mr-1">M{i + 1}</span>
                {mod.title}
              </button>
            ))}
          </div>
          {/* Slideshow */}
          <div className="flex-1 min-w-0">
            {previewModule !== null && modules[previewModule] ? (
              <Slideshow
                content={modules[previewModule].content}
                title={`${settings.title} — ${modules[previewModule].title}`}
                courseTitle={settings.title}
                moduleTitle={modules[previewModule].title}
                onClose={() => setPreviewAllMode(false)}
                isModuleComplete={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">
                Select a module to preview
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
