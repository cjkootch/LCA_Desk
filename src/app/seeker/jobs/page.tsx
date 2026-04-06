"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, MapPin, Calendar, Users, Briefcase } from "lucide-react";
import { fetchPublicJobs } from "@/server/actions";
import Link from "next/link";

const CATEGORIES = [
  "All", "Management", "Technical", "Administrative", "Skilled Labour",
  "Semi-Skilled Labour", "Unskilled Labour",
];

const CONTRACT_TYPES = ["All", "Full-time", "Part-time", "Contract", "Temporary"];

export default function SeekerJobsPage() {
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof fetchPublicJobs>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [contractType, setContractType] = useState("All");

  const loadJobs = () => {
    setLoading(true);
    fetchPublicJobs({
      search: search || undefined,
      category: category !== "All" ? category : undefined,
      contractType: contractType !== "All" ? contractType : undefined,
    })
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadJobs(); }, []);

  const handleSearch = () => loadJobs();

  return (
    <>
      <SeekerTopBar title="Find Jobs" description="Browse open positions in Guyana's petroleum sector" />

      <div className="p-4 sm:p-8 max-w-5xl space-y-6">
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
                    onClick={() => { setCategory(cat); setTimeout(loadJobs, 0); }}
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
                    onClick={() => { setContractType(ct); setTimeout(loadJobs, 0); }}
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

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs found"
            description="Try adjusting your search filters or check back later for new postings."
          />
        ) : (
          <>
            <p className="text-sm text-text-muted">{jobs.length} position{jobs.length !== 1 ? "s" : ""} found</p>
            <div className="space-y-3">
              {jobs.map((job) => (
                <Link key={job.id} href={`/seeker/jobs/${job.id}`}>
                  <Card className="hover:border-accent/30 transition-colors cursor-pointer mb-3">
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
                          <p className="text-[11px] text-accent font-medium">
                            First Consideration: {job.guyaneseFirstStatement}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
