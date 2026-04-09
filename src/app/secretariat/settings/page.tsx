"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { CancelAccount } from "@/components/settings/CancelAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Bell, Mail, Save, Building2, Camera, Globe, Phone, MapPin, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchSecretariatOfficeSettings, updateSecretariatOfficeSettings } from "@/server/actions";
import { toast } from "sonner";

/* eslint-disable @next/next/no-img-element */

export default function SecretariatSettingsPage() {
  const { profile } = useAuth();

  // Office config state
  const [officeLoading, setOfficeLoading] = useState(true);
  const [officeSaving, setOfficeSaving] = useState(false);
  const [officeName, setOfficeName] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [officeWebsite, setOfficeWebsite] = useState("");
  const [officeLogoUrl, setOfficeLogoUrl] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryTitle, setSignatoryTitle] = useState("");
  const [submissionEmail, setSubmissionEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSecretariatOfficeSettings()
      .then(o => {
        setOfficeName(o.name || "");
        setOfficePhone(o.phone || "");
        setOfficeAddress(o.address || "");
        setOfficeWebsite(o.website || "");
        setOfficeLogoUrl(o.logoUrl || "");
        setSignatoryName(o.signatoryName || "");
        setSignatoryTitle(o.signatoryTitle || "");
        setSubmissionEmail(o.submissionEmail || "localcontent@nre.gov.gy");
      })
      .catch(() => {})
      .finally(() => setOfficeLoading(false));
  }, []);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/submission/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await updateSecretariatOfficeSettings({ logoUrl: data.fileKey });
      setOfficeLogoUrl(data.fileKey);
      toast.success("Office logo updated");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to upload"); }
    setUploading(false);
  };

  const handleOfficeSave = async () => {
    setOfficeSaving(true);
    try {
      await updateSecretariatOfficeSettings({
        name: officeName,
        phone: officePhone,
        address: officeAddress,
        website: officeWebsite,
        signatoryName,
        signatoryTitle,
        submissionEmail,
      });
      toast.success("Office settings saved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    setOfficeSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">Manage your account, office configuration, and notifications</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Profile Picture & Socials */}
        <ProfileSettings />

        {/* Account */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted font-medium">Name</label>
                <p className="text-sm font-medium text-text-primary mt-1">{profile?.full_name || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Email</label>
                <p className="text-sm text-text-primary mt-1">{profile?.email || "—"}</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium">Role</label>
              <div className="mt-1">
                <Badge variant="accent">Secretariat Admin</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Office Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Office Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {officeLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Logo / Seal upload */}
                <div>
                  <label className="text-xs text-text-muted font-medium mb-2 block">Official Logo / Seal</label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {officeLogoUrl ? (
                        <img src={officeLogoUrl} alt="Office logo" className="h-20 w-20 rounded-xl object-contain border-2 border-border bg-bg-primary p-1" />
                      ) : (
                        <div className="h-20 w-20 rounded-xl bg-bg-primary flex items-center justify-center border-2 border-dashed border-border">
                          <Building2 className="h-8 w-8 text-text-muted" />
                        </div>
                      )}
                      <button
                        onClick={() => logoRef.current?.click()}
                        disabled={uploading}
                        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-white flex items-center justify-center shadow-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                      <input ref={logoRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{officeName || "Office Logo"}</p>
                      <p className="text-xs text-text-muted">Upload your office seal or logo. Appears on official correspondence.</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border-light" />

                {/* Office details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Office Name
                    </label>
                    <Input value={officeName} onChange={e => setOfficeName(e.target.value)} className="mt-1" placeholder="Local Content Secretariat" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Submission Email
                    </label>
                    <Input value={submissionEmail} onChange={e => setSubmissionEmail(e.target.value)} className="mt-1" placeholder="localcontent@nre.gov.gy" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone Number
                    </label>
                    <Input value={officePhone} onChange={e => setOfficePhone(e.target.value)} className="mt-1" placeholder="+592 xxx xxxx" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Website
                    </label>
                    <Input value={officeWebsite} onChange={e => setOfficeWebsite(e.target.value)} className="mt-1" placeholder="https://nre.gov.gy" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Office Address
                  </label>
                  <Input value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} className="mt-1" placeholder="96 Duke St, Kingston, Georgetown" />
                </div>

                <div className="border-t border-border-light" />

                {/* Signatory */}
                <div>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">Official Signatory</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> Signatory Name
                      </label>
                      <Input value={signatoryName} onChange={e => setSignatoryName(e.target.value)} className="mt-1" placeholder="Full name" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Title / Position</label>
                      <Input value={signatoryTitle} onChange={e => setSignatoryTitle(e.target.value)} className="mt-1" placeholder="Director, Local Content Secretariat" />
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-2">Used on acknowledgment letters and official communications.</p>
                </div>

                <div className="flex justify-end pt-1">
                  <Button onClick={handleOfficeSave} loading={officeSaving} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Office Settings
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Notification Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "New submission received", desc: "When a company submits a report through LCA Desk", default: true },
              { label: "Amendment response received", desc: "When a company responds to an amendment request", default: true },
              { label: "LCS application submitted", desc: "When a new LCS certificate application is filed", default: true },
              { label: "Filing deadline approaching", desc: "Reminder when filing deadlines are approaching for the sector", default: false },
              { label: "Weekly sector digest", desc: "Summary of submissions, compliance metrics, and market activity", default: true },
            ].map(n => (
              <div key={n.label} className="flex items-start justify-between py-2 border-b border-border-light last:border-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">{n.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{n.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input type="checkbox" defaultChecked={n.default} className="sr-only peer" />
                  <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        <CancelAccount hasPaidPlan={false} userType="secretariat" />
      </div>
    </div>
  );
}
