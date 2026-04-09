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

import { decodeHtml } from "@/lib/utils/decode-html";


export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("lite");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contractorFilter, setContractorFilter] = useState("");
  const [noticeTypeFilter, setNoticeTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "deadline" | "company">("newest");
  const [hasAiOnly, setHasAiOnly] = useState(false);

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

  // Extract unique contractors and notice types for filter dropdowns
  const uniqueContractors = [...new Set(opportunities.map(o => o.contractorName))].sort();
  const uniqueNoticeTypes = [...new Set(opportunities.map(o => o.noticeType).filter((t): t is string => !!t))].sort();

  const filtered = opportunities
    .filter((o) => {
      if (showSavedOnly && !savedIds.has(o.id)) return false;
      if (contractorFilter && o.contractorName !== contractorFilter) return false;
      if (noticeTypeFilter && o.noticeType !== noticeTypeFilter) return false;
      if (hasAiOnly && !o.aiSummary) return false;
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
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.postedDate || b.scrapedAt || 0).getTime() - new Date(a.postedDate || a.scrapedAt || 0).getTime();
        case "oldest": return new Date(a.postedDate || a.scrapedAt || 0).getTime() - new Date(b.postedDate || b.scrapedAt || 0).getTime();
        case "deadline": {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        case "company": return a.contractorName.localeCompare(b.contractorName);
        default: return 0;
      }
    });

  const isPro = plan === "pro" || plan === "enterprise";
  const supplierCount = opportunities.filter((o) => o.type === "supplier").length;
  const activeCount = opportunities.filter((o) => o.status === "active").length;
  const activeFilters = [contractorFilter, noticeTypeFilter, hasAiOnly, showSavedOnly].filter(Boolean).length;

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

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text" placeholder="Search notices, companies, scope, requirements..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Filters + Sort */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
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
          <select
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
          >
            <option value="">All Companies</option>
            {uniqueContractors.filter(c => c !== "Unknown").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="Unknown">Unknown</option>
          </select>
          <select
            value={noticeTypeFilter}
            onChange={(e) => setNoticeTypeFilter(e.target.value)}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
          >
            <option value="">All Notice Types</option>
            {uniqueNoticeTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="deadline">Deadline (Soonest)</option>
            <option value="company">Company A-Z</option>
          </select>
        </div>

        {/* Quick filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Button
            variant={showSavedOnly ? "primary" : "outline"} size="sm"
            onClick={() => setShowSavedOnly(!showSavedOnly)}
          >
            <BookmarkCheck className="h-3.5 w-3.5 mr-1" /> Saved ({savedIds.size})
          </Button>
          <Button
            variant={hasAiOnly ? "primary" : "outline"} size="sm"
            onClick={() => setHasAiOnly(!hasAiOnly)}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" /> AI Analyzed
          </Button>
          {activeFilters > 0 && (
            <Button
              variant="ghost" size="sm"
              onClick={() => { setContractorFilter(""); setNoticeTypeFilter(""); setHasAiOnly(false); setShowSavedOnly(false); setSearch(""); }}
              className="text-text-muted"
            >
              Clear filters ({activeFilters})
            </Button>
          )}
          <span className="text-xs text-text-muted ml-auto">
            {filtered.length} of {opportunities.length} shown
          </span>
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
              // Use AI-extracted company name if DB has "Unknown"
              const displayName = opp.contractorName === "Unknown" && parsedSummary?.issuing_company
                ? parsedSummary.issuing_company : opp.contractorName;

              const deadlineDate = opp.deadline ? new Date(opp.deadline) : null;
              const daysUntilDeadline = deadlineDate ? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const isClosingSoon = daysUntilDeadline !== null && daysUntilDeadline > 0 && daysUntilDeadline <= 7;

              return (
                <Card key={opp.id} className={cn(
                  "transition-colors",
                  isExpired && "border-border-light bg-bg-primary/50",
                  isExpanded && "border-accent/30",
                  isClosingSoon && !isExpired && "border-warning/30",
                )}>
                  <CardContent className="p-0">
                    {/* Collapsed header */}
                    <div
                      className={cn("p-4 sm:p-5 cursor-pointer hover:bg-bg-primary/30 transition-colors", isExpired && "opacity-60")}
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
                            {isExpired ? (
                              <Badge variant="default" className="line-through">Closed</Badge>
                            ) : isClosingSoon ? (
                              <Badge variant="danger">Closing Soon</Badge>
                            ) : (
                              <Badge variant="success">Active</Badge>
                            )}
                            {opp.attachmentUrl && (
                              <FileText className="h-3.5 w-3.5 text-text-muted" />
                            )}
                            {parsedSummary && (
                              <Sparkles className="h-3.5 w-3.5 text-accent" />
                            )}
                          </div>

                          <h3 className={cn("font-semibold text-sm sm:text-base line-clamp-2", isExpired ? "text-text-muted" : "text-text-primary")}>
                            {decodeHtml(opp.title)}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <CompanyLogo companyName={displayName} size={20} />
                            <p className="text-sm text-text-secondary">{displayName}</p>
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
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Posted: {new Date(opp.postedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            )}
                          </div>
                        </div>

                        {/* Right side: closing date + actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {opp.deadline && (
                            <div className={cn(
                              "text-right px-3 py-1.5 rounded-lg",
                              isExpired ? "bg-bg-primary" : isClosingSoon ? "bg-danger-light" : "bg-warning-light"
                            )}>
                              <p className="text-xs text-text-muted uppercase tracking-wider">
                                {isExpired ? "Closed" : "Closes"}
                              </p>
                              <p className={cn(
                                "text-sm font-semibold",
                                isExpired ? "text-text-muted line-through" : isClosingSoon ? "text-danger" : "text-warning"
                              )}>
                                {new Date(opp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                              {!isExpired && daysUntilDeadline !== null && (
                                <p className={cn("text-xs font-medium", isClosingSoon ? "text-danger" : "text-text-muted")}>
                                  {daysUntilDeadline} day{daysUntilDeadline !== 1 ? "s" : ""} left
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
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
