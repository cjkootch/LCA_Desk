"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3, Briefcase, Users, TrendingUp, Pin, PinOff,
  MessageSquare, FileText, Eye, Save, UserCheck,
} from "lucide-react";
import { fetchSecretariatMarketIntel, moderateOpportunity, moderateEmploymentNotice } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type IntelData = Awaited<ReturnType<typeof fetchSecretariatMarketIntel>>;

export default function MarketIntelPage() {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "opportunities" | "jobs" | "seekers">("overview");
  const [noteEdit, setNoteEdit] = useState<{ id: string; type: "opp" | "job"; note: string } | null>(null);

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
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
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
          {/* Top-level stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 text-center">
              <Briefcase className="h-5 w-5 text-gold mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.opportunities.total}</p>
              <p className="text-[10px] text-text-muted">Procurement Notices</p>
              <p className="text-[9px] text-success">{data.opportunities.active} active</p>
            </Card>
            <Card className="p-4 text-center">
              <FileText className="h-5 w-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.jobs.total}</p>
              <p className="text-[10px] text-text-muted">Employment Notices</p>
              <p className="text-[9px] text-success">{data.jobs.open} open</p>
            </Card>
            <Card className="p-4 text-center">
              <Users className="h-5 w-5 text-success mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.seekers.total}</p>
              <p className="text-[10px] text-text-muted">Registered Job Seekers</p>
              <p className="text-[9px] text-accent">{data.seekers.inTalentPool} in talent pool</p>
            </Card>
            <Card className="p-4 text-center">
              <UserCheck className="h-5 w-5 text-warning mx-auto mb-1" />
              <p className="text-2xl font-bold">{data.applications.total}</p>
              <p className="text-[10px] text-text-muted">Job Applications</p>
              <p className="text-[9px] text-success">{data.applications.guyanese} Guyanese ({data.applications.total > 0 ? Math.round((data.applications.guyanese / data.applications.total) * 100) : 0}%)</p>
            </Card>
          </div>

          {/* Posting trend */}
          <Card><CardContent className="p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Posting Volume by Month</p>
            <div className="flex items-end gap-1 h-28">
              {data.opportunities.byMonth.slice(-12).map(([month, count]) => {
                const jobCount = data.jobs.byMonth.find(([m]) => m === month)?.[1] || 0;
                const maxCount = Math.max(...data.opportunities.byMonth.map(([, c]) => c), 1);
                const oppH = Math.max((count / maxCount) * 100, 4);
                const jobH = Math.max((jobCount / maxCount) * 100, 2);
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-bold text-text-primary">{count}</span>
                    <div className="w-full flex flex-col gap-0.5">
                      <div className="w-full rounded-t bg-gold/70" style={{ height: `${oppH}%` }} title={`${count} opportunities`} />
                      <div className="w-full rounded-t bg-accent/70" style={{ height: `${jobH}%` }} title={`${jobCount} jobs`} />
                    </div>
                    <span className="text-[7px] text-text-muted">{month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gold/70" /> Opportunities</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent/70" /> Employment</span>
            </div>
          </CardContent></Card>

          {/* Top companies + engagement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Top Companies (Opportunities)</p>
              <div className="space-y-1.5">
                {data.opportunities.topCompanies.slice(0, 8).map(([company, count]) => (
                  <div key={company} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary truncate mr-2">{company}</span>
                    <Badge variant="default" className="text-[9px] shrink-0">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Most Saved by Filers</p>
              {data.opportunities.mostSaved.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">No saves yet</p>
              ) : (
                <div className="space-y-1.5">
                  {data.opportunities.mostSaved.slice(0, 8).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <div className="truncate mr-2">
                        <span className="text-text-primary font-medium">{item.title.slice(0, 40)}</span>
                        <span className="text-text-muted ml-1">— {item.company}</span>
                      </div>
                      <div className="flex items-center gap-1 text-accent shrink-0">
                        <Save className="h-3 w-3" /> {item.saves}
                      </div>
                    </div>
                  ))}
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
                  <div key={cat} className="flex items-center justify-between text-xs">
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
      {tab === "opportunities" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary">{data.opportunities.total} Procurement Notices</p>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span className="text-success">{data.opportunities.active} active</span>
              <span>·</span>
              <span>{data.opportunities.pinned} pinned</span>
              <span>·</span>
              <span>{data.opportunities.totalSaves} total saves</span>
            </div>
          </div>

          {data.recentOpportunities.map(opp => (
            <Card key={opp.id} className={cn(opp.pinned && "border-gold/30 bg-gold/5")}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {opp.pinned && <Pin className="h-3 w-3 text-gold shrink-0" />}
                      <h3 className="text-sm font-semibold text-text-primary truncate">{opp.title}</h3>
                    </div>
                    <p className="text-xs text-text-muted">{opp.company} · {opp.type} · {opp.postedDate}</p>
                    {opp.deadline && <p className="text-[10px] text-text-muted">Deadline: {opp.deadline}</p>}
                    {opp.note && <p className="text-[10px] text-warning mt-1 italic">Note: {opp.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opp.saves > 0 && <Badge variant="accent" className="text-[9px]"><Save className="h-2.5 w-2.5 mr-0.5" />{opp.saves}</Badge>}
                    <Badge variant={opp.status === "active" ? "success" : opp.status === "closed" ? "default" : "warning"} className="text-[9px]">{opp.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 border-t border-border pt-2">
                  <button onClick={() => handlePin(opp.id, "opp", !!opp.pinned)}
                    className="text-[10px] text-text-muted hover:text-gold flex items-center gap-1">
                    {opp.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {opp.pinned ? "Unpin" : "Pin"}
                  </button>
                  {opp.status === "active" && (
                    <button onClick={() => handleStatusChange(opp.id, "opp", "closed")}
                      className="text-[10px] text-text-muted hover:text-danger flex items-center gap-1">
                      Mark Closed
                    </button>
                  )}
                  {opp.status === "closed" && (
                    <button onClick={() => handleStatusChange(opp.id, "opp", "active")}
                      className="text-[10px] text-text-muted hover:text-success flex items-center gap-1">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => setNoteEdit({ id: opp.id, type: "opp", note: opp.note || "" })}
                    className="text-[10px] text-text-muted hover:text-accent flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {opp.note ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Employment Notices Tab (moderation) ── */}
      {tab === "jobs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-text-primary">{data.jobs.total} Employment Notices</p>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
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
                      <h3 className="text-sm font-semibold text-text-primary truncate">{job.title}</h3>
                    </div>
                    <p className="text-xs text-text-muted">{job.company} · {job.category || "Uncategorized"} · {job.postedDate}</p>
                    {job.closingDate && <p className="text-[10px] text-text-muted">Closing: {job.closingDate}</p>}
                    {job.note && <p className="text-[10px] text-warning mt-1 italic">Note: {job.note}</p>}
                  </div>
                  <Badge variant={job.status === "open" ? "success" : "default"} className="text-[9px] shrink-0">{job.status}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 border-t border-border pt-2">
                  <button onClick={() => handlePin(job.id, "job", !!job.pinned)}
                    className="text-[10px] text-text-muted hover:text-gold flex items-center gap-1">
                    {job.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {job.pinned ? "Unpin" : "Pin"}
                  </button>
                  {job.status === "open" && (
                    <button onClick={() => handleStatusChange(job.id, "job", "closed")}
                      className="text-[10px] text-text-muted hover:text-danger flex items-center gap-1">
                      Mark Closed
                    </button>
                  )}
                  {job.status === "closed" && (
                    <button onClick={() => handleStatusChange(job.id, "job", "open")}
                      className="text-[10px] text-text-muted hover:text-success flex items-center gap-1">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => setNoteEdit({ id: job.id, type: "job", note: job.note || "" })}
                    className="text-[10px] text-text-muted hover:text-accent flex items-center gap-1">
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
              <p className="text-[10px] text-text-muted">Total Registered</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{data.seekers.guyanese}</p>
              <p className="text-[10px] text-text-muted">Guyanese Nationals</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-accent">{data.seekers.inTalentPool}</p>
              <p className="text-[10px] text-text-muted">In Talent Pool</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{data.seekers.avgExperience} yrs</p>
              <p className="text-[10px] text-text-muted">Avg Experience</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Workforce by Employment Category</p>
              {Object.entries(data.seekers.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const pct = data.seekers.total > 0 ? Math.round((count / data.seekers.total) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center gap-3 mb-2">
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
                    <Badge variant={status === "hired" ? "success" : status === "rejected" ? "danger" : status === "reviewed" ? "accent" : "default"} className="text-[9px]">{status}</Badge>
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
