"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import {
  ArrowLeft, Building2, Megaphone, Briefcase, Mail, Phone, User,
  ExternalLink, CheckCircle, Shield, Calendar, Clock, Sparkles,
  Flag, Lock, Crown,
} from "lucide-react";
import { fetchCompanyProfile, claimCompanyProfile, fetchPlanAndUsage } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CompanyProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [plan, setPlan] = useState("starter");

  useEffect(() => {
    fetchCompanyProfile(slug).then(setData).catch(() => {}).finally(() => setLoading(false));
    fetchPlanAndUsage().then(d => setPlan(d.plan)).catch(() => {});
  }, [slug]);

  const isPro = plan === "pro" || plan === "enterprise";

  const handleClaim = async () => {
    if (!data?.profile) return;
    setClaiming(true);
    try {
      await claimCompanyProfile(data.profile.id);
      setData((prev: typeof data) => prev ? { ...prev, profile: { ...prev.profile, claimed: true, claimedAt: new Date() } } : prev);
      toast.success("Company claimed! You can now manage this profile.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to claim");
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <>
        <TopBar title="Company" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <TopBar title="Company" />
        <div className="p-8 text-center">
          <p className="text-text-secondary">Company not found.</p>
          <Link href="/dashboard/companies"><Button variant="ghost" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button></Link>
        </div>
      </>
    );
  }

  const { profile, opportunities, jobPostings } = data;
  const emails = profile.contactEmails ? JSON.parse(profile.contactEmails) : [];
  const phones = profile.contactPhones ? JSON.parse(profile.contactPhones) : [];
  const names = profile.contactNames ? JSON.parse(profile.contactNames) : [];

  return (
    <div>
      <TopBar title={profile.companyName} />
      <div className="p-4 sm:p-8 max-w-5xl">
        <Link href="/dashboard/companies" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Companies
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <CompanyLogo companyName={profile.companyName} size={64} className="rounded-xl" />
            <div>
              <h1 className="text-xl font-heading font-bold text-text-primary">{profile.companyName}</h1>
              {profile.legalName && profile.legalName !== profile.companyName && (
                <p className="text-sm text-text-muted">{profile.legalName}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {profile.claimed ? (
                  <Badge variant="accent" className="gap-1"><CheckCircle className="h-3 w-3" /> Claimed</Badge>
                ) : (
                  <Badge variant="default">Unclaimed</Badge>
                )}
                {profile.lcsRegistered && (
                  <Badge variant="success" className="gap-1"><Shield className="h-3 w-3" /> LCS Registered</Badge>
                )}
                {profile.verified && (
                  <Badge variant="accent" className="gap-1"><CheckCircle className="h-3 w-3" /> Verified</Badge>
                )}
              </div>
              {profile.description && (
                <p className="text-sm text-text-secondary mt-2">{profile.description}</p>
              )}
            </div>
          </div>

          {!profile.claimed && (
            <Button onClick={handleClaim} loading={claiming} className="gap-1.5 shrink-0">
              <Flag className="h-4 w-4" /> Claim This Business
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-text-primary">{profile.totalOpportunities}</p>
            <p className="text-xs text-text-muted">Opportunities</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-accent">{profile.activeOpportunities}</p>
            <p className="text-xs text-text-muted">Active</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-text-primary">{profile.totalJobPostings}</p>
            <p className="text-xs text-text-muted">Job Postings</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{profile.openJobPostings}</p>
            <p className="text-xs text-text-muted">Open Positions</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Contact */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Contact Information</CardTitle>
                {!isPro && (emails.length > 0 || phones.length > 0) && (
                  <Lock className="h-3.5 w-3.5 text-text-muted" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isPro ? (
                <div className="space-y-2">
                  {names.map((n: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                      <User className="h-3.5 w-3.5 text-text-muted" /> {n}
                    </div>
                  ))}
                  {emails.map((e: string, i: number) => (
                    <a key={i} href={`mailto:${e}`} className="flex items-center gap-2 text-xs text-accent hover:text-accent-hover">
                      <Mail className="h-3.5 w-3.5" /> {e}
                    </a>
                  ))}
                  {phones.map((p: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                      <Phone className="h-3.5 w-3.5 text-text-muted" /> {p}
                    </div>
                  ))}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-accent hover:text-accent-hover">
                      <ExternalLink className="h-3.5 w-3.5" /> {profile.website}
                    </a>
                  )}
                  {emails.length === 0 && phones.length === 0 && names.length === 0 && !profile.website && (
                    <p className="text-xs text-text-muted">No contact info available</p>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {/* Blurred preview */}
                  <div className="space-y-2 select-none" style={{ filter: "blur(5px)" }}>
                    {names.length > 0 ? names.slice(0, 2).map((n: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                        <User className="h-3.5 w-3.5 text-text-muted" /> {n}
                      </div>
                    )) : (
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <User className="h-3.5 w-3.5 text-text-muted" /> Contact Name
                      </div>
                    )}
                    {emails.length > 0 ? emails.slice(0, 2).map((e: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                        <Mail className="h-3.5 w-3.5 text-text-muted" /> {e}
                      </div>
                    )) : (
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Mail className="h-3.5 w-3.5 text-text-muted" /> email@company.com
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Phone className="h-3.5 w-3.5 text-text-muted" /> +592 XXX XXXX
                    </div>
                  </div>
                  {/* Overlay CTA */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-card/60 rounded-lg">
                    <Lock className="h-5 w-5 text-text-muted mb-2" />
                    <p className="text-xs font-medium text-text-primary text-center">Contact info is Pro only</p>
                    <Link href="/dashboard/settings/billing">
                      <Button size="sm" className="mt-2 gap-1.5">
                        <Crown className="h-3.5 w-3.5" /> Upgrade to Pro
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Procurement Categories</CardTitle></CardHeader>
            <CardContent>
              {profile.procurementCategories?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.procurementCategories.map((c: string) => (
                    <Badge key={c} variant="default" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No categories identified</p>
              )}
              {profile.employmentCategories?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-light">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Employment</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.employmentCategories.map((c: string) => (
                      <Badge key={c} variant="accent" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Claim CTA */}
          {!profile.claimed && (
            <Card className="border-accent/20 bg-accent-light">
              <CardContent className="p-5">
                <Flag className="h-8 w-8 text-accent mb-3" />
                <h3 className="text-sm font-semibold text-text-primary mb-1">Is this your company?</h3>
                <p className="text-xs text-text-secondary mb-4">
                  Claim this profile to manage your company&apos;s presence on LCA Desk.
                  Update your info, respond to applicants, and manage your Local Content filings.
                </p>
                <Button onClick={handleClaim} loading={claiming} size="sm" className="w-full gap-1.5">
                  <Flag className="h-4 w-4" /> Claim This Business
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Procurement Opportunities ({opportunities.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {opportunities.map((o: { id: string; title: string; noticeType: string | null; status: string | null; postedDate: string | null; deadline: string | null; sourceUrl: string | null; aiSummary: string | null }) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  let summary: any = null;
                  try { if (o.aiSummary) summary = JSON.parse(o.aiSummary); } catch {}
                  const isExpired = o.status === "expired";
                  return (
                    <div key={o.id} className={cn("border border-border-light rounded-lg p-3", isExpired && "opacity-50")}>
                      <div className="flex items-center gap-2 mb-1">
                        {o.noticeType && <Badge variant="accent" className="text-[10px]">{o.noticeType}</Badge>}
                        <Badge variant={isExpired ? "default" : "success"} className="text-[10px]">{isExpired ? "Closed" : "Active"}</Badge>
                        {summary && <Sparkles className="h-3 w-3 text-accent" />}
                      </div>
                      <p className="text-sm font-medium text-text-primary line-clamp-1">
                        {o.title.replace(/&#038;/g, "&").replace(/&#8211;/g, "\u2013")}
                      </p>
                      {summary?.scope_of_work && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{summary.scope_of_work}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-[11px] text-text-muted">
                        {o.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{o.deadline}</span>}
                        {o.sourceUrl && (
                          <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Job Postings */}
        {jobPostings.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-accent" />
                <CardTitle className="text-sm">Job Postings ({jobPostings.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {jobPostings.map((j: { id: string; jobTitle: string; employmentCategory: string | null; status: string | null; closingDate: string | null; location: string | null; sourceUrl: string | null }) => {
                  const isClosed = j.status === "closed";
                  return (
                    <div key={j.id} className={cn("border border-border-light rounded-lg p-3", isClosed && "opacity-50")}>
                      <div className="flex items-center gap-2 mb-1">
                        {j.employmentCategory && <Badge variant="default" className="text-[10px]">{j.employmentCategory}</Badge>}
                        <Badge variant={isClosed ? "default" : "success"} className="text-[10px]">{isClosed ? "Closed" : "Open"}</Badge>
                      </div>
                      <p className="text-sm font-medium text-text-primary">{j.jobTitle}</p>
                      <div className="flex gap-3 mt-1 text-[11px] text-text-muted">
                        {j.location && <span>{j.location}</span>}
                        {j.closingDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{j.closingDate}</span>}
                        {j.sourceUrl && (
                          <a href={j.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
