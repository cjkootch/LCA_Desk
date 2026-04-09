"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Users, MapPin, Briefcase, Mail, Phone, Trophy,
  CheckCircle, Lock, GraduationCap, FileText,
} from "lucide-react";
import { fetchSecretariatTalentPool } from "@/server/actions";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Management", "Technical", "Administrative", "Skilled Labour", "Semi-Skilled Labour", "Unskilled Labour"];

export default function SecretariatTalentPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [guyaneseOnly, setGuyaneseOnly] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any>(null);

  const load = () => {
    setLoading(true);
    fetchSecretariatTalentPool({
      search: search || undefined,
      category: category !== "All" ? category : undefined,
      guyaneseOnly: guyaneseOnly || undefined,
    }).then(setCandidates).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Talent Pool</h1>
          <p className="text-sm text-text-secondary">{candidates.length} registered job seekers · {candidates.filter(c => c.isGuyanese).length} Guyanese nationals</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search name, title, skills..." className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => { setCategory(cat); setTimeout(load, 0); }}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                category === cat ? "bg-accent text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
              )}>{cat}</button>
          ))}
          <button onClick={() => { setGuyaneseOnly(!guyaneseOnly); setTimeout(load, 0); }}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              guyaneseOnly ? "bg-success text-white" : "bg-bg-primary text-text-secondary hover:bg-border-light"
            )}>Guyanese Only</button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
      ) : candidates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-text-muted">No candidates found. Adjust your filters.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {candidates.map(c => {
            const isCertified = c.badges?.length >= 2;
            return (
              <Card key={c.id} className={cn("hover:shadow-lg transition-all cursor-pointer overflow-hidden group", isCertified && "ring-1 ring-gold/30")} onClick={() => setSelected(c)}>
                <div className={cn("h-14 relative", isCertified ? "bg-gradient-to-r from-gold/20 via-gold/10 to-accent/10" : "bg-gradient-to-r from-accent/10 via-accent/5 to-bg-primary")} />
                <div className="px-4 -mt-7 relative">
                  <div className={cn("h-14 w-14 rounded-full flex items-center justify-center border-4 border-white shadow-sm mx-auto overflow-hidden", isCertified ? "bg-gold/10" : "bg-accent-light")}>
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <span className={cn("text-lg font-bold", isCertified ? "text-gold" : "text-accent")}>{(c.userName || "?").charAt(0)}</span>
                    )}
                  </div>
                </div>
                <CardContent className="pt-2 pb-4 px-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <p className="text-sm font-semibold text-text-primary truncate">{c.userName}</p>
                    {c.isGuyanese && <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />}
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2 mb-2 min-h-[2rem]">{c.headline || c.currentJobTitle || "Job Seeker"}</p>
                  <div className="flex flex-wrap justify-center gap-1 mb-3 min-h-[1.5rem]">
                    {isCertified && <Badge variant="gold" className="text-xs gap-0.5"><Trophy className="h-2.5 w-2.5" /> Certified</Badge>}
                    {c.yearsExperience > 0 && <Badge variant="default" className="text-xs">{c.yearsExperience}yr</Badge>}
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs group-hover:border-accent group-hover:text-accent">View Profile</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-accent-light flex items-center justify-center shrink-0 overflow-hidden">
                    {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-lg font-bold text-accent">{(selected.userName || "?").charAt(0)}</span>}
                  </div>
                  <div>
                    <DialogTitle>{selected.userName}</DialogTitle>
                    <p className="text-sm text-text-secondary">{selected.headline || selected.currentJobTitle}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selected.userEmail && <div className="flex items-center gap-2 text-text-secondary"><Mail className="h-4 w-4 text-text-muted" />{selected.userEmail}</div>}
                  {selected.userPhone && <div className="flex items-center gap-2 text-text-secondary"><Phone className="h-4 w-4 text-text-muted" />{selected.userPhone}</div>}
                  {selected.locationPreference && <div className="flex items-center gap-2 text-text-secondary"><MapPin className="h-4 w-4 text-text-muted" />{selected.locationPreference}</div>}
                  {selected.educationLevel && <div className="flex items-center gap-2 text-text-secondary"><GraduationCap className="h-4 w-4 text-text-muted" />{selected.educationLevel}{selected.educationField ? ` — ${selected.educationField}` : ""}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.isGuyanese && <Badge variant="success">Guyanese National</Badge>}
                  {selected.employmentCategory && <Badge variant="default">{selected.employmentCategory}</Badge>}
                  {selected.yearsExperience > 0 && <Badge variant="default">{selected.yearsExperience} years experience</Badge>}
                  {selected.badges?.map((b: string) => <Badge key={b} variant="gold" className="gap-0.5"><Trophy className="h-3 w-3" />{b}</Badge>)}
                </div>
                {selected.skills?.length > 0 && (
                  <div><p className="text-xs font-semibold text-text-muted mb-1.5">Skills</p><div className="flex flex-wrap gap-1">{selected.skills.map((s: string) => <span key={s} className="text-xs bg-bg-primary text-text-secondary px-2 py-0.5 rounded">{s}</span>)}</div></div>
                )}
                {selected.certifications?.length > 0 && (
                  <div><p className="text-xs font-semibold text-text-muted mb-1.5">Certifications</p><div className="flex flex-wrap gap-1">{selected.certifications.map((c: string) => <Badge key={c} variant="accent" className="text-xs">{c}</Badge>)}</div></div>
                )}
                {selected.resumeContent && (
                  <div><p className="text-xs font-semibold text-text-muted mb-1.5">Resume Summary</p><p className="text-sm text-text-secondary whitespace-pre-line">{selected.resumeContent.slice(0, 500)}</p></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
