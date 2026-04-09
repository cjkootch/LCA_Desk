"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Megaphone, Search, Bookmark, BookmarkCheck, ExternalLink, Calendar,
  Building2, ChevronDown, ChevronUp, Sparkles, FileDown, FileText,
  Mail,
} from "lucide-react";
import { AiSummaryPanel } from "@/components/shared/AiSummaryPanel";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import { fetchSeekerOpportunities, seekerSaveOpportunity, seekerUnsaveOpportunity, fetchMySavedOpportunities } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { decodeHtml } from "@/lib/utils/decode-html";

export default function SeekerOpportunitiesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    } catch { toast.error("Failed to update"); }
  };

  const NOTICE_VARIANT: Record<string, "accent" | "gold" | "warning" | "default"> = {
    EOI: "accent", RFQ: "gold", RFP: "warning", RFI: "default",
  };

  return (
    <>
      <SeekerTopBar title="Opportunities" description="Procurement notices and employment opportunities from the petroleum sector" />

      <div className="p-4 sm:p-8 max-w-5xl space-y-6">
        {/* Search & filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search opportunities, companies, scope..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
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
          <EmptyState icon={Megaphone} title="No opportunities found" description="Try adjusting your filters or check back later." />
        ) : (
          <>
            <p className="text-sm text-text-muted">{opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"} found</p>
            <div className="space-y-3">
              {opportunities.map((opp) => {
                const isExpanded = expandedId === opp.id;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let parsedSummary: any = null;
                try { if (opp.aiSummary) parsedSummary = JSON.parse(opp.aiSummary); } catch {}
                const displayName = opp.contractorName === "Unknown" && parsedSummary?.issuing_company
                  ? parsedSummary.issuing_company : opp.contractorName;

                return (
                  <Card key={opp.id} className={cn("transition-colors", isExpanded && "border-accent/30")}>
                    <CardContent className="p-0">
                      {/* Header */}
                      <div
                        className="p-4 sm:p-5 cursor-pointer hover:bg-bg-primary/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              {opp.noticeType && (
                                <Badge variant={NOTICE_VARIANT[opp.noticeType] || "default"}>{opp.noticeType}</Badge>
                              )}
                              {parsedSummary?.opportunity_type && !opp.noticeType && (
                                <Badge variant={NOTICE_VARIANT[parsedSummary.opportunity_type] || "default"}>
                                  {parsedSummary.opportunity_type}
                                </Badge>
                              )}
                              <Badge variant={opp.type === "employment" ? "accent" : "warning"} className="text-xs">{opp.type}</Badge>
                              {opp.attachmentUrl && <FileText className="h-3.5 w-3.5 text-text-muted" />}
                              {parsedSummary && <Sparkles className="h-3.5 w-3.5 text-accent" />}
                            </div>

                            <h3 className="text-sm font-medium text-text-primary line-clamp-2">{decodeHtml(opp.title)}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <CompanyLogo companyName={displayName} size={18} />
                              <span className="text-xs text-text-secondary">{displayName}</span>
                            </div>

                            {parsedSummary?.scope_of_work && !isExpanded && (
                              <p className="text-xs text-text-muted mt-1 line-clamp-1">{parsedSummary.scope_of_work}</p>
                            )}

                            <div className="flex items-center gap-4 mt-2">
                              {opp.postedDate && (
                                <span className="flex items-center gap-1 text-sm text-text-muted">
                                  <Calendar className="h-3 w-3" /> Posted {new Date(opp.postedDate).toLocaleDateString()}
                                </span>
                              )}
                              {opp.deadline && (
                                <span className="flex items-center gap-1 text-sm text-text-muted">
                                  <Calendar className="h-3 w-3" /> Due {new Date(opp.deadline).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleSave(opp.id); }}
                              className="p-2 rounded-lg hover:bg-bg-primary transition-colors"
                            >
                              {savedIds.has(opp.id) ? (
                                <BookmarkCheck className="h-4 w-4 text-accent" />
                              ) : (
                                <Bookmark className="h-4 w-4 text-text-muted" />
                              )}
                            </button>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="border-t border-border-light px-4 sm:px-5 pb-5 pt-4 space-y-5">
                          {parsedSummary && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-accent" />
                                <h3 className="text-sm font-semibold text-text-primary">AI Summary</h3>
                              </div>
                              <AiSummaryPanel summary={parsedSummary} />
                            </div>
                          )}

                          {opp.description && !parsedSummary && (
                            <div>
                              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Description</h4>
                              <p className="text-sm text-text-secondary">{opp.description}</p>
                            </div>
                          )}

                          {opp.attachmentUrl && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Attachment</h4>
                                <a href={opp.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="gap-1.5">
                                    <FileDown className="h-3.5 w-3.5" /> Download PDF
                                  </Button>
                                </a>
                              </div>
                              <div className="rounded-lg border border-border overflow-hidden bg-bg-primary">
                                <iframe
                                  src={opp.attachmentUrl}
                                  className="w-full"
                                  style={{ height: "500px" }}
                                  title={`PDF: ${opp.title}`}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
                            {opp.sourceUrl && (
                              <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="gap-1.5">
                                  <ExternalLink className="h-3.5 w-3.5" /> View on LCS
                                </Button>
                              </a>
                            )}
                            {parsedSummary?.contact_email && (
                              <a href={`mailto:${parsedSummary.contact_email}?subject=Re: ${decodeHtml(opp.title)}`}>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                  <Mail className="h-3.5 w-3.5" /> Contact
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
