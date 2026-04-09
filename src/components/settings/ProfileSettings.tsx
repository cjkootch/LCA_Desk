"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Camera, Globe, Save, Link2, Phone, ZoomIn, ZoomOut } from "lucide-react";
import { fetchUserSettings, updateUserSettings } from "@/server/actions";
import { toast } from "sonner";

// ─── Crop helper ────────────────────────────────────────────────
function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.min(crop.width, crop.height);
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(image, crop.x, crop.y, size, size, 0, 0, 512, 512);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas to blob failed"))),
        "image/jpeg",
        0.92
      );
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

export function ProfileSettings() {
  const { data: session, update: updateSession } = useSession();
  const userId = session?.user?.id;
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

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  useEffect(() => {
    if (!userId) return;
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
  }, [userId]);

  const onFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setCropFile(file);
    setCropSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  const handleCropSave = async () => {
    if (!cropSrc || !croppedArea) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(cropSrc, croppedArea);
      const formData = new FormData();
      formData.append("file", new File([croppedBlob], cropFile?.name || "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/submission/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await updateUserSettings({ avatarUrl: data.fileKey });
      setAvatarUrl(data.fileKey);
      toast.success("Profile picture updated");
      setCropSrc(null);
      setCropFile(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to upload image"); }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserSettings({ name, phone, linkedinUrl, twitterUrl, websiteUrl });
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
                <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border"
                  onError={() => setAvatarUrl("")} />
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
                onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ""; }} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{name || "Your Name"}</p>
              <p className="text-xs text-text-muted">Click the camera icon to change your photo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Crop dialog */}
      <Dialog open={!!cropSrc} onOpenChange={open => { if (!open) { setCropSrc(null); setCropFile(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Your Photo</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-72 bg-black rounded-lg overflow-hidden mt-2">
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <ZoomOut className="h-4 w-4 text-text-muted shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-accent h-1.5"
            />
            <ZoomIn className="h-4 w-4 text-text-muted shrink-0" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setCropSrc(null); setCropFile(null); }}>Cancel</Button>
            <Button onClick={handleCropSave} loading={uploading}>
              <Save className="h-4 w-4 mr-1" /> Save Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
