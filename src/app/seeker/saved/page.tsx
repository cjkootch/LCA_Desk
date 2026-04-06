"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bookmark, ExternalLink, Trash2, Calendar, Building2 } from "lucide-react";
import { fetchMySavedOpportunities, seekerUnsaveOpportunity } from "@/server/actions";
import { toast } from "sonner";

export default function SeekerSavedPage() {
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof fetchMySavedOpportunities>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMySavedOpportunities()
      .then(setSaved)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUnsave = async (opportunityId: string) => {
    try {
      await seekerUnsaveOpportunity(opportunityId);
      setSaved((prev) => prev.filter((s) => s.opportunityId !== opportunityId));
      toast.success("Removed from saved");
    } catch {
      toast.error("Failed to remove");
    }
  };

  return (
    <>
      <SeekerTopBar title="Saved Items" description={`${saved.length} saved opportunit${saved.length !== 1 ? "ies" : "y"}`} />

      <div className="p-4 sm:p-8 max-w-5xl space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : saved.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No saved items"
            description="Save jobs and opportunities to review them later."
            actionLabel="Browse Opportunities"
            onAction={() => window.location.href = "/seeker/opportunities"}
          />
        ) : (
          <div className="space-y-3">
            {saved.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-text-primary line-clamp-2">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Building2 className="h-3 w-3 text-text-muted" />
                        <span className="text-xs text-text-secondary">{item.contractorName}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant={item.type === "employment" ? "accent" : "warning"} className="text-[10px]">
                          {item.type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        {item.deadline && (
                          <span className="flex items-center gap-1 text-[11px] text-text-muted">
                            <Calendar className="h-3 w-3" /> Due {new Date(item.deadline).toLocaleDateString()}
                          </span>
                        )}
                        {item.savedAt && (
                          <span className="text-[11px] text-text-muted">
                            Saved {new Date(item.savedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-bg-primary transition-colors"
                          title="View original"
                        >
                          <ExternalLink className="h-4 w-4 text-text-muted" />
                        </a>
                      )}
                      <button
                        onClick={() => handleUnsave(item.opportunityId)}
                        className="p-2 rounded-lg hover:bg-danger-light transition-colors"
                        title="Remove"
                      >
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
