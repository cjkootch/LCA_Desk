"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, Save, X, ImageIcon } from "lucide-react";
import { fetchAdminCourses, fetchCourseModulesByAdmin, addModule, updateModule, deleteModule } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { SecretariatShell } from "@/app/secretariat/SecretariatShell";
import { ImageUpload } from "@/components/training/ImageUpload";
import { DesktopOnlyGate } from "@/components/shared/DesktopOnlyGate";

type Module = {
  id: string;
  courseId: string;
  orderIndex: number;
  title: string;
  content: string | null;
  quizQuestions: string | null;
  passingScore: number | null;
};

function ModuleEditor({
  mod,
  onSave,
  onCancel,
}: {
  mod: Partial<Module> & { title: string };
  onSave: (data: { title: string; content: string; passingScore: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(mod.title);
  const [content, setContent] = useState(mod.content ?? "");
  const [passingScore, setPassingScore] = useState(mod.passingScore ?? 80);
  const [saving, setSaving] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try { await onSave({ title, content, passingScore }); }
    finally { setSaving(false); }
  }

  return (
    <Card className="border-accent/30">
      <CardContent className="p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-text-muted">Module Title</label>
          <input className="input mt-1 w-full" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">Content (Markdown)</label>
          <textarea className="input mt-1 w-full font-mono text-xs resize-y" rows={10} value={content} onChange={e => setContent(e.target.value)} placeholder="## Section..." />
          {showImageUpload ? (
            <div className="mt-2 rounded-lg border border-border p-3 bg-bg-primary space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Add Image</p>
                <button type="button" onClick={() => setShowImageUpload(false)} className="text-text-muted hover:text-text-primary transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ImageUpload
                onUpload={(url, description) => {
                  setContent(prev => prev.trimEnd() + `\n\n![${description}](${url})\n`);
                  setShowImageUpload(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowImageUpload(true)}
              className="mt-2 flex items-center gap-1.5 text-xs text-text-muted hover:text-accent font-medium transition-colors"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Add Image
            </button>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">Passing Score (%)</label>
          <input className="input mt-1 w-24" type="number" min={0} max={100} value={passingScore} onChange={e => setPassingScore(Number(e.target.value))} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} loading={saving} className="gap-1"><Save className="h-3.5 w-3.5" />Save</Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="gap-1"><X className="h-3.5 w-3.5" />Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SecretariatCourseModulesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    try {
      const all = await fetchAdminCourses();
      const course = all.find(c => c.id === courseId);
      if (!course) {
        // Course not found in accessible list — either doesn't exist or is an affiliate course
        toast.error("Course not accessible");
        router.replace("/secretariat/courses");
        return;
      }
      setCourseTitle(course.title);
      const mods = await fetchCourseModulesByAdmin(courseId);
      setModules(mods as unknown as Module[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      router.replace("/secretariat/courses");
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(data: { title: string; content: string; passingScore: number }) {
    try {
      const mod = await addModule(courseId, data);
      setModules(prev => [...prev, mod as unknown as Module]);
      setShowNew(false);
      toast.success("Module added");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleUpdate(moduleId: string, data: { title: string; content: string; passingScore: number }) {
    try {
      const updated = await updateModule(moduleId, data);
      setModules(prev => prev.map(m => m.id === moduleId ? { ...m, ...(updated as unknown as Partial<Module>) } : m));
      setEditingId(null);
      toast.success("Saved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete(moduleId: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteModule(moduleId);
      setModules(prev => prev.filter(m => m.id !== moduleId));
      toast.success("Deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <DesktopOnlyGate>
    <SecretariatShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/secretariat/courses">
              <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
            </Link>
            <div>
              <h1 className="text-xl font-heading font-bold text-text-primary">{courseTitle || "Course Modules"}</h1>
              <p className="text-xs text-text-muted">{modules.length} module{modules.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-2" disabled={showNew}>
            <Plus className="h-4 w-4" /> Add Module
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            {modules.length === 0 && !showNew && (
              <Card>
                <CardContent className="py-12 text-center text-text-muted">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No modules yet.</p>
                </CardContent>
              </Card>
            )}
            {modules.map(mod => (
              <div key={mod.id}>
                {editingId === mod.id ? (
                  <ModuleEditor mod={mod} onSave={data => handleUpdate(mod.id, data)} onCancel={() => setEditingId(null)} />
                ) : (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
                          {mod.orderIndex}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary">{mod.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{mod.content ? `${mod.content.length} chars` : "No content"} · Pass: {mod.passingScore ?? 80}%</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setEditingId(mod.id)} className="p-1.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(mod.id, mod.title)} className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
            {showNew && (
              <ModuleEditor mod={{ title: "" }} onSave={handleAdd} onCancel={() => setShowNew(false)} />
            )}
          </div>
        )}
      </div>
    </SecretariatShell>
    </DesktopOnlyGate>
  );
}
