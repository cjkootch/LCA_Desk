"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, MapPin, Calendar, Users, Briefcase, Sparkles, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react";
import { fetchPublicJobs, fetchLcsJobs, seekerSaveJob, seekerUnsaveJob, fetchMySavedJobs } from "@/server/actions";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import Link from "next/link";

const CATEGORIES = [
  "All", "Management", "Technical", "Administrative", "Skilled Labour",
  "Semi-Skilled Labour", "Unskilled Labour",
];

const CONTRACT_TYPES = ["All", "Full-time", "Part-time", "Contract", "Permanent", "Temporary"];

export default function SeekerJobsPage() {
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof fetchPublicJobs>>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lcsJobs, setLcsJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [contractType, setContractType] = useState("All");
  const [tab, setTab] = useState<"all" | "posted" | "lcs">("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedJobIds, setSavedJobIds] = useState<Map<string, string>>(new Map()); // jobId → savedId

  const loadSaved = () => {
    fetchMySavedJobs().then(saved => {
      const map = new Map<string, string>();
      saved.forEach((s: { id: string; jobId: string }) => map.set(s.jobId, s.id));
      setSavedJobIds(map);
    }).catch(() => {});
  };

  const toggleSaveJob = async (jobId: string, jobType: "posted" | "lcs") => {
    const savedId = savedJobIds.get(jobId);
    if (savedId) {
      await seekerUnsaveJob(savedId);
      setSavedJobIds(prev => { const next = new Map(prev); next.delete(jobId); return next; });
    } else {
      await seekerSaveJob(jobId, jobType);
      loadSaved();
    }
  };

  const loadJobs = () => {
    setLoading(true);
    Promise.all([
      fetchPublicJobs({
        search: search || undefined,
        category: category !== "All" ? category : undefined,
        contractType: contractType !== "All" ? contractType : undefined,
      }),
      fetchLcsJobs({ search: search || undefined, category: category !== "All" ? category : undefined }),
    ])
      .then(([posted, lcs]) => { setJobs(posted); setLcsJobs(lcs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadJobs(); loadSaved(); }, [search, category, contractType]);

  const handleSearch = () => loadJobs();

  return (
    <>
      <SeekerTopBar title="Find Jobs" description="Browse open positions in Guyana's petroleum sector" />

      <div className="p-4 sm:p-6 max-w-5xl space-y-6">
        {/* Search & Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search by title, company, or location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      category === cat
                        ? "bg-accent text-white"
                        : "bg-bg-primary text-text-secondary hover:bg-border-light"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="border-l border-border pl-2 flex flex-wrap gap-1">
                {CONTRACT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setContractType(ct)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      contractType === ct
                        ? "bg-accent text-white"
                        : "bg-bg-primary text-text-secondary hover:bg-border-light"
                    }`}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source tabs */}
        <div className="flex items-center gap-1 bg-bg-primary rounded-lg p-1 w-fit mb-4">
          {([
            { key: "all" as const, label: `All (${jobs.length + lcsJobs.length})` },
            { key: "posted" as const, label: `Posted (${jobs.length})` },
            { key: "lcs" as const, label: `LCS Board (${lcsJobs.length})` },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t.key ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : (tab === "all" ? jobs.length + lcsJobs.length : tab === "posted" ? jobs.length : lcsJobs.length) === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs found"
            description="Try adjusting your search filters or check back later for new postings."
          />
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {tab === "all" ? jobs.length + lcsJobs.length : tab === "posted" ? jobs.length : lcsJobs.length} position{(tab === "all" ? jobs.length + lcsJobs.length : tab === "posted" ? jobs.length : lcsJobs.length) !== 1 ? "s" : ""} found
            </p>

            {/* LCS Board Jobs */}
            {(tab === "all" || tab === "lcs") && lcsJobs.length > 0 && (
              <div className="space-y-3 mb-4">
                {tab === "all" && <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-2">From LCS Employment Board</h3>}
                {lcsJobs.filter(j => j.status === "open").map((job: { id: string; companyName: string; jobTitle: string; employmentCategory: string | null; closingDate: string | null; location: string | null; sourceUrl: string | null; aiSummary: string | null; status: string | null }) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  let ai: any = null;
                  try { if (job.aiSummary) ai = JSON.parse(job.aiSummary); } catch {}
                  return (
                    <Card key={job.id} className="hover:border-accent/30 transition-colors mb-3">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-medium text-text-primary">{job.jobTitle}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <CompanyLogo companyName={job.companyName} size={18} />
                              <span className="text-sm text-text-secondary">{job.companyName}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {job.employmentCategory && <Badge variant="default" className="text-xs">{job.employmentCategory}</Badge>}
                              <Badge variant="accent" className="text-xs">LCS Board</Badge>
                              {job.location && (
                                <span className="flex items-center gap-1 text-xs text-text-muted"><MapPin className="h-3 w-3" /> {job.location}</span>
                              )}
                            </div>
                            {ai?.summary && <p className="text-xs text-text-secondary mt-2 line-clamp-2">{ai.summary}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {job.closingDate && (
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-xs text-text-muted"><Calendar className="h-3 w-3" /> Closes</div>
                                <p className="text-xs font-medium text-text-primary mt-0.5">{new Date(job.closingDate).toLocaleDateString()}</p>
                              </div>
                            )}
                            <div className="flex gap-1">
                              <button onClick={() => toggleSaveJob(job.id, "lcs")} className="p-1.5 rounded-lg hover:bg-bg-primary transition-colors" title={savedJobIds.has(job.id) ? "Unsave" : "Save"}>
                                {savedJobIds.has(job.id) ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4 text-text-muted" />}
                              </button>
                              {job.sourceUrl && (
                                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="gap-1"><ExternalLink className="h-3 w-3" /> View</Button>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* User-posted Jobs */}
            {(tab === "all" || tab === "posted") && (
            <div className="space-y-3">
              {tab === "all" && jobs.length > 0 && <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Posted on LCA Desk</h3>}
              {jobs.map((job) => (
                <div key={job.id} className="relative mb-3">
                  <button onClick={(e) => { e.preventDefault(); toggleSaveJob(job.id, "posted"); }}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-bg-primary transition-colors" title={savedJobIds.has(job.id) ? "Unsave" : "Save"}>
                    {savedJobIds.has(job.id) ? <BookmarkCheck className="h-4 w-4 text-accent" /> : <Bookmark className="h-4 w-4 text-text-muted" />}
                  </button>
                <Link href={`/seeker/jobs/${job.id}`}>
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-medium text-text-primary">{job.jobTitle}</h3>
                          <p className="text-sm text-text-secondary mt-0.5">{job.companyName}</p>

                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="default" className="text-xs">{job.employmentCategory}</Badge>
                            <Badge variant="accent" className="text-xs">{job.contractType}</Badge>
                            {job.location && (
                              <span className="flex items-center gap-1 text-xs text-text-muted">
                                <MapPin className="h-3 w-3" /> {job.location}
                              </span>
                            )}
                            {job.vacancyCount && job.vacancyCount > 1 && (
                              <span className="flex items-center gap-1 text-xs text-text-muted">
                                <Users className="h-3 w-3" /> {job.vacancyCount} positions
                              </span>
                            )}
                          </div>

                          {job.description && (
                            <p className="text-xs text-text-secondary mt-2 line-clamp-2">{job.description}</p>
                          )}
                        </div>

                        {job.applicationDeadline && (
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-xs text-text-muted">
                              <Calendar className="h-3 w-3" />
                              <span>Deadline</span>
                            </div>
                            <p className="text-xs font-medium text-text-primary mt-0.5">
                              {new Date(job.applicationDeadline).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {job.guyaneseFirstStatement && (
                        <div className="mt-3 px-3 py-2 bg-accent-light rounded-md">
                          <p className="text-sm text-accent font-medium">
                            First Consideration: {job.guyaneseFirstStatement}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                </div>
              ))}
            </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
