"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3, Briefcase, Users, TrendingUp, Pin, PinOff,
  MessageSquare, FileText, Eye, Save, UserCheck, X, ArrowRight, Filter,
} from "lucide-react";
import { fetchSecretariatMarketIntel, moderateOpportunity, moderateEmploymentNotice } from "@/server/actions";
import { decodeHtml } from "@/lib/utils/decode-html";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type IntelData = Awaited<ReturnType<typeof fetchSecretariatMarketIntel>>;

export default function MarketIntelPage() {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "opportunities" | "jobs" | "seekers">("overview");
  const [noteEdit, setNoteEdit] = useState<{ id: string; type: "opp" | "job"; note: string } | null>(null);
  // Drill-down filters
  const [companyFilter, setCompanyFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const drillTo = (t: typeof tab, filters?: { company?: string; month?: string; category?: string }) => {
    setTab(t);
    setCompanyFilter(filters?.company || "");
    setMonthFilter(filters?.month || "");
    setCategoryFilter(filters?.category || "");
  };

  const clearFilters = () => { setCompanyFilter(""); setMonthFilter(""); setCategoryFilter(""); };

  useEffect(() => {
    fetchSecretariatMarketIntel()
      .then(setData)
      .catch(err => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const handlePin = async (id: string, type: "opp" | "job", currentPinned: boolean) => {
    try {
      if (type === "opp") await moderateOpportunity(id, { pinned: !currentPinned });
      else await moderateEmploymentNotice(id, { pinned: !currentPinned });
      toast.success(currentPinned ? "Unpinned" : "Pinned");
      const fresh = await fetchSecretariatMarketIntel();
      setData(fresh);
    } catch { toast.error("Failed to update"); }
  };

  const handleStatusChange = async (id: string, type: "opp" | "job", newStatus: string) => {
    try {
      if (type === "opp") await moderateOpportunity(id, { status: newStatus });
      else await moderateEmploymentNotice(id, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      const fresh = await fetchSecretariatMarketIntel();
      setData(fresh);
    } catch { toast.error("Failed to update"); }
  };

  const handleNoteSave = async () => {
    if (!noteEdit) return;
    try {
      if (noteEdit.type === "opp") await moderateOpportunity(noteEdit.id, { note: noteEdit.note });
      else await moderateEmploymentNotice(noteEdit.id, { note: noteEdit.note });
      toast.success("Note saved");
      setNoteEdit(null);
      const fresh = await fetchSecretariatMarketIntel();
      setData(fresh);
    } catch { toast.error("Failed to save note"); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;
  if (!data) return <div className="p-8 text-center text-text-muted">Unable to load market data.</div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Market Intelligence</h1>
          <p className="text-sm text-text-secondary">Opportunities, employment notices, and workforce analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {(["overview", "opportunities", "jobs", "seekers"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              tab === t ? "bg-[#1e293b] text-white" : "text-text-muted hover:text-text-primary hover:bg-bg-primary"
            )}>
            {t === "overview" ? "Overview" : t === "opportunities" ? "Opportunities" : t === "jobs" ? "Employment Notices" : "Job Seekers"}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Top-level stats — clickable to drill into tabs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 text-center cursor-pointer hover:border-gold/40 transition-colors group" onClick={() => drillTo("opportunities")}>
              <Briefcase className="h-5 w-5 text-gold mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.opportunities.total}</p>
              <p className="text-xs text-text-muted">Procurement Notices</p>
              <p className="text-xs text-success">{data.opportunities.active} active</p>
              <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">View all <ArrowRight className="h-3 w-3" /></p>
            </Card>
            <Card className="p-4 text-center cursor-pointer hover:border-accent/40 transition-colors group" onClick={() => drillTo("jobs")}>
              <FileText className="h-5 w-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.jobs.total}</p>
              <p className="text-xs text-text-muted">Employment Notices</p>
              <p className="text-xs text-success">{data.jobs.open} open</p>
              <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">View all <ArrowRight className="h-3 w-3" /></p>
            </Card>
            <Card className="p-4 text-center cursor-pointer hover:border-success/40 transition-colors group" onClick={() => drillTo("seekers")}>
              <Users className="h-5 w-5 text-success mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.seekers.total}</p>
              <p className="text-xs text-text-muted">Registered Job Seekers</p>
              <p className="text-xs text-accent">{data.seekers.inTalentPool} in talent pool</p>
              <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">View all <ArrowRight className="h-3 w-3" /></p>
            </Card>
            <Card className="p-4 text-center cursor-pointer hover:border-warning/40 transition-colors group" onClick={() => drillTo("seekers")}>
              <UserCheck className="h-5 w-5 text-warning mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.applications.total}</p>
              <p className="text-xs text-text-muted">Job Applications</p>
              <p className="text-xs text-success">{data.applications.guyanese} Guyanese ({data.applications.total > 0 ? Math.round((data.applications.guyanese / data.applications.total) * 100) : 0}%)</p>
              <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">View all <ArrowRight className="h-3 w-3" /></p>
            </Card>
          </div>

          {/* Posting trend */}
          <Card><CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-text-primary">Posting Volume by Month</p>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gold/80" /> Opportunities</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent/80" /> Employment</span>
              </div>
            </div>
            {(() => {
              const months = data.opportunities.byMonth.slice(-12);
              const allMonths = new Set([...months.map(([m]) => m), ...data.jobs.byMonth.map(([m]) => m)]);
              const sortedMonths = [...allMonths].sort();
              const maxVal = Math.max(
                ...months.map(([, c]) => c),
                ...data.jobs.byMonth.map(([, c]) => c),
                1
              );
              if (sortedMonths.length === 0) return <p className="text-sm text-text-muted py-8 text-center">No posting data yet</p>;
              return (
                <div className="space-y-3">
                  {sortedMonths.slice(-12).map(month => {
                    const oppCount = months.find(([m]) => m === month)?.[1] || 0;
                    const jobCount = data.jobs.byMonth.find(([m]) => m === month)?.[1] || 0;
                    const oppPct = (oppCount / maxVal) * 100;
                    const jobPct = (jobCount / maxVal) * 100;
                    const label = new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" });
                    return (
                      <div key={month} className="flex items-center gap-3 cursor-pointer hover:bg-bg-primary/50 rounded-lg px-1 -mx-1 py-0.5 transition-colors"
                        onClick={() => drillTo("opportunities", { month })} title={`Filter by ${label}`}>
                        <span className="text-xs text-text-muted w-20 shrink-0 text-right">{label}</span>
                        <div className="flex-1 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="h-5 rounded bg-gold/80 transition-all" style={{ width: `${Math.max(oppPct, 2)}%` }} />
                            <span className="text-xs font-semibold text-text-primary">{oppCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 rounded bg-accent/80 transition-all" style={{ width: `${Math.max(jobPct, 2)}%` }} />
                            <span className="text-xs font-semibold text-text-primary">{jobCount}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent></Card>

          {/* Top companies + engagement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="p-5">
              <p className="text-sm font-semibold text-text-primary mb-4">Top Companies (Opportunities)</p>
              <div className="space-y-2.5">
                {data.opportunities.topCompanies.slice(0, 8).map(([company, count]) => {
                  const maxC = data.opportunities.topCompanies[0]?.[1] || 1;
                  const pct = (count / maxC) * 100;
                  return (
                    <div key={company} className="cursor-pointer hover:bg-bg-primary/50 rounded-lg px-2 -mx-2 py-1 transition-colors"
                      onClick={() => drillTo("opportunities", { company })} title={`Filter by ${company}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-primary truncate mr-2">{company}</span>
                        <span className="text-sm font-bold text-text-primary shrink-0">{count}</span>
                      </div>
                      <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gold/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-5">
              <p className="text-sm font-semibold text-text-primary mb-4">Most Saved by Filers</p>
              {data.opportunities.mostSaved.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Save className="h-8 w-8 text-text-muted/30 mb-2" />
                  <p className="text-sm text-text-muted">No saves yet</p>
                  <p className="text-xs text-text-muted mt-1">When filers save opportunities, the most popular ones will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.opportunities.mostSaved.slice(0, 8).map((item) => {
                    const maxS = data.opportunities.mostSaved[0]?.saves || 1;
                    const pct = (item.saves / maxS) * 100;
                    return (
                      <div key={item.id} className="cursor-pointer hover:bg-bg-primary/50 rounded-lg px-2 -mx-2 py-1 transition-colors"
                        onClick={() => drillTo("opportunities", { company: item.company })}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary font-medium truncate">{decodeHtml(item.title).slice(0, 50)}</p>
                            <p className="text-xs text-text-muted">{item.company}</p>
                          </div>
                          <div className="flex items-center gap-1 text-accent shrink-0">
                            <Save className="h-3.5 w-3.5" />
                            <span className="text-sm font-bold">{item.saves}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-accent/50 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent></Card>
          </div>

          {/* Job seeker breakdown + applications */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Seekers by Category</p>
              <div className="space-y-1.5">
                {Object.entries(data.seekers.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs cursor-pointer hover:bg-bg-primary/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                    onClick={() => drillTo("seekers", { category: cat })}>
                    <span className="text-text-secondary">{cat}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(data.seekers.byCategory).length === 0 && <p className="text-xs text-text-muted text-center py-2">No data yet</p>}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Seekers by Education</p>
              <div className="space-y-1.5">
                {Object.entries(data.seekers.byEducation).sort((a, b) => b[1] - a[1]).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{level}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(data.seekers.byEducation).length === 0 && <p className="text-xs text-text-muted text-center py-2">No data yet</p>}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Workforce Snapshot</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">Total Seekers</span><span className="font-bold">{data.seekers.total}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Guyanese</span><span className="font-bold text-success">{data.seekers.guyanese} ({data.seekers.total > 0 ? Math.round((data.seekers.guyanese / data.seekers.total) * 100) : 0}%)</span></div>
                <div className="flex justify-between"><span className="text-text-muted">In Talent Pool</span><span className="font-bold text-accent">{data.seekers.inTalentPool}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Avg Experience</span><span className="font-bold">{data.seekers.avgExperience} yrs</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Applications</span><span className="font-bold">{data.applications.total}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Hired</span><span className="font-bold text-success">{data.applications.byStatus["hired"] || 0}</span></div>
              </div>
            </CardContent></Card>
          </div>
        </div>
      )}

      {/* ── Opportunities Tab (moderation) ── */}
      {tab === "opportunities" && (() => {
        const filtered = data.recentOpportunities.filter(opp => {
          if (companyFilter && opp.company !== companyFilter) return false;
          if (monthFilter && opp.postedDate && !opp.postedDate.startsWith(monthFilter)) return false;
          return true;
        });
        return (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary">{filtered.length} Procurement Notices{(companyFilter || monthFilter) ? " (filtered)" : ""}</p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="text-success">{data.opportunities.active} active</span>
              <span>·</span>
              <span>{data.opportunities.pinned} pinned</span>
              <span>·</span>
              <span>{data.opportunities.totalSaves} total saves</span>
            </div>
          </div>

          {(companyFilter || monthFilter) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-text-muted" />
              {companyFilter && (
                <Badge variant="accent" className="text-xs flex items-center gap-1 cursor-pointer" onClick={() => setCompanyFilter("")}>
                  {companyFilter} <X className="h-3 w-3" />
                </Badge>
              )}
              {monthFilter && (
                <Badge variant="accent" className="text-xs flex items-center gap-1 cursor-pointer" onClick={() => setMonthFilter("")}>
                  {new Date(monthFilter + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })} <X className="h-3 w-3" />
                </Badge>
              )}
              <button onClick={clearFilters} className="text-xs text-accent hover:underline">Clear all</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-text-muted">No opportunities match the current filter.</CardContent></Card>
          ) : filtered.map(opp => (
            <Card key={opp.id} className={cn(opp.pinned && "border-gold/30 bg-gold/5")}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {opp.pinned && <Pin className="h-3 w-3 text-gold shrink-0" />}
                      <h3 className="text-sm font-semibold text-text-primary truncate">{decodeHtml(opp.title)}</h3>
                    </div>
                    <p className="text-xs text-text-muted">{opp.company} · {opp.type} · {opp.postedDate}</p>
                    {opp.deadline && <p className="text-xs text-text-muted">Deadline: {opp.deadline}</p>}
                    {opp.note && <p className="text-xs text-warning mt-1 italic">Note: {opp.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opp.saves > 0 && <Badge variant="accent" className="text-xs"><Save className="h-2.5 w-2.5 mr-0.5" />{opp.saves}</Badge>}
                    <Badge variant={opp.status === "active" ? "success" : opp.status === "closed" ? "default" : "warning"} className="text-xs">{opp.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 border-t border-border pt-2">
                  <button onClick={() => handlePin(opp.id, "opp", !!opp.pinned)}
                    className="text-xs text-text-muted hover:text-gold flex items-center gap-1">
                    {opp.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {opp.pinned ? "Unpin" : "Pin"}
                  </button>
                  {opp.status === "active" && (
                    <button onClick={() => handleStatusChange(opp.id, "opp", "closed")}
                      className="text-xs text-text-muted hover:text-danger flex items-center gap-1">
                      Mark Closed
                    </button>
                  )}
                  {opp.status === "closed" && (
                    <button onClick={() => handleStatusChange(opp.id, "opp", "active")}
                      className="text-xs text-text-muted hover:text-success flex items-center gap-1">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => setNoteEdit({ id: opp.id, type: "opp", note: opp.note || "" })}
                    className="text-xs text-text-muted hover:text-accent flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {opp.note ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ); })()}

      {/* ── Employment Notices Tab (moderation) ── */}
      {tab === "jobs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary">{data.jobs.total} Employment Notices</p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="text-success">{data.jobs.open} open</span>
              <span>·</span>
              <span>{data.jobs.pinned} pinned</span>
            </div>
          </div>

          {data.recentJobs.map(job => (
            <Card key={job.id} className={cn(job.pinned && "border-gold/30 bg-gold/5")}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {job.pinned && <Pin className="h-3 w-3 text-gold shrink-0" />}
                      <h3 className="text-sm font-semibold text-text-primary truncate">{decodeHtml(job.title)}</h3>
                    </div>
                    <p className="text-xs text-text-muted">{job.company} · {job.category || "Uncategorized"} · {job.postedDate}</p>
                    {job.closingDate && <p className="text-xs text-text-muted">Closing: {job.closingDate}</p>}
                    {job.note && <p className="text-xs text-warning mt-1 italic">Note: {job.note}</p>}
                  </div>
                  <Badge variant={job.status === "open" ? "success" : "default"} className="text-xs shrink-0">{job.status}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 border-t border-border pt-2">
                  <button onClick={() => handlePin(job.id, "job", !!job.pinned)}
                    className="text-xs text-text-muted hover:text-gold flex items-center gap-1">
                    {job.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {job.pinned ? "Unpin" : "Pin"}
                  </button>
                  {job.status === "open" && (
                    <button onClick={() => handleStatusChange(job.id, "job", "closed")}
                      className="text-xs text-text-muted hover:text-danger flex items-center gap-1">
                      Mark Closed
                    </button>
                  )}
                  {job.status === "closed" && (
                    <button onClick={() => handleStatusChange(job.id, "job", "open")}
                      className="text-xs text-text-muted hover:text-success flex items-center gap-1">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => setNoteEdit({ id: job.id, type: "job", note: job.note || "" })}
                    className="text-xs text-text-muted hover:text-accent flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {job.note ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Job Seekers Tab ── */}
      {tab === "seekers" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{data.seekers.total}</p>
              <p className="text-xs text-text-muted">Total Registered</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{data.seekers.guyanese}</p>
              <p className="text-xs text-text-muted">Guyanese Nationals</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-accent">{data.seekers.inTalentPool}</p>
              <p className="text-xs text-text-muted">In Talent Pool</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{data.seekers.avgExperience} yrs</p>
              <p className="text-xs text-text-muted">Avg Experience</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Workforce by Employment Category</p>
                {categoryFilter && (
                  <Badge variant="accent" className="text-xs flex items-center gap-1 cursor-pointer" onClick={() => setCategoryFilter("")}>
                    {categoryFilter} <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              {Object.entries(data.seekers.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const pct = data.seekers.total > 0 ? Math.round((count / data.seekers.total) * 100) : 0;
                return (
                  <div key={cat} className={cn("flex items-center gap-3 mb-2 cursor-pointer rounded-lg px-1 -mx-1 py-0.5 transition-colors hover:bg-bg-primary/50",
                    categoryFilter === cat && "bg-accent/5 ring-1 ring-accent/20"
                  )} onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}>
                    <span className="text-xs text-text-secondary w-32 truncate">{cat}</span>
                    <div className="flex-1 h-4 bg-bg-primary rounded-full overflow-hidden">
                      <div className="h-full bg-accent/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">{count}</span>
                  </div>
                );
              })}
              {Object.keys(data.seekers.byCategory).length === 0 && <p className="text-xs text-text-muted text-center py-4">No seekers registered yet</p>}
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Application Pipeline</p>
              <div className="space-y-2">
                {Object.entries(data.applications.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <Badge variant={status === "hired" ? "success" : status === "rejected" ? "danger" : status === "reviewed" ? "accent" : "default"} className="text-xs">{status}</Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">By Category</p>
                {Object.entries(data.applications.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-secondary">{cat}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>

          {/* First consideration metric */}
          <Card className="border-success/20"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-success" />
              <p className="text-xs font-semibold text-text-primary">First Consideration Compliance</p>
            </div>
            <p className="text-sm text-text-secondary">
              {data.applications.total > 0 ? (
                <>
                  <span className="font-bold text-success">{Math.round((data.applications.guyanese / data.applications.total) * 100)}%</span> of all job applications are from Guyanese nationals ({data.applications.guyanese} of {data.applications.total}).
                  {data.seekers.guyanese > 0 && (
                    <> The workforce pool is <span className="font-bold">{Math.round((data.seekers.guyanese / data.seekers.total) * 100)}%</span> Guyanese.</>
                  )}
                </>
              ) : (
                "No job applications data available yet. As seekers apply through the platform, first consideration metrics will appear here."
              )}
            </p>
          </CardContent></Card>
        </div>
      )}

      {/* Note edit modal */}
      {noteEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setNoteEdit(null)}>
          <div className="bg-bg-card rounded-xl border border-border p-4 w-full max-w-md shadow-lg" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-text-primary mb-3">Internal Note</p>
            <textarea
              className="w-full h-20 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-gold resize-none"
              value={noteEdit.note}
              onChange={e => setNoteEdit({ ...noteEdit, note: e.target.value })}
              placeholder="Add an internal note (visible to secretariat only)..."
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setNoteEdit(null)}>Cancel</Button>
              <Button size="sm" onClick={handleNoteSave}>Save Note</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
