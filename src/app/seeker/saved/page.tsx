"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bookmark, ExternalLink, Trash2, Calendar, Building2, Briefcase } from "lucide-react";
import { fetchMySavedOpportunities, seekerUnsaveOpportunity, fetchMySavedJobs, seekerUnsaveJob } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function SeekerSavedPage() {
  const [savedOpps, setSavedOpps] = useState<Awaited<ReturnType<typeof fetchMySavedOpportunities>>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "jobs" | "opportunities">("all");

  useEffect(() => {
    Promise.all([fetchMySavedOpportunities(), fetchMySavedJobs()])
      .then(([opps, jobs]) => { setSavedOpps(opps); setSavedJobs(jobs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUnsaveOpp = async (oppId: string) => {
    try {
      await seekerUnsaveOpportunity(oppId);
      setSavedOpps(prev => prev.filter(s => s.opportunityId !== oppId));
      toast.success("Removed");
    } catch { toast.error("Failed"); }
  };

  const handleUnsaveJob = async (savedId: string) => {
    try {
      await seekerUnsaveJob(savedId);
      setSavedJobs(prev => prev.filter(s => s.id !== savedId));
      toast.success("Removed");
    } catch { toast.error("Failed"); }
  };

  const totalCount = savedOpps.length + savedJobs.length;

  return (
    <>
      <SeekerTopBar title="Saved Items" description={`${totalCount} saved item${totalCount !== 1 ? "s" : ""}`} />

      <div className="p-4 sm:p-8 max-w-5xl space-y-4">
        {/* Tabs */}
        <div className="flex gap-1">
          {(["all", "jobs", "opportunities"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                tab === t ? "bg-accent text-white" : "text-text-muted hover:text-text-primary hover:bg-bg-primary"
              )}>
              {t === "all" ? `All (${totalCount})` : t === "jobs" ? `Jobs (${savedJobs.length})` : `Opportunities (${savedOpps.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
        ) : totalCount === 0 ? (
          <EmptyState icon={Bookmark} title="No saved items"
            description="Save jobs and opportunities to review them later."
            actionLabel="Browse Jobs" onAction={() => window.location.href = "/seeker/jobs"}
            secondaryLabel="Browse Opportunities" secondaryOnAction={() => window.location.href = "/seeker/opportunities"}
          />
        ) : (
          <div className="space-y-3">
            {/* Saved Jobs */}
            {(tab === "all" || tab === "jobs") && savedJobs.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="accent" className="text-xs">Job</Badge>
                        {item.category && <Badge variant="default" className="text-xs">{item.category}</Badge>}
                      </div>
                      <Link href={item.jobType === "posted" ? `/seeker/jobs/${item.jobId}` : "#"}>
                        <h3 className="text-sm font-medium text-text-primary hover:text-accent transition-colors">{item.title}</h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                        <Building2 className="h-3 w-3" /> {item.company}
                        {item.location && <><span>·</span>{item.location}</>}
                      </div>
                      {item.savedAt && <p className="text-xs text-text-muted mt-1">Saved {new Date(item.savedAt).toLocaleDateString()}</p>}
                    </div>
                    <button onClick={() => handleUnsaveJob(item.id)} className="p-2 rounded-lg hover:bg-danger-light transition-colors" title="Remove">
                      <Trash2 className="h-4 w-4 text-text-muted hover:text-danger" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Saved Opportunities */}
            {(tab === "all" || tab === "opportunities") && savedOpps.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="warning" className="text-xs">Opportunity</Badge>
                        {item.type && <Badge variant="default" className="text-xs">{item.type}</Badge>}
                      </div>
                      <h3 className="text-sm font-medium text-text-primary line-clamp-2">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                        <Building2 className="h-3 w-3" /> {item.contractorName}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {item.deadline && <span className="text-xs text-text-muted flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {new Date(item.deadline).toLocaleDateString()}</span>}
                        {item.savedAt && <span className="text-xs text-text-muted">Saved {new Date(item.savedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-bg-primary" title="View original">
                          <ExternalLink className="h-4 w-4 text-text-muted" />
                        </a>
                      )}
                      <button onClick={() => handleUnsaveOpp(item.opportunityId)} className="p-2 rounded-lg hover:bg-danger-light" title="Remove">
                        <Trash2 className="h-4 w-4 text-text-muted hover:text-danger" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
