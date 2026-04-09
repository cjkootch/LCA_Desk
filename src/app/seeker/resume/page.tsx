"use client";

import { useEffect, useState } from "react";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Sparkles, Download, Upload, Wand2, RefreshCw,
  CheckCircle, User, Briefcase, GraduationCap, Plus, X,
} from "lucide-react";
import { fetchMyProfile, updateMyProfile } from "@/server/actions";
import { toast } from "sonner";

export default function ResumeBuilderPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resumeText, setResumeText] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [resumeStyle, setResumeStyle] = useState<"modern" | "traditional" | "compact">("modern");
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  // Profile fields for generation
  const [education, setEducation] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    fetchMyProfile().then(p => {
      if (p) {
        setProfile(p);
        setSkills(p.skills || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleEnhance = async () => {
    if (!resumeText.trim()) { toast.error("Paste your resume text first"); return; }
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enhance",
          content: resumeText,
          profile: {
            jobTitle: profile?.currentJobTitle,
            category: profile?.employmentCategory,
            yearsExperience: profile?.yearsExperience,
            isGuyanese: profile?.isGuyanese,
          },
        }),
      });
      const data = await res.json();
      if (data.enhanced) {
        setResumeText(data.enhanced);
        setActiveTab("preview");
        toast.success("Resume enhanced with AI");
      } else { toast.error("Enhancement failed"); }
    } catch { toast.error("Failed to enhance resume"); }
    setEnhancing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          profile: {
            name: profile?.name,
            jobTitle: profile?.currentJobTitle,
            category: profile?.employmentCategory,
            yearsExperience: profile?.yearsExperience,
            skills,
            location: profile?.locationPreference,
            isGuyanese: profile?.isGuyanese,
            nationality: profile?.nationality,
            education,
          },
        }),
      });
      const data = await res.json();
      if (data.generated) {
        setResumeText(data.generated);
        setActiveTab("preview");
        toast.success("Resume generated! Edit the content to add your specific experience.");
      } else { toast.error("Generation failed"); }
    } catch { toast.error("Failed to generate resume"); }
    setGenerating(false);
  };

  const handleExtractSkills = async () => {
    if (!resumeText.trim()) { toast.error("Add resume content first"); return; }
    setExtracting(true);
    try {
      const res = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract_skills", content: resumeText }),
      });
      const data = await res.json();
      if (data.extracted) {
        const e = data.extracted;
        // Update profile with extracted data
        await updateMyProfile({
          currentJobTitle: e.current_job_title || undefined,
          employmentCategory: e.employment_category || undefined,
          yearsExperience: e.years_experience || undefined,
          skills: e.skills || undefined,
          name: undefined, // don't overwrite name
        });
        setSkills(e.skills || []);
        setProfile((prev: typeof profile) => prev ? {
          ...prev,
          currentJobTitle: e.current_job_title || prev.currentJobTitle,
          employmentCategory: e.employment_category || prev.employmentCategory,
          yearsExperience: e.years_experience || prev.yearsExperience,
          skills: e.skills || prev.skills,
        } : prev);
        toast.success(`Extracted ${e.skills?.length || 0} skills and updated your profile`);
      }
    } catch { toast.error("Failed to extract skills"); }
    setExtracting(false);
  };

  const handleExportPdf = async () => {
    if (!resumeText.trim()) { toast.error("No resume content to export"); return; }
    setExporting(true);
    try {
      const res = await fetch("/api/export/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile?.name || "Resume",
          headline: profile?.currentJobTitle || "",
          content: resumeText,
          skills,
          style: resumeStyle,
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(profile?.name || "Resume").replace(/\s+/g, "_")}_Resume.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Resume PDF downloaded");
    } catch { toast.error("Failed to export PDF"); }
    setExporting(false);
  };

  const handleSaveToProfile = async () => {
    if (!resumeText.trim()) { toast.error("No resume content to save"); return; }
    try {
      await updateMyProfile({
        resumeContent: resumeText,
        skills: skills.length > 0 ? skills : undefined,
        profileVisible: true,
      });
      toast.success("Resume saved to profile and Talent Pool enabled!");
    } catch { toast.error("Failed to save to profile"); }
  };

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill("");
    }
  };

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Resume Builder" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <>
      <SeekerTopBar
        title="Resume Builder"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf} loading={exporting} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export PDF
            </Button>
            <Button size="sm" onClick={handleSaveToProfile} className="gap-1.5">
              <User className="h-3.5 w-3.5" /> Save to Talent Pool
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-5xl space-y-6">
        {/* Quick profile info */}
        <Card>
          <CardContent className="p-4">
            <div className="grid sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-text-muted">Full Name</label>
                <p className="text-sm font-medium text-text-primary">{profile?.name || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted">Job Title</label>
                <p className="text-sm font-medium text-text-primary">{profile?.currentJobTitle || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted">Category</label>
                <p className="text-sm font-medium text-text-primary">{profile?.employmentCategory || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted">Education</label>
                <Input value={education} onChange={e => setEducation(e.target.value)} placeholder="e.g. BSc Mechanical Engineering" className="mt-0.5" />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-text-muted">Skills</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {skills.map(s => (
                  <Badge key={s} variant="default" className="text-xs gap-1">
                    {s}
                    <button onClick={() => setSkills(skills.filter(x => x !== s))}><X className="h-2.5 w-2.5" /></button>
                  </Badge>
                ))}
                <div className="flex gap-1">
                  <Input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    placeholder="Add skill" className="h-6 w-28 text-xs" />
                  <Button size="sm" variant="ghost" onClick={addSkill} className="h-6 px-1"><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerate} loading={generating} variant="outline" className="gap-1.5">
            <Wand2 className="h-4 w-4" /> Generate from Profile
          </Button>
          <Button onClick={handleEnhance} loading={enhancing} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> AI Enhance
          </Button>
          <Button onClick={handleExtractSkills} loading={extracting} variant="outline" className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Extract Skills to Profile
          </Button>
        </div>

        {/* Resume style selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium">Style:</span>
          {([
            { id: "modern" as const, label: "Modern", desc: "Clean layout, accent colors" },
            { id: "traditional" as const, label: "Traditional", desc: "Classic format, serif-ready" },
            { id: "compact" as const, label: "Compact", desc: "Dense, single page" },
          ]).map(s => (
            <button key={s.id} onClick={() => setResumeStyle(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                resumeStyle === s.id
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border text-text-muted hover:border-accent/30"
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Editor / Preview tabs */}
        <div className="flex gap-1 bg-bg-primary rounded-lg p-1 w-fit">
          <button onClick={() => setActiveTab("write")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "write" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary"}`}>
            Write
          </button>
          <button onClick={() => setActiveTab("preview")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "preview" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary"}`}>
            Preview
          </button>
        </div>

        {activeTab === "write" ? (
          <Card>
            <CardContent className="p-0">
              <textarea
                className="w-full min-h-[500px] p-6 text-sm text-text-primary font-mono bg-transparent border-0 focus:outline-none resize-none"
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                placeholder={`Paste your existing resume here, or click "Generate from Profile" to create one from your profile data.

You can also write in markdown:

## Professional Summary
Experienced mechanical engineer with 5 years in offshore oil and gas...

## Experience
### Senior Engineer — ExxonMobil Guyana
- Led maintenance operations on Liza Unity FPSO
- Managed team of 12 technicians

## Education
BSc Mechanical Engineering — University of Guyana

## Skills
- Offshore operations
- FPSO maintenance
- Health & Safety (NEBOSH certified)`}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              {resumeText ? (
                <div className="prose prose-sm max-w-none">
                  {resumeText.split("\n").map((line, i) => {
                    const t = line.trim();
                    if (t.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-accent mt-4 mb-2 border-b border-border-light pb-1">{t.slice(3)}</h2>;
                    if (t.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-text-primary mt-3 mb-1">{t.slice(4)}</h3>;
                    if (t.startsWith("- ") || t.startsWith("* ")) return <li key={i} className="text-sm text-text-secondary ml-4">{t.slice(2)}</li>;
                    if (t.startsWith("**") && t.endsWith("**")) return <p key={i} className="text-sm font-bold text-text-primary">{t.replace(/\*\*/g, "")}</p>;
                    if (t.length === 0) return <div key={i} className="h-2" />;
                    return <p key={i} className="text-sm text-text-secondary">{t.replace(/\*\*/g, "").replace(/\*/g, "")}</p>;
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-12">No resume content yet. Write or generate one to preview.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="border-accent/20 bg-accent-light">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-primary">Tips for petroleum sector resumes</p>
                <ul className="text-xs text-text-secondary mt-1 space-y-0.5">
                  <li>• Highlight Guyanese national status — it&apos;s a compliance advantage under the LCA</li>
                  <li>• Include ISCO-08 job classification if known (required for LCA employment reporting)</li>
                  <li>• Mention any LCS registration or certifications</li>
                  <li>• Use industry keywords: FPSO, subsea, drilling, completion, HSE, NEBOSH</li>
                  <li>• Click &quot;Extract Skills to Profile&quot; to auto-populate your talent pool profile</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
