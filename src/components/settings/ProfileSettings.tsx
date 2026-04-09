"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Camera, Globe, Save, Link2, Phone } from "lucide-react";
import { fetchUserSettings, updateUserSettings } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProfileSettings() {
  const { update: updateSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserSettings().then(u => {
      if (u) {
        setName(u.name || "");
        setPhone(u.phone || "");
        setAvatarUrl(u.avatarUrl || "");
        setLinkedinUrl(u.linkedinUrl || "");
        setTwitterUrl(u.twitterUrl || "");
        setWebsiteUrl(u.websiteUrl || "");
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/submission/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // fileKey is now a direct Vercel Blob URL
      setAvatarUrl(data.fileKey);
      await updateUserSettings({ avatarUrl: data.fileKey });
      toast.success("Profile picture updated");
    } catch { toast.error("Failed to upload image"); }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserSettings({ name, phone, linkedinUrl, twitterUrl, websiteUrl });
      // Update the session so sidebar reflects new name immediately
      await updateSession({ name });
      toast.success("Profile updated");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" /></div>;

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Profile Picture</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-accent-light flex items-center justify-center border-2 border-border">
                  <User className="h-7 w-7 text-accent" />
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-white flex items-center justify-center shadow-sm hover:bg-accent-hover transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{name || "Your Name"}</p>
              <p className="text-xs text-text-muted">{uploading ? "Uploading..." : "Click the camera icon to change your photo"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Name & Socials */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Profile Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-text-muted font-medium">Full Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> Phone Number</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" placeholder="+592 xxx xxxx" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-medium flex items-center gap-1"><Link2 className="h-3 w-3" /> LinkedIn</label>
            <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="mt-1" placeholder="https://linkedin.com/in/yourname" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-medium flex items-center gap-1"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X (Twitter)</label>
            <Input value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)} className="mt-1" placeholder="https://x.com/yourhandle" />
          </div>
          <div>
            <label className="text-xs text-text-muted font-medium flex items-center gap-1"><Globe className="h-3 w-3" /> Website</label>
            <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className="mt-1" placeholder="https://yourwebsite.com" />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
