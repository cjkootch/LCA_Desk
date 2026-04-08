"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Search, Send, Pin, Calendar, Building2 } from "lucide-react";
import { fetchSupplierOpportunities, respondToOpportunity, fetchMySupplierProfile } from "@/server/actions";
import { decodeHtml } from "@/lib/utils/decode-html";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Opportunity = Awaited<ReturnType<typeof fetchSupplierOpportunities>>[number];

export default function SupplierOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [respondingTo, setRespondingTo] = useState<Opportunity | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    Promise.all([fetchSupplierOpportunities(), fetchMySupplierProfile()])
      .then(([opps, prof]) => { setOpportunities(opps); setProfile(prof); setContactEmail(prof?.contactEmail || ""); })
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async () => {
    if (!respondingTo) return;
    setSubmitting(true);
    try {
      await respondToOpportunity(respondingTo.id, { coverNote, contactEmail });
      toast.success("Response submitted — the contractor will see your interest.");
      setRespondingTo(null);
      setCoverNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to respond");
    }
    setSubmitting(false);
  };

  const filtered = opportunities.filter(o => {
    if (typeFilter !== "all" && o.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.title.toLowerCase().includes(q) || o.company.toLowerCase().includes(q);
    }
    return true;
  });

  const types = [...new Set(opportunities.map(o => o.type).filter(Boolean))];

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-xl font-heading font-bold text-text-primary mb-1">Opportunities</h1>
      <p className="text-sm text-text-secondary mb-6">Browse procurement notices and express interest</p>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input placeholder="Search opportunities..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} options={[
          { value: "all", label: "All Types" },
          ...types.map(t => ({ value: t!, label: t! })),
        ]} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="No opportunities found" description="Try adjusting your search or check back later." />
      ) : (
        <div className="space-y-3">
          {filtered.map(opp => (
            <Card key={opp.id} className={cn(opp.pinned && "border-gold/30")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {opp.pinned && <Pin className="h-3 w-3 text-gold shrink-0" />}
                      <h3 className="text-sm font-semibold text-text-primary">{decodeHtml(opp.title)}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{opp.company}</span>
                      {opp.type && <Badge variant="default" className="text-[9px]">{opp.type}</Badge>}
                      {opp.category && <Badge variant="accent" className="text-[9px]">{opp.category}</Badge>}
                    </div>
                    {opp.deadline && (
                      <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Deadline: {opp.deadline}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setRespondingTo(opp); setCoverNote(""); }}>
                    <Send className="h-3 w-3 mr-1" /> Respond
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Response dialog */}
      <Dialog open={!!respondingTo} onOpenChange={open => { if (!open) setRespondingTo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Express Interest</DialogTitle>
          </DialogHeader>
          {respondingTo && (
            <div className="space-y-4 mt-2">
              <div className="bg-bg-primary rounded-lg p-3">
                <p className="text-sm font-medium text-text-primary">{decodeHtml(respondingTo.title)}</p>
                <p className="text-xs text-text-muted">{respondingTo.company}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Contact Email</label>
                <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="your@email.com" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Cover Note (optional)</label>
                <textarea className="w-full h-20 mt-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={coverNote} onChange={e => setCoverNote(e.target.value)}
                  placeholder="Briefly describe your relevant experience and capabilities..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRespondingTo(null)}>Cancel</Button>
                <Button onClick={handleRespond} loading={submitting}><Send className="h-3 w-3 mr-1" /> Submit Response</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
