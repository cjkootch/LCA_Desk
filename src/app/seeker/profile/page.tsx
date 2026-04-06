"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { User, Briefcase, MapPin, CheckCircle, Plus, X } from "lucide-react";
import { fetchMyProfile, updateMyProfile } from "@/server/actions";
import { toast } from "sonner";

const EMPLOYMENT_CATEGORIES = [
  "Management", "Technical", "Administrative", "Skilled Labour",
  "Semi-Skilled Labour", "Unskilled Labour",
];

const LOCATIONS = ["Georgetown", "Linden", "New Amsterdam", "Region 4", "Offshore", "Any"];
const CONTRACT_PREFS = ["Full-time", "Part-time", "Contract", "Temporary", "Any"];

export default function SeekerProfilePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [category, setCategory] = useState("");
  const [classification, setClassification] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [isGuyanese, setIsGuyanese] = useState(true);
  const [nationality, setNationality] = useState("Guyanese");
  const [location, setLocation] = useState("Any");
  const [contractPref, setContractPref] = useState("Any");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [cvUrl, setCvUrl] = useState("");

  useEffect(() => {
    fetchMyProfile()
      .then((p) => {
        if (p) {
          setProfile(p);
          setName(p.name || "");
          setJobTitle(p.currentJobTitle || "");
          setCategory(p.employmentCategory || "");
          setClassification(p.employmentClassification || "");
          setYearsExp(p.yearsExperience?.toString() || "");
          setIsGuyanese(p.isGuyanese ?? true);
          setNationality(p.nationality || "Guyanese");
          setLocation(p.locationPreference || "Any");
          setContractPref(p.contractTypePreference || "Any");
          setSkills(p.skills || []);
          setCvUrl(p.cvUrl || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        name: name || undefined,
        currentJobTitle: jobTitle || undefined,
        employmentCategory: category || undefined,
        employmentClassification: classification || undefined,
        yearsExperience: yearsExp ? parseInt(yearsExp) : undefined,
        isGuyanese,
        nationality,
        locationPreference: location,
        contractTypePreference: contractPref,
        skills,
        cvUrl: cvUrl || undefined,
      });
      toast.success("Profile updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update profile");
    }
    setSaving(false);
  };

  const completionItems = [
    { label: "Job title", done: !!jobTitle },
    { label: "Employment category", done: !!category },
    { label: "Skills", done: skills.length > 0 },
    { label: "Experience", done: !!yearsExp },
    { label: "Location preference", done: !!location && location !== "Any" },
  ];
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100);

  if (loading) {
    return (
      <>
        <SeekerTopBar title="My Profile" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <>
      <SeekerTopBar
        title="My Profile"
        action={
          !editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>Edit Profile</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} loading={saving}>Save</Button>
            </div>
          )
        }
      />

      <div className="p-4 sm:p-8 max-w-4xl space-y-6">
        {/* Profile completeness */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-primary">Profile Completeness</p>
              <span className="text-sm font-bold text-accent">{completionPct}%</span>
            </div>
            <div className="w-full bg-border-light rounded-full h-2">
              <div
                className="bg-accent rounded-full h-2 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {completionItems.map((item) => (
                <span key={item.label} className={`flex items-center gap-1 text-xs ${item.done ? "text-success" : "text-text-muted"}`}>
                  <CheckCircle className="h-3 w-3" /> {item.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Personal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-text-muted">Full Name</label>
                {editing ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{name || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">Email</label>
                <p className="text-sm font-medium text-text-primary mt-0.5">{profile?.email || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted">Nationality</label>
                {editing ? (
                  <div className="flex items-center gap-3 mt-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isGuyanese}
                        onChange={(e) => {
                          setIsGuyanese(e.target.checked);
                          if (e.target.checked) setNationality("Guyanese");
                        }}
                        className="rounded border-border accent-accent"
                      />
                      Guyanese
                    </label>
                    {!isGuyanese && (
                      <Input
                        placeholder="Nationality"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        className="flex-1"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-medium text-text-primary">{nationality || "—"}</p>
                    {isGuyanese && <Badge variant="success" className="text-[10px]">Guyanese</Badge>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Professional Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Professional Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-text-muted">Current Job Title</label>
                {editing ? (
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1" placeholder="e.g. Mechanical Engineer" />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{jobTitle || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">Employment Category</label>
                {editing ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">Select category</option>
                    {EMPLOYMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{category || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">Years of Experience</label>
                {editing ? (
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={yearsExp}
                    onChange={(e) => setYearsExp(e.target.value)}
                    className="mt-1 w-24"
                    placeholder="0"
                  />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{yearsExp ? `${yearsExp} years` : "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">CV / Resume URL</label>
                {editing ? (
                  <Input
                    value={cvUrl}
                    onChange={(e) => setCvUrl(e.target.value)}
                    className="mt-1"
                    placeholder="https://..."
                  />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">
                    {cvUrl ? <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">View CV</a> : "—"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {skills.length === 0 && !editing && (
                  <p className="text-sm text-text-muted">No skills added yet.</p>
                )}
                {skills.map((skill) => (
                  <Badge key={skill} variant="default" className="text-xs">
                    {skill}
                    {editing && (
                      <button onClick={() => removeSkill(skill)} className="ml-1 hover:text-danger">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              {editing && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={addSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-text-muted">Location Preference</label>
                {editing ? (
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    {LOCATIONS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{location}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">Preferred Contract Type</label>
                {editing ? (
                  <select
                    value={contractPref}
                    onChange={(e) => setContractPref(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    {CONTRACT_PREFS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{contractPref}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Talent Pool Opt-In */}
        <Card className="mt-6">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-accent-light">
                  <User className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Talent Pool Visibility</h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Make your profile visible to petroleum sector employers on LCA Desk.
                    Companies searching for Guyanese talent will be able to see your skills, experience, and job title.
                    Your email is only shared with Pro plan employers.
                  </p>
                </div>
              </div>
              <div
                onClick={async () => {
                  const newVal = !(profile?.profileVisible ?? false);
                  try {
                    const { toggleProfileVisibility } = await import("@/server/actions");
                    await toggleProfileVisibility(newVal);
                    setProfile((prev: typeof profile) => prev ? { ...prev, profileVisible: newVal } : prev);
                    toast.success(newVal ? "Profile now visible to employers" : "Profile hidden from talent pool");
                  } catch { toast.error("Failed to update"); }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                  profile?.profileVisible ? "bg-accent" : "bg-border"
                }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  profile?.profileVisible ? "translate-x-5" : ""
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
