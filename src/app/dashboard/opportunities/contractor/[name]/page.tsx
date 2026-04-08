"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Building2, FileText, Calendar, Mail, Phone, User,
  ExternalLink, Sparkles, Clock,
} from "lucide-react";
import { fetchContractorProfile } from "@/server/actions";
import { decodeHtml } from "@/lib/utils/decode-html";
import Link from "next/link";
import { CompanyLogo } from "@/components/shared/CompanyLogo";

export default function ContractorProfilePage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContractorProfile(name)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <>
        <TopBar title="Contractor" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <TopBar title="Contractor" />
        <div className="p-8 text-center">
          <p className="text-text-secondary">Contractor not found.</p>
          <Link href="/dashboard/opportunities">
            <Button variant="ghost" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <div>
      <TopBar title={profile.contractorName} />
      <div className="p-4 sm:p-8 max-w-5xl">
        <Link href="/dashboard/opportunities/analytics" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Analytics
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <CompanyLogo companyName={profile.contractorName} size={56} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">{profile.contractorName}</h1>
            <p className="text-sm text-text-secondary">
              {profile.totalNotices} notice{profile.totalNotices !== 1 ? "s" : ""} &middot;
              {profile.activeNotices} active &middot;
              Active since {profile.firstNotice ? new Date(profile.firstNotice).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Stats */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Total Notices</span>
                <span className="text-lg font-bold text-text-primary">{profile.totalNotices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Active</span>
                <span className="text-lg font-bold text-success">{profile.activeNotices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Latest Notice</span>
                <span className="text-xs text-text-primary">
                  {profile.latestNotice ? new Date(profile.latestNotice).toLocaleDateString() : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-text-muted uppercase tracking-wider">Procurement Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {profile.categories.length > 0 ? profile.categories.map((c: string) => (
                  <Badge key={c} variant="default" className="text-[10px]">{c}</Badge>
                )) : <p className="text-xs text-text-muted">No categories identified</p>}
              </div>
              {profile.noticeTypes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-light">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Notice Types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.noticeTypes.map((t: string) => (
                      <Badge key={t} variant="accent" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-text-muted uppercase tracking-wider">Contacts Found</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.contacts.length > 0 ? (
                <div className="space-y-3">
                  {profile.contacts.map((c: { name?: string; email?: string; phone?: string }, i: number) => (
                    <div key={i} className="space-y-1">
                      {c.name && (
                        <div className="flex items-center gap-1.5 text-xs text-text-primary">
                          <User className="h-3 w-3 text-text-muted" /> {c.name}
                        </div>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover">
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Phone className="h-3 w-3 text-text-muted" /> {c.phone}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No contact info extracted yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notice History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Notices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.notices.map((n: { id: string; title: string; noticeType: string | null; postedDate: string | null; deadline: string | null; sourceUrl: string | null; status: string | null; aiSummary: string | null }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let summary: any = null;
                try { if (n.aiSummary) summary = JSON.parse(n.aiSummary); } catch {}

                return (
                  <div key={n.id} className="border border-border-light rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          {n.noticeType && <Badge variant="accent" className="text-[10px]">{n.noticeType}</Badge>}
                          <Badge variant={n.status === "active" ? "success" : "default"} className="text-[10px]">
                            {n.status || "active"}
                          </Badge>
                          {summary && <Sparkles className="h-3 w-3 text-accent" />}
                        </div>
                        <p className="text-sm font-medium text-text-primary line-clamp-1">
                          {decodeHtml(n.title)}
                        </p>
                        {summary?.scope_of_work && (
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">{summary.scope_of_work}</p>
                        )}
                        <div className="flex gap-3 mt-1">
                          {n.postedDate && (
                            <span className="text-[11px] text-text-muted flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {n.postedDate}
                            </span>
                          )}
                          {n.deadline && (
                            <span className="text-[11px] text-text-muted flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Due: {n.deadline}
                            </span>
                          )}
                        </div>
                      </div>
                      {n.sourceUrl && (
                        <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
