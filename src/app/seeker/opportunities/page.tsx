"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Megaphone, Search, Bookmark, BookmarkCheck, ExternalLink, Calendar, Building2 } from "lucide-react";
import { fetchSeekerOpportunities, seekerSaveOpportunity, seekerUnsaveOpportunity, fetchMySavedOpportunities } from "@/server/actions";
import { toast } from "sonner";

export default function SeekerOpportunitiesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchSeekerOpportunities({
        search: search || undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
      }),
      fetchMySavedOpportunities(),
    ])
      .then(([opps, saved]) => {
        setOpportunities(opps);
        setSavedIds(new Set(saved.map((s) => s.opportunityId)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleToggleSave = async (oppId: string) => {
    try {
      if (savedIds.has(oppId)) {
        await seekerUnsaveOpportunity(oppId);
        setSavedIds((prev) => { const next = new Set(prev); next.delete(oppId); return next; });
        toast.success("Removed from saved");
      } else {
        await seekerSaveOpportunity(oppId);
        setSavedIds((prev) => new Set(prev).add(oppId));
        toast.success("Saved opportunity");
      }
    } catch {
      toast.error("Failed to update saved status");
    }
  };

  return (
    <>
      <SeekerTopBar title="Opportunities" description="LCS procurement notices and employment opportunities" />

      <div className="p-4 sm:p-8 max-w-5xl space-y-6">
        {/* Search & filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search opportunities..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadData()}
                  className="pl-9"
                />
              </div>
              <Button onClick={loadData}>Search</Button>
            </div>
            <div className="flex gap-2">
              {["all", "supplier", "employment"].map((t) => (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(t); setTimeout(loadData, 0); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                    typeFilter === t ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
                  }`}
                >
                  {t === "all" ? "All Types" : t}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No opportunities found"
            description="Try adjusting your filters or check back later."
          />
        ) : (
          <>
            <p className="text-sm text-text-muted">{opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"} found</p>
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <Card key={opp.id}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-text-primary line-clamp-2">{opp.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3 w-3 text-text-muted" />
                          <span className="text-xs text-text-secondary">{opp.contractorName}</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant={opp.type === "employment" ? "accent" : "warning"} className="text-[10px]">
                            {opp.type}
                          </Badge>
                          {opp.noticeType && <Badge variant="default" className="text-[10px]">{opp.noticeType}</Badge>}
                          {opp.lcaCategory && <Badge variant="default" className="text-[10px]">{opp.lcaCategory}</Badge>}
                          {opp.employmentCategory && <Badge variant="default" className="text-[10px]">{opp.employmentCategory}</Badge>}
                        </div>

                        {opp.description && (
                          <p className="text-xs text-text-secondary mt-2 line-clamp-2">{opp.description}</p>
                        )}

                        <div className="flex items-center gap-4 mt-2">
                          {opp.postedDate && (
                            <span className="flex items-center gap-1 text-[11px] text-text-muted">
                              <Calendar className="h-3 w-3" /> Posted {new Date(opp.postedDate).toLocaleDateString()}
                            </span>
                          )}
                          {opp.deadline && (
                            <span className="flex items-center gap-1 text-[11px] text-text-muted">
                              <Calendar className="h-3 w-3" /> Due {new Date(opp.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleSave(opp.id)}
                          className="p-2 rounded-lg hover:bg-bg-primary transition-colors"
                          title={savedIds.has(opp.id) ? "Unsave" : "Save"}
                        >
                          {savedIds.has(opp.id) ? (
                            <BookmarkCheck className="h-4 w-4 text-accent" />
                          ) : (
                            <Bookmark className="h-4 w-4 text-text-muted" />
                          )}
                        </button>
                        {opp.sourceUrl && (
                          <a
                            href={opp.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-bg-primary transition-colors"
                            title="View original"
                          >
                            <ExternalLink className="h-4 w-4 text-text-muted" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
