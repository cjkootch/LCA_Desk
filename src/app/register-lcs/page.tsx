"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import {
  Shield, CheckCircle, ArrowRight, ArrowLeft, Building2, User,
  FileText, Upload, CreditCard, Sparkles, Clock, Users,
} from "lucide-react";
import {
  createCertApplication, updateCertApplication,
} from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    id: "self_service" as const, name: "Self-Service", price: 49, icon: FileText,
    description: "Guided wizard with document checklist",
    features: ["Step-by-step application guide", "Document checklist", "Auto-filled forms", "Submit-ready package"],
  },
  {
    id: "managed" as const, name: "Managed", price: 99, icon: Users, popular: true,
    description: "We review your documents before submission",
    features: ["Everything in Self-Service", "Document review & error checking", "Resubmission handling", "Email support"],
  },
  {
    id: "concierge" as const, name: "Concierge", price: 199, icon: Sparkles,
    description: "White-glove service with dedicated support",
    features: ["Everything in Managed", "Dedicated support agent", "Expedited processing", "Renewal management for 1 year"],
  },
];

const DOCUMENT_CHECKLIST_INDIVIDUAL = [
  { key: "national_id", label: "National ID or Passport", required: true },
  { key: "tin_certificate", label: "TIN Certificate", required: true },
  { key: "proof_of_address", label: "Proof of Address", required: true },
  { key: "cv_resume", label: "CV / Resume", required: false },
  { key: "certifications", label: "Professional Certifications", required: false },
];

const DOCUMENT_CHECKLIST_BUSINESS = [
  { key: "business_registration", label: "Business Registration Certificate", required: true },
  { key: "tin_certificate", label: "TIN Certificate", required: true },
  { key: "national_id", label: "Director/Owner National ID", required: true },
  { key: "proof_of_address", label: "Business Proof of Address", required: true },
  { key: "nib_certificate", label: "NIB Certificate of Good Standing", required: false },
  { key: "gra_clearance", label: "GRA Tax Clearance", required: false },
  { key: "portfolio", label: "Company Profile / Portfolio", required: false },
];

const SERVICE_CATEGORIES = [
  "Drilling & Well Services", "Marine & Logistics", "Engineering & Construction",
  "Environmental Services", "IT & Technology", "Catering & Hospitality",
  "Transportation", "Security Services", "Training & Development",
  "Equipment Supply", "Fabrication & Welding", "Waste Management",
  "Consulting", "Legal Services", "Accounting & Finance",
  "Medical & Health", "Agriculture & Food Supply", "Telecommunications",
];

const STEPS = ["Type & Tier", "Your Information", "Documents", "Review & Pay"];

export default function RegisterLcsPage() {
  const [step, setStep] = useState(0);
  const [appId, setAppId] = useState<string | null>(null);
  const [appType, setAppType] = useState<"individual" | "business" | null>(null);
  const [tier, setTier] = useState<"self_service" | "managed" | "concierge">("managed");
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [tin, setTin] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [bizRegNum, setBizRegNum] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizWebsite, setBizWebsite] = useState("");
  const [yearEstablished, setYearEstablished] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [isGuyaneseOwned, setIsGuyaneseOwned] = useState(true);
  const [ownershipPct, setOwnershipPct] = useState("100");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [serviceDescription, setServiceDescription] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { name: string; key: string }>>({});

  const handleStartApplication = async () => {
    if (!appType) { toast.error("Select individual or business"); return; }
    setSubmitting(true);
    try {
      const app = await createCertApplication({ applicationType: appType, tier });
      setAppId(app.id);
      setStep(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start application. Please sign in first.");
    }
    setSubmitting(false);
  };

  const handleSaveStep1 = async () => {
    if (!appId) return;
    setSubmitting(true);
    try {
      await updateCertApplication(appId, {
        applicantName: name, applicantEmail: email, applicantPhone: phone,
        nationalIdNumber: nationalId, tinNumber: tin, completedStep: 1,
        ...(appType === "business" ? {
          legalName, tradingName, businessRegistrationNumber: bizRegNum,
          businessAddress: bizAddress, businessEmail: bizEmail, businessPhone: bizPhone,
          businessWebsite: bizWebsite, yearEstablished: yearEstablished ? parseInt(yearEstablished) : null,
          employeeCount: employeeCount ? parseInt(employeeCount) : null,
          isGuyaneseOwned, ownershipPercentage: ownershipPct ? parseInt(ownershipPct) : null,
          serviceCategories: selectedCategories, serviceDescription,
        } : {}),
      });
      setStep(2);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    setSubmitting(false);
  };

  const handleFileUpload = async (docKey: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/submission/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedDocs(prev => ({ ...prev, [docKey]: { name: data.fileName, key: data.fileKey } }));
      toast.success(`${file.name} uploaded`);
    } catch { toast.error("Upload failed"); }
  };

  const handleSaveDocuments = async () => {
    if (!appId) return;
    setSubmitting(true);
    try {
      await updateCertApplication(appId, {
        documents: JSON.stringify(uploadedDocs),
        documentsComplete: Object.keys(uploadedDocs).length > 0,
        completedStep: 2,
      });
      setStep(3);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    setSubmitting(false);
  };

  const handlePayAndSubmit = async () => {
    if (!appId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/cert-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: appId, tier }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Checkout failed");
      }
    } catch { toast.error("Checkout failed"); }
    setSubmitting(false);
  };

  const selectedTier = TIERS.find(t => t.id === tier)!;
  const docChecklist = appType === "business" ? DOCUMENT_CHECKLIST_BUSINESS : DOCUMENT_CHECKLIST_INDIVIDUAL;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdf4] to-white">
      {/* Header */}
      <div className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><Image src="/logo-full.svg" alt="LCA Desk" width={120} height={35} /></Link>
          <Link href="/auth/login"><Button variant="outline" size="sm">Sign In</Button></Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        {step === 0 && !appType && (
          <div className="text-center mb-10">
            <div className="inline-flex p-4 rounded-full bg-accent/10 mb-4">
              <Shield className="h-10 w-10 text-accent" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary mb-3">
              Get Your LCS Certificate
            </h1>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              Register with the Local Content Secretariat in minutes — not weeks.
              We guide you through every step.
            </p>
          </div>
        )}

        {/* Progress bar */}
        {(appType || step > 0) && (
          <div className="flex items-center gap-1 mb-8 max-w-lg mx-auto">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center">
                <div className={cn("h-2 w-full rounded-full", i <= step ? "bg-accent" : "bg-border")} />
                <span className={cn("text-xs mt-1", i <= step ? "text-accent font-medium" : "text-text-muted")}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Choose type & tier */}
        {step === 0 && (
          <div className="space-y-8">
            {/* Application type */}
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4 text-center">Who is applying?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <button onClick={() => setAppType("individual")}
                  className={cn("text-left rounded-xl border-2 p-5 transition-all",
                    appType === "individual" ? "border-accent bg-accent-light ring-1 ring-accent/20" : "border-border hover:border-accent/40"
                  )}>
                  <User className="h-6 w-6 text-accent mb-2" />
                  <p className="font-semibold text-text-primary">Individual</p>
                  <p className="text-xs text-text-secondary mt-1">Guyanese worker seeking LCS registration for employment</p>
                </button>
                <button onClick={() => setAppType("business")}
                  className={cn("text-left rounded-xl border-2 p-5 transition-all",
                    appType === "business" ? "border-accent bg-accent-light ring-1 ring-accent/20" : "border-border hover:border-accent/40"
                  )}>
                  <Building2 className="h-6 w-6 text-accent mb-2" />
                  <p className="font-semibold text-text-primary">Business</p>
                  <p className="text-xs text-text-secondary mt-1">Guyanese company registering as an LCS-certified supplier</p>
                </button>
              </div>
            </div>

            {/* Tier selection */}
            {appType && (
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-4 text-center">Choose your service level</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {TIERS.map(t => (
                    <button key={t.id} onClick={() => setTier(t.id)}
                      className={cn("text-left rounded-xl border-2 p-5 transition-all relative",
                        tier === t.id ? "border-accent bg-accent-light ring-1 ring-accent/20" : "border-border hover:border-accent/40"
                      )}>
                      {t.popular && <Badge variant="accent" className="absolute -top-2 right-3 text-xs">Most Popular</Badge>}
                      <t.icon className="h-5 w-5 text-accent mb-2" />
                      <p className="font-semibold text-text-primary">{t.name}</p>
                      <p className="text-2xl font-bold text-accent mt-1">${t.price}</p>
                      <p className="text-xs text-text-secondary mt-1">{t.description}</p>
                      <ul className="mt-3 space-y-1">
                        {t.features.map(f => (
                          <li key={f} className="text-sm text-text-secondary flex items-start gap-1">
                            <CheckCircle className="h-3 w-3 text-success mt-0.5 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                <div className="text-center mt-6">
                  <Button onClick={handleStartApplication} loading={submitting} size="lg">
                    Start Application <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <p className="text-xs text-text-muted mt-2">You&apos;ll need to sign in or create a free account</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Information */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-text-primary">
                {appType === "business" ? "Business Information" : "Personal Information"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-muted font-medium">Full Name *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-text-muted font-medium">Email *</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-text-muted font-medium">Phone</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-text-muted font-medium">National ID Number *</label>
                  <Input value={nationalId} onChange={e => setNationalId(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-text-muted font-medium">TIN Number *</label>
                  <Input value={tin} onChange={e => setTin(e.target.value)} className="mt-1" />
                </div>
              </div>

              {appType === "business" && (
                <>
                  <hr className="border-border" />
                  <h3 className="text-sm font-semibold text-text-primary">Business Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-text-muted font-medium">Legal Business Name *</label>
                      <Input value={legalName} onChange={e => setLegalName(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Trading Name</label>
                      <Input value={tradingName} onChange={e => setTradingName(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Registration Number *</label>
                      <Input value={bizRegNum} onChange={e => setBizRegNum(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Business Address *</label>
                      <Input value={bizAddress} onChange={e => setBizAddress(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Business Email</label>
                      <Input type="email" value={bizEmail} onChange={e => setBizEmail(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Business Phone</label>
                      <Input value={bizPhone} onChange={e => setBizPhone(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Website</label>
                      <Input value={bizWebsite} onChange={e => setBizWebsite(e.target.value)} className="mt-1" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Year Established</label>
                      <Input type="number" value={yearEstablished} onChange={e => setYearEstablished(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Employee Count</label>
                      <Input type="number" value={employeeCount} onChange={e => setEmployeeCount(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Guyanese Ownership %</label>
                      <Input type="number" value={ownershipPct} onChange={e => setOwnershipPct(e.target.value)} className="mt-1" min="0" max="100" />
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-text-primary mt-4">Service Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setSelectedCategories(prev =>
                        prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                      )}
                        className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                          selectedCategories.includes(cat)
                            ? "bg-accent text-white border-accent"
                            : "bg-bg-card border-border text-text-secondary hover:border-accent/40"
                        )}>
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-xs text-text-muted font-medium">Service Description</label>
                    <textarea className="w-full h-20 mt-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      value={serviceDescription} onChange={e => setServiceDescription(e.target.value)}
                      placeholder="Describe the services your company provides..." />
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveStep1} loading={submitting}>Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Documents */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Upload Documents</h2>
              <p className="text-sm text-text-secondary">Upload the required documents for your LCS registration. Accepted formats: PDF, JPG, PNG (max 10MB each).</p>

              <div className="space-y-3">
                {docChecklist.map(doc => (
                  <div key={doc.key} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border">
                    <div className="flex items-center gap-2">
                      {uploadedDocs[doc.key] ? (
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-text-primary">{doc.label} {doc.required && <span className="text-danger">*</span>}</p>
                        {uploadedDocs[doc.key] && <p className="text-xs text-success">{uploadedDocs[doc.key].name}</p>}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(doc.key, f); }} />
                      <span className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1">
                        <Upload className="h-3 w-3" /> {uploadedDocs[doc.key] ? "Replace" : "Upload"}
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handleSaveDocuments} loading={submitting}>Continue to Review <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Pay */}
        {step === 3 && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <h2 className="text-lg font-semibold text-text-primary">Review & Pay</h2>

              <div className="bg-bg-primary rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Application Type</span><span className="font-medium capitalize">{appType}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Service Level</span><Badge variant="accent">{selectedTier.name}</Badge></div>
                <div className="flex justify-between"><span className="text-text-muted">Applicant</span><span className="font-medium">{name}</span></div>
                {appType === "business" && <div className="flex justify-between"><span className="text-text-muted">Business</span><span className="font-medium">{legalName}</span></div>}
                <div className="flex justify-between"><span className="text-text-muted">Email</span><span>{email}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Documents Uploaded</span><span>{Object.keys(uploadedDocs).length} files</span></div>
              </div>

              <div className="bg-accent-light border border-accent/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">{selectedTier.name} Service</p>
                    <p className="text-xs text-text-secondary">{selectedTier.description}</p>
                  </div>
                  <p className="text-2xl font-bold text-accent">${selectedTier.price}</p>
                </div>
              </div>

              <div className="text-xs text-text-muted space-y-1">
                <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> Applications are typically processed within 5-10 business days</p>
                <p className="flex items-center gap-1"><Shield className="h-3 w-3" /> Your data is encrypted and only shared with the Local Content Secretariat</p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={handlePayAndSubmit} loading={submitting} size="lg">
                  <CreditCard className="h-4 w-4 mr-1" /> Pay ${selectedTier.price} & Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* What happens next */}
        {step === 0 && appType && (
          <div className="mt-12 text-center">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">What happens after you apply</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
              {[
                { icon: FileText, label: "Complete Application", desc: "Fill out your details and upload documents" },
                { icon: CheckCircle, label: "We Review", desc: "Our team checks everything is complete and correct" },
                { icon: Shield, label: "Submitted to LCS", desc: "We submit your application to the Secretariat" },
                { icon: Sparkles, label: "Get Certified", desc: "Receive your LCS Certificate ID and join the directory" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="p-3 rounded-full bg-accent/10 mb-2"><s.icon className="h-5 w-5 text-accent" /></div>
                  <p className="font-medium text-text-primary">{s.label}</p>
                  <p className="text-xs text-text-secondary mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
