"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bookmark, BookmarkCheck, ExternalLink, Filter, Megaphone,
  FileText, Clock, Search, Sparkles, ChevronDown, ChevronUp,
  Mail, FileDown, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { AiSummaryPanel } from "@/components/shared/AiSummaryPanel";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import {
  fetchOpportunitiesFeed, fetchSavedOpportunities,
  saveOpportunity, unsaveOpportunity, fetchPlanAndUsage,
} from "@/server/actions";

type Opportunity = Awaited<ReturnType<typeof fetchOpportunitiesFeed>>[number];

const NOTICE_TYPE_VARIANT: Record<string, "accent" | "gold" | "warning" | "default"> = {
  EOI: "accent", RFQ: "gold", RFP: "warning", RFI: "default",
};

function decodeHtml(s: string) {
  return s.replace(/&#038;/g, "&").replace(/&#8211;/g, "\u2013").replace(/&#8217;/g, "\u2019").replace(/\s*[\u2013\-]\s*Local Content Register$/i, "");
}


export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("starter");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchOpportunitiesFeed({ status: statusFilter || undefined, type: typeFilter || undefined }),
      fetchSavedOpportunities(),
      fetchPlanAndUsage(),
    ])
      .then(([opps, saved, planData]) => {
        setOpportunities(opps);
        setSavedIds(new Set(saved.map((s) => s.opportunityId)));
        setPlan(planData.plan);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [typeFilter, statusFilter]);

  const handleSave = async (oppId: string) => {
    try {
      await saveOpportunity(oppId);
      setSavedIds((prev) => new Set([...prev, oppId]));
      toast.success("Opportunity saved");
    } catch { toast.error("Failed to save"); }
  };

  const handleUnsave = async (oppId: string) => {
    try {
      await unsaveOpportunity(oppId);
      setSavedIds((prev) => { const next = new Set(prev); next.delete(oppId); return next; });
      toast.success("Removed from saved");
    } catch { toast.error("Failed to remove"); }
  };

  const filtered = opportunities.filter((o) => {
    if (showSavedOnly && !savedIds.has(o.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      const aiText = o.aiSummary || "";
      return (
        o.title.toLowerCase().includes(q) ||
        o.contractorName.toLowerCase().includes(q) ||
        (o.lcaCategory || "").toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q) ||
        aiText.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const isPro = plan === "pro" || plan === "enterprise";
  const supplierCount = opportunities.filter((o) => o.type === "supplier").length;
  const activeCount = opportunities.filter((o) => o.status === "active").length;

  if (loading) {
    return (
      <>
        <TopBar title="Opportunities" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <div>
      <TopBar title="Opportunities" description="Procurement and employment notices from the LCS Register" />
      <div className="p-4 sm:p-8 max-w-6xl">
        {/* Stats */}
        {/* Analytics link */}
        <div className="flex justify-end mb-4">
          <Link href="/dashboard/opportunities/analytics">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Market Intelligence
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-text-muted">Total Notices</p>
            <p className="text-2xl font-bold">{opportunities.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Active</p>
            <p className="text-2xl font-bold text-success">{activeCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Procurement</p>
            <p className="text-2xl font-bold text-accent">{supplierCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Saved</p>
            <p className="text-2xl font-bold text-gold">{savedIds.size}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Filter className="h-4 w-4" /> Filters:
          </div>
          <Select
            id="type-filter" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "", label: "All Types" },
              { value: "supplier", label: "Procurement" },
              { value: "employment", label: "Employment" },
            ]}
          />
          <Select
            id="status-filter" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "expired", label: "Expired" },
            ]}
          />
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text" placeholder="Search notices, companies, scope..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <Button
            variant={showSavedOnly ? "primary" : "outline"} size="sm"
            onClick={() => setShowSavedOnly(!showSavedOnly)}
          >
            <BookmarkCheck className="h-4 w-4 mr-1" /> Saved ({savedIds.size})
          </Button>
        </div>

        {/* Upgrade banner */}
        {!isPro && (
          <div className="rounded-lg border border-accent/20 bg-accent-light p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-accent" />
              <div>
                <p className="font-medium text-text-primary text-sm">Unlock AI summaries and bookmarks</p>
                <p className="text-xs text-text-secondary">Upgrade to Pro for structured opportunity analysis.</p>
              </div>
            </div>
            <a href="/dashboard/settings/billing">
              <Button size="sm"><Sparkles className="h-4 w-4 mr-1" />Upgrade</Button>
            </a>
          </div>
        )}

        {/* Cards */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={showSavedOnly ? "No saved opportunities" : "No opportunities found"}
            description={showSavedOnly ? "Save opportunities from the feed to track them here." : "Try adjusting your filters."}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((opp) => {
              const isSaved = savedIds.has(opp.id);
              const isExpired = opp.status === "expired";
              const isExpanded = expandedId === opp.id;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let parsedSummary: any = null;
              try { if (opp.aiSummary) parsedSummary = JSON.parse(opp.aiSummary); } catch {}

              return (
                <Card key={opp.id} className={cn("transition-colors", isExpired && "opacity-60", isExpanded && "border-accent/30")}>
                  <CardContent className="p-0">
                    {/* Collapsed header */}
                    <div
                      className="p-4 sm:p-5 cursor-pointer hover:bg-bg-primary/30 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {opp.noticeType && (
                              <Badge variant={NOTICE_TYPE_VARIANT[opp.noticeType] || "default"}>{opp.noticeType}</Badge>
                            )}
                            {parsedSummary?.opportunity_type && !opp.noticeType && (
                              <Badge variant={NOTICE_TYPE_VARIANT[parsedSummary.opportunity_type] || "default"}>
                                {parsedSummary.opportunity_type}
                              </Badge>
                            )}
                            <Badge variant={opp.type === "supplier" ? "accent" : "gold"}>
                              {opp.type === "supplier" ? "Procurement" : "Employment"}
                            </Badge>
                            <Badge variant={isExpired ? "default" : "success"}>
                              {isExpired ? "Expired" : "Active"}
                            </Badge>
                            {opp.attachmentUrl && (
                              <FileText className="h-3.5 w-3.5 text-text-muted" />
                            )}
                            {parsedSummary && (
                              <Sparkles className="h-3.5 w-3.5 text-accent" />
                            )}
                          </div>

                          <h3 className="font-semibold text-text-primary text-sm sm:text-base line-clamp-2">
                            {decodeHtml(opp.title)}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <CompanyLogo companyName={opp.contractorName} size={20} />
                            <p className="text-sm text-text-secondary">{opp.contractorName}</p>
                          </div>

                          {/* Quick summary from AI */}
                          {parsedSummary?.scope_of_work && !isExpanded && (
                            <p className="text-xs text-text-muted mt-1 line-clamp-1">
                              {parsedSummary.scope_of_work}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-muted">
                            {opp.lcaCategory && (
                              <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{opp.lcaCategory}</span>
                            )}
                            {opp.postedDate && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Posted: {opp.postedDate}</span>
                            )}
                            {opp.deadline && (
                              <span className={cn("flex items-center gap-1", isExpired ? "text-danger" : "text-warning")}>
                                <Clock className="h-3 w-3" />Deadline: {opp.deadline}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPro && (
                            <Button
                              variant={isSaved ? "primary" : "outline"} size="sm"
                              onClick={(e) => { e.stopPropagation(); isSaved ? handleUnsave(opp.id) : handleSave(opp.id); }}
                            >
                              {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                            </Button>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded view */}
                    {isExpanded && (
                      <div className="border-t border-border-light px-4 sm:px-5 pb-5 pt-4 space-y-5">
                        {/* AI Summary */}
                        {parsedSummary && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Sparkles className="h-4 w-4 text-accent" />
                              <h3 className="text-sm font-semibold text-text-primary">AI Summary</h3>
                            </div>
                            <AiSummaryPanel summary={parsedSummary} />
                          </div>
                        )}

                        {/* Description */}
                        {opp.description && !parsedSummary && (
                          <div>
                            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Description</h4>
                            <p className="text-sm text-text-secondary">{opp.description}</p>
                          </div>
                        )}

                        {/* PDF Viewer */}
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

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border-light">
                          <div className="flex gap-2">
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
                          {isPro && (
                            <Button
                              variant={isSaved ? "secondary" : "primary"} size="sm"
                              onClick={() => isSaved ? handleUnsave(opp.id) : handleSave(opp.id)}
                            >
                              {isSaved ? "Unsave" : "Save Opportunity"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
