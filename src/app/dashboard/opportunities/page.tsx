"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FeatureGate } from "@/components/billing/FeatureGate";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Filter,
  Megaphone,
  FileText,
  Users,
  Clock,
  Search,
} from "lucide-react";
import {
  fetchOpportunitiesFeed,
  fetchSavedOpportunities,
  saveOpportunity,
  unsaveOpportunity,
  fetchPlanAndUsage,
} from "@/server/actions";

type Opportunity = Awaited<ReturnType<typeof fetchOpportunitiesFeed>>[number];

const NOTICE_TYPE_VARIANT: Record<string, "accent" | "gold" | "warning" | "default"> = {
  EOI: "accent",
  RFQ: "gold",
  RFP: "warning",
  RFI: "default",
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("starter");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);

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
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleUnsave = async (oppId: string) => {
    try {
      await unsaveOpportunity(oppId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(oppId);
        return next;
      });
      toast.success("Removed from saved");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const filtered = opportunities.filter((o) => {
    if (showSavedOnly && !savedIds.has(o.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.title.toLowerCase().includes(q) ||
        o.contractorName.toLowerCase().includes(q) ||
        (o.lcaCategory || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const supplierCount = opportunities.filter((o) => o.type === "supplier").length;
  const employmentCount = opportunities.filter((o) => o.type === "employment").length;
  const activeCount = opportunities.filter((o) => o.status === "active").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Opportunities" description="Procurement and employment notices from the LCS Register" />
      <div className="p-4 sm:p-8">
        <PageHeader
          title="LCS Opportunities Board"
          description="Browse procurement and employment opportunities posted by contractors operating in Guyana's petroleum sector."
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-sm text-text-muted">Total Notices</p>
            <p className="text-2xl font-bold">{opportunities.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-text-muted">Active</p>
            <p className="text-2xl font-bold text-success">{activeCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-text-muted">Procurement</p>
            <p className="text-2xl font-bold text-accent">{supplierCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-text-muted">Saved</p>
            <p className="text-2xl font-bold text-gold">{savedIds.size}</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Filter className="h-4 w-4" />
            Filters:
          </div>
          <Select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: "", label: "All Types" },
              { value: "supplier", label: "Procurement" },
              { value: "employment", label: "Employment" },
            ]}
          />
          <Select
            id="status-filter"
            value={statusFilter}
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
              type="text"
              placeholder="Search notices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <Button
            variant={showSavedOnly ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowSavedOnly(!showSavedOnly)}
          >
            <BookmarkCheck className="h-4 w-4 mr-1" />
            Saved ({savedIds.size})
          </Button>
        </div>

        {/* Opportunity cards */}
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

              return (
                <Card
                  key={opp.id}
                  className={cn("hover:border-accent/20 transition-colors", isExpired && "opacity-60")}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {opp.noticeType && (
                            <Badge variant={NOTICE_TYPE_VARIANT[opp.noticeType] || "default"}>
                              {opp.noticeType}
                            </Badge>
                          )}
                          <Badge variant={opp.type === "supplier" ? "accent" : "gold"}>
                            {opp.type === "supplier" ? "Procurement" : "Employment"}
                          </Badge>
                          <Badge variant={isExpired ? "default" : "success"}>
                            {isExpired ? "Expired" : "Active"}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-text-primary text-sm sm:text-base line-clamp-2">
                          {opp.title.replace(/&#038;/g, "&").replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/\s*–\s*Local Content Register$/i, "")}
                        </h3>
                        <p className="text-sm text-text-secondary mt-1">{opp.contractorName}</p>

                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-muted">
                          {opp.lcaCategory && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {opp.lcaCategory}
                            </span>
                          )}
                          {opp.postedDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Posted: {opp.postedDate}
                            </span>
                          )}
                          {opp.deadline && (
                            <span className={cn("flex items-center gap-1", isExpired ? "text-danger" : "text-warning")}>
                              <Clock className="h-3 w-3" />
                              Deadline: {opp.deadline}
                            </span>
                          )}
                        </div>

                        {opp.description && (
                          <p className="text-sm text-text-secondary mt-2 line-clamp-2">
                            {opp.description.slice(0, 200)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <FeatureGate planRequired="pro" featureName="Save Opportunities" currentPlan={plan}>
                          <Button
                            variant={isSaved ? "primary" : "outline"}
                            size="sm"
                            onClick={() => isSaved ? handleUnsave(opp.id) : handleSave(opp.id)}
                          >
                            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          </Button>
                        </FeatureGate>
                        {opp.sourceUrl && (
                          <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
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
