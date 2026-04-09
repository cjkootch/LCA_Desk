"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserCog, Save, Lock, Plus, X, Camera, Building2 } from "lucide-react";
import { fetchMySupplierProfile, updateSupplierProfile } from "@/server/actions";
import { useRef } from "react";
import { toast } from "sonner";

export default function SupplierProfilePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [isGuyaneseOwned, setIsGuyaneseOwned] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [capabilityStatement, setCapabilityStatement] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMySupplierProfile()
      .then(p => {
        if (!p) return;
        setProfile(p);
        setLegalName(p.legalName || "");
        setTradingName(p.tradingName || "");
        setContactEmail(p.contactEmail || "");
        setContactPhone(p.contactPhone || "");
        setWebsite(p.website || "");
        setEmployeeCount(p.employeeCount ? String(p.employeeCount) : "");
        setYearEstablished(p.yearEstablished ? String(p.yearEstablished) : "");
        setIsGuyaneseOwned(p.isGuyaneseOwned ?? true);
        setCategories(p.serviceCategories || []);
        setCapabilityStatement(p.capabilityStatement || "");
        setLogoUrl(p.logoUrl || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSupplierProfile({
        legalName, tradingName, contactEmail, contactPhone, website,
        employeeCount: employeeCount ? parseInt(employeeCount) : undefined,
        yearEstablished: yearEstablished ? parseInt(yearEstablished) : undefined,
        isGuyaneseOwned, serviceCategories: categories,
        capabilityStatement: capabilityStatement || undefined,
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/submission/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setLogoUrl(data.fileKey);
      await updateSupplierProfile({ logoUrl: data.fileKey });
      toast.success("Logo uploaded");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to upload"); }
    setUploadingLogo(false);
  };

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory("");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  const isPro = profile?.tier === "pro";

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Company Profile</h1>
      <p className="text-sm text-text-secondary mb-6">Manage your supplier information visible to contractors</p>

      <div className="space-y-6">
        {/* Company logo */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Company Logo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-contain border-2 border-border bg-white" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-gold/10 flex items-center justify-center border-2 border-border">
                    <Building2 className="h-7 w-7 text-gold" />
                  </div>
                )}
                <button onClick={() => logoRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-white flex items-center justify-center shadow-sm hover:bg-accent-hover transition-colors">
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{legalName || "Your Company"}</p>
                <p className="text-xs text-text-muted">{uploadingLogo ? "Uploading..." : "Click the camera icon to upload your company logo"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted font-medium">Legal Name</label>
                <Input value={legalName} onChange={e => setLegalName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Trading Name</label>
                <Input value={tradingName} onChange={e => setTradingName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Contact Email</label>
                <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Contact Phone</label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Website</label>
                <Input value={website} onChange={e => setWebsite(e.target.value)} className="mt-1" placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Employees</label>
                <Input type="number" value={employeeCount} onChange={e => setEmployeeCount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Year Established</label>
                <Input type="number" value={yearEstablished} onChange={e => setYearEstablished(e.target.value)} className="mt-1" />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <input type="checkbox" checked={isGuyaneseOwned} onChange={e => setIsGuyaneseOwned(e.target.checked)} className="h-4 w-4 rounded border-border text-accent" />
                <span className="text-sm text-text-primary">Guyanese-owned company</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Categories */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Service Categories</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-text-muted mb-3">Add categories that match your capabilities. These are used to match you with relevant opportunities.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((cat, i) => (
                <Badge key={i} variant="accent" className="text-xs gap-1">
                  {cat}
                  <button onClick={() => setCategories(categories.filter((_, j) => j !== i))} className="hover:text-white/70"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {categories.length === 0 && <span className="text-xs text-text-muted">No categories set</span>}
            </div>
            <div className="flex gap-2">
              <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Drilling Services, Logistics, Catering"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} className="text-sm" />
              <Button variant="outline" size="sm" onClick={addCategory}><Plus className="h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>

        {/* Capability Statement (Pro) */}
        <Card className={!isPro ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Capability Statement</CardTitle>
              {!isPro && <Badge variant="default" className="text-xs gap-1"><Lock className="h-2.5 w-2.5" /> Supplier Pro</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {isPro ? (
              <>
                <p className="text-xs text-text-muted mb-2">Describe your company&apos;s capabilities, experience, and what sets you apart.</p>
                <textarea className="w-full h-32 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={capabilityStatement} onChange={e => setCapabilityStatement(e.target.value)}
                  placeholder="Our company specializes in... We have XX years of experience in... Key projects include..." />
              </>
            ) : (
              <p className="text-xs text-text-muted">Upgrade to Pro to add a capability statement visible to all contractors.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} className="gap-1.5">
            <Save className="h-4 w-4" /> Save Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
