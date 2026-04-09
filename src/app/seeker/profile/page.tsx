"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { User, Briefcase, MapPin, CheckCircle, Plus, X, Trophy } from "lucide-react";
import { fetchMyProfile, updateMyProfile, fetchUserBadges } from "@/server/actions";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [badges, setBadges] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [category, setCategory] = useState("");
  const [classification, setClassification] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [isGuyanese, setIsGuyanese] = useState(true);
  const [guyaneseStatus, setGuyaneseStatus] = useState("");
  const [nationality, setNationality] = useState("Guyanese");
  const [nationalIdNumber, setNationalIdNumber] = useState("");
  const [iscoCode, setIscoCode] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [educationField, setEducationField] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCert, setNewCert] = useState("");
  const [workPermitStatus, setWorkPermitStatus] = useState("");
  const [lcaAttested, setLcaAttested] = useState(false);
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
          setGuyaneseStatus(p.guyaneseStatus || "");
          setNationality(p.nationality || "Guyanese");
          setNationalIdNumber(p.nationalIdNumber || "");
          setIscoCode(p.iscoCode || "");
          setEducationLevel(p.educationLevel || "");
          setEducationField(p.educationField || "");
          setCertifications(p.certifications || []);
          setWorkPermitStatus(p.workPermitStatus || "");
          setLcaAttested(!!p.lcaAttestationDate);
          setLocation(p.locationPreference || "Any");
          setContractPref(p.contractTypePreference || "Any");
          setSkills(p.skills || []);
          setCvUrl(p.cvUrl || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchUserBadges().then(setBadges).catch(() => {});
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
        guyaneseStatus: guyaneseStatus || undefined,
        nationality,
        nationalIdNumber: nationalIdNumber || undefined,
        iscoCode: iscoCode || undefined,
        educationLevel: educationLevel || undefined,
        educationField: educationField || undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
        workPermitStatus: workPermitStatus || undefined,
        lcaAttestation: lcaAttested ? true : undefined,
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
    { label: "Guyanese status", done: !!guyaneseStatus },
    { label: "Education", done: !!educationLevel },
    { label: "LCA attestation", done: lcaAttested },
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
                    {isGuyanese && <Badge variant="success" className="text-xs">Guyanese</Badge>}
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

          {/* Earned Badges */}
          {badges.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-gold" />
                  <CardTitle className="text-sm">Earned Badges</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {badges.map((b: { courseId: string; badgeLabel: string; badgeColor: string; earnedAt: string }) => (
                    <div key={b.courseId} className="flex items-center gap-1.5 rounded-lg bg-bg-primary px-3 py-2">
                      <Trophy className={`h-4 w-4 ${b.badgeColor === "gold" ? "text-gold" : b.badgeColor === "success" ? "text-success" : "text-accent"}`} />
                      <div>
                        <p className="text-xs font-medium text-text-primary">{b.badgeLabel}</p>
                        <p className="text-xs text-text-muted">Earned {new Date(b.earnedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">Badges are visible to employers browsing the Talent Pool.</p>
              </CardContent>
            </Card>
          )}

          {/* LCA Compliance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">LCA Compliance Info</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-text-muted">Guyanese Status</label>
                {editing ? (
                  <select
                    value={guyaneseStatus}
                    onChange={(e) => {
                      setGuyaneseStatus(e.target.value);
                      setIsGuyanese(e.target.value === "citizen" || e.target.value === "permanent_resident");
                    }}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">Select status</option>
                    <option value="citizen">Guyanese Citizen</option>
                    <option value="permanent_resident">Permanent Resident of Guyana</option>
                    <option value="work_permit">Work Permit Holder</option>
                    <option value="non_resident">Non-Resident</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">
                    {guyaneseStatus === "citizen" ? "Guyanese Citizen" :
                     guyaneseStatus === "permanent_resident" ? "Permanent Resident" :
                     guyaneseStatus === "work_permit" ? "Work Permit Holder" :
                     guyaneseStatus === "non_resident" ? "Non-Resident" : "—"}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">National ID Number (optional)</label>
                {editing ? (
                  <Input value={nationalIdNumber} onChange={(e) => setNationalIdNumber(e.target.value)} className="mt-1" placeholder="For employer verification" />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{nationalIdNumber ? "••••" + nationalIdNumber.slice(-4) : "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">ISCO-08 Classification Code</label>
                {editing ? (
                  <Input value={iscoCode} onChange={(e) => setIscoCode(e.target.value)} className="mt-1" placeholder="e.g. 2145 (Chemical Engineer)" />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{iscoCode || "—"}</p>
                )}
              </div>
              {!isGuyanese && (
                <div>
                  <label className="text-xs text-text-muted">Work Permit Status</label>
                  {editing ? (
                    <select
                      value={workPermitStatus}
                      onChange={(e) => setWorkPermitStatus(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="">Select status</option>
                      <option value="valid">Valid Work Permit</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
                      <option value="not_required">Not Required</option>
                    </select>
                  ) : (
                    <p className="text-sm font-medium text-text-primary mt-0.5">{workPermitStatus || "—"}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education & Certifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Education & Certifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-text-muted">Education Level</label>
                {editing ? (
                  <select
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">Select level</option>
                    <option value="secondary">Secondary / High School</option>
                    <option value="trade_cert">Trade Certificate / Vocational</option>
                    <option value="diploma">Diploma / Associate</option>
                    <option value="bachelors">Bachelor&apos;s Degree</option>
                    <option value="masters">Master&apos;s Degree</option>
                    <option value="doctorate">Doctorate / PhD</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">
                    {educationLevel ? educationLevel.charAt(0).toUpperCase() + educationLevel.slice(1).replace(/_/g, " ") : "—"}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">Field of Study</label>
                {editing ? (
                  <Input value={educationField} onChange={(e) => setEducationField(e.target.value)} className="mt-1" placeholder="e.g. Mechanical Engineering" />
                ) : (
                  <p className="text-sm font-medium text-text-primary mt-0.5">{educationField || "—"}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-text-muted">Professional Certifications</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {certifications.length === 0 && !editing && <p className="text-sm text-text-muted">None added</p>}
                  {certifications.map((cert) => (
                    <Badge key={cert} variant="accent" className="text-xs">
                      {cert}
                      {editing && (
                        <button onClick={() => setCertifications(certifications.filter(c => c !== cert))} className="ml-1 hover:text-danger">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
                {editing && (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="e.g. NEBOSH, BOSIET, HUET" value={newCert}
                      onChange={(e) => setNewCert(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = newCert.trim(); if (t && !certifications.includes(t)) { setCertifications([...certifications, t]); setNewCert(""); } } }}
                      className="flex-1" />
                    <Button size="sm" variant="outline" onClick={() => { const t = newCert.trim(); if (t && !certifications.includes(t)) { setCertifications([...certifications, t]); setNewCert(""); } }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
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

        {/* LCA Attestation */}
        {!lcaAttested && guyaneseStatus && (
          <Card className="mt-6 border-accent/20 bg-accent-light">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">Verify Your LCA Status</h3>
                  <p className="text-xs text-text-secondary mt-1 mb-3">
                    By attesting, you confirm that the nationality and residency information you&apos;ve
                    provided is accurate. This helps employers verify Guyanese First Consideration
                    compliance under Section 12 of the Local Content Act 2021.
                  </p>
                  <div className="bg-white rounded-lg p-3 border border-border mb-3">
                    <p className="text-xs text-text-secondary italic">
                      &ldquo;I certify that the information provided regarding my nationality, residency status,
                      and qualifications is true and accurate. I understand this information may be used
                      for Local Content Act compliance reporting.&rdquo;
                    </p>
                  </div>
                  <Button size="sm" onClick={async () => {
                    try {
                      await updateMyProfile({ lcaAttestation: true });
                      setLcaAttested(true);
                      toast.success("LCA status attested successfully");
                    } catch { toast.error("Failed to attest"); }
                  }}>
                    <CheckCircle className="h-4 w-4 mr-1" /> I Attest This Is Accurate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {lcaAttested && (
          <Card className="mt-6 border-success/20">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-text-primary">LCA Status Verified</p>
                <p className="text-xs text-text-muted">You have attested to the accuracy of your nationality and residency information.</p>
              </div>
              <Badge variant="success" className="ml-auto">Attested</Badge>
            </CardContent>
          </Card>
        )}

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
