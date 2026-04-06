"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Search, Users, MapPin, Briefcase, Mail, FileText,
  CheckCircle, Lock, Crown, Shield, Trophy,
} from "lucide-react";
import { fetchTalentPool, fetchPlanAndUsage, fetchUserBadges } from "@/server/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Management", "Technical", "Administrative", "Skilled Labour", "Semi-Skilled Labour", "Unskilled Labour"];

export default function TalentPoolPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [guyaneseOnly, setGuyaneseOnly] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchTalentPool({
        search: search || undefined,
        category: category !== "All" ? category : undefined,
        guyaneseOnly: guyaneseOnly || undefined,
      }),
      fetchPlanAndUsage(),
    ])
      .then(([pool, plan]) => {
        setCandidates(pool);
        setIsPro(plan.effectivePlan === "pro" || plan.effectivePlan === "enterprise");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const guyaneseCount = candidates.filter(c => c.isGuyanese).length;

  return (
    <div>
      <TopBar title="Talent Pool" description="Find Guyanese talent for your workforce" />
      <div className="p-4 sm:p-8 max-w-5xl">
        {/* Value prop */}
        <div className="rounded-lg border border-accent/20 bg-accent-light p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Hire Guyanese nationals to improve your LCA compliance</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Under Section 12 of the Local Content Act, first consideration must be given to Guyanese nationals.
                Candidates who opt-in to the talent pool are actively seeking petroleum sector employment.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-text-primary">{candidates.length}</p>
            <p className="text-xs text-text-muted">Candidates</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{guyaneseCount}</p>
            <p className="text-xs text-text-muted">Guyanese</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-accent">{[...new Set(candidates.map(c => c.employmentCategory).filter(Boolean))].length}</p>
            <p className="text-xs text-text-muted">Categories</p>
          </Card>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Search by name, job title, skills..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="pl-9"
              />
            </div>
            <Button onClick={loadData}>Search</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { setCategory(cat); setTimeout(loadData, 0); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  category === cat ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
                }`}>
                {cat}
              </button>
            ))}
            <button onClick={() => { setGuyaneseOnly(!guyaneseOnly); setTimeout(loadData, 0); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                guyaneseOnly ? "bg-success text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
              }`}>
              Guyanese Only
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates found"
            description="Try adjusting your filters. Candidates appear here when they opt-in to the talent pool."
          />
        ) : (
          <div className="space-y-3">
            {candidates.map(c => (
              <Card key={c.id} className="hover:border-accent/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-9 w-9 rounded-full bg-accent-light flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-accent">
                            {(c.userName || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {isPro ? c.userName : `${(c.userName || "").split(" ")[0]} ${(c.userName || "").split(" ")[1]?.charAt(0) || ""}.`}
                          </p>
                          {c.headline && <p className="text-xs text-text-secondary truncate">{c.headline}</p>}
                          {!c.headline && c.currentJobTitle && <p className="text-xs text-text-secondary">{c.currentJobTitle}</p>}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {c.isGuyanese && <Badge variant="success" className="text-[10px]">Guyanese</Badge>}
                        {c.employmentCategory && <Badge variant="default" className="text-[10px]">{c.employmentCategory}</Badge>}
                        {c.contractTypePreference && <Badge variant="default" className="text-[10px]">{c.contractTypePreference}</Badge>}
                        {c.badges?.map((b: string) => (
                          <Badge key={b} variant="gold" className="text-[10px] gap-0.5"><Trophy className="h-2.5 w-2.5" />{b}</Badge>
                        ))}
                        {c.yearsExperience && <Badge variant="default" className="text-[10px]">{c.yearsExperience}yr exp</Badge>}
                        {c.locationPreference && (
                          <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                            <MapPin className="h-2.5 w-2.5" /> {c.locationPreference}
                          </span>
                        )}
                      </div>

                      {c.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.skills.slice(0, 5).map((s: string) => (
                            <span key={s} className="text-[10px] bg-bg-primary text-text-secondary px-1.5 py-0.5 rounded">
                              {s}
                            </span>
                          ))}
                          {c.skills.length > 5 && <span className="text-[10px] text-text-muted">+{c.skills.length - 5}</span>}
                        </div>
                      )}
                    </div>

                    {/* Contact — gated behind Pro */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isPro ? (
                        <>
                          {c.userEmail && (
                            <a href={`mailto:${c.userEmail}?subject=Employment Opportunity — ${c.currentJobTitle || "Your Profile on LCA Desk"}`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <Mail className="h-3.5 w-3.5" /> Contact
                              </Button>
                            </a>
                          )}
                          {c.cvUrl && (
                            <a href={c.cvUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="gap-1.5">
                                <FileText className="h-3.5 w-3.5" /> CV
                              </Button>
                            </a>
                          )}
                        </>
                      ) : (
                        <Link href="/dashboard/settings/billing">
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Lock className="h-3.5 w-3.5" />
                            <Crown className="h-3.5 w-3.5 text-gold" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
