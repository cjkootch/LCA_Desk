"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Building2, Shield, Mail, Phone, Globe, MapPin,
  CheckCircle, AlertTriangle, Calendar, ExternalLink,
} from "lucide-react";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { fetchSecretariatSupplierDirectory } from "@/server/actions";
import { cn } from "@/lib/utils";

export default function SupplierDirectoryPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any>(null);

  const load = () => {
    setLoading(true);
    fetchSecretariatSupplierDirectory({
      search: search || undefined,
      statusFilter: statusFilter !== "all" ? statusFilter : undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
    }).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const isExpired = (d: string | null) => d && new Date(d) < new Date();

  return (
    <div data-section="suppliers" className="p-4 sm:p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="h-6 w-6 text-gold" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-heading font-bold text-text-primary">LCS Supplier Directory</h1>
            <InfoTooltip title="LCS Supplier Directory" content="The Local Content Services Register — all certified suppliers in your jurisdiction. Contractors must spend a minimum 50% of their total expenditure with active LCS-registered companies. Expired certificates indicate the supplier's registration has lapsed and expenditure with them may not count toward the LC Rate." />
          </div>
          <p className="text-sm text-text-secondary">
            {data ? `${data.total} registered · ${data.active} active · ${data.expired} expired` : "Loading..."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search company, cert ID, email..." className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setTimeout(load, 0); }}
          options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "expired", label: "Expired" }]} />
        {data?.categories && (
          <Select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setTimeout(load, 0); }}
            options={[{ value: "all", label: "All Categories" }, ...data.categories.slice(0, 20).map((c: string) => ({ value: c, label: c }))]} />
        )}
        <Button variant="outline" size="sm" onClick={load}>Search</Button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>
      ) : !data || data.suppliers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-text-muted">No suppliers found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.suppliers.map((s: any) => {
            const expired = isExpired(s.expirationDate);
            const initial = (s.legalName || "?").charAt(0).toUpperCase();
            return (
              <Card key={s.id} className={cn("hover:shadow-lg transition-all cursor-pointer overflow-hidden group", expired && "opacity-60")} onClick={() => setSelected(s)}>
                {/* Cover */}
                <div className={cn("h-14 relative",
                  expired ? "bg-gradient-to-r from-danger/10 via-danger/5 to-bg-primary"
                  : "bg-gradient-to-r from-gold/15 via-gold/5 to-accent/5"
                )} />
                {/* Logo / Initial */}
                <div className="px-4 -mt-7 relative">
                  <div className={cn("h-14 w-14 rounded-lg flex items-center justify-center border-4 border-white shadow-sm mx-auto overflow-hidden",
                    expired ? "bg-bg-primary" : "bg-gold/10"
                  )}>
                    <span className={cn("text-lg font-bold", expired ? "text-text-muted" : "text-gold")}>{initial}</span>
                  </div>
                </div>
                <CardContent className="pt-2 pb-4 px-4 text-center">
                  <p className="text-sm font-semibold text-text-primary truncate">{s.legalName}</p>
                  {s.tradingName && <p className="text-xs text-text-muted truncate">t/a {s.tradingName}</p>}
                  <p className="text-xs text-accent font-mono mt-0.5">{s.certId || "—"}</p>
                  <div className="flex justify-center gap-1 mt-2 min-h-[1.5rem]">
                    {expired ? (
                      <Badge variant="danger" className="text-xs"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Expired</Badge>
                    ) : (
                      <Badge variant="success" className="text-xs"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />{s.status || "Active"}</Badge>
                    )}
                  </div>
                  {s.serviceCategories?.length > 0 && (
                    <p className="text-xs text-text-muted mt-1.5 line-clamp-1">{s.serviceCategories.slice(0, 2).join(", ")}</p>
                  )}
                  <Button variant="outline" size="sm" className="w-full text-xs mt-3 group-hover:border-gold group-hover:text-gold transition-colors">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (() => {
            const expired = isExpired(selected.expirationDate);
            const initial = (selected.legalName || "?").charAt(0).toUpperCase();

            // Parse AI summary — could be JSON or plain text
            let summaryText = "";
            if (selected.aiSummary) {
              try {
                const parsed = JSON.parse(selected.aiSummary);
                summaryText = parsed.company_description || parsed.guyana_presence || "";
              } catch {
                summaryText = selected.aiSummary;
              }
            }

            return (
              <>
                {/* Header with banner */}
                <div className={cn("h-20 -mx-6 -mt-6 rounded-t-xl relative",
                  expired ? "bg-gradient-to-r from-danger/15 via-danger/5 to-bg-primary"
                  : "bg-gradient-to-r from-gold/20 via-gold/10 to-accent/10"
                )} />
                <div className="-mt-10 mb-2 flex items-end gap-4 px-2">
                  <div className={cn("h-16 w-16 rounded-xl flex items-center justify-center border-4 border-white shadow-md shrink-0",
                    expired ? "bg-bg-primary" : "bg-gold/10"
                  )}>
                    <span className={cn("text-2xl font-bold", expired ? "text-text-muted" : "text-gold")}>{initial}</span>
                  </div>
                  <div className="pb-1">
                    <h2 className="text-lg font-bold text-text-primary">{selected.legalName}</h2>
                    {selected.tradingName && <p className="text-sm text-text-muted">t/a {selected.tradingName}</p>}
                  </div>
                </div>

                <div className="space-y-5 mt-4">
                  {/* Status card */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 text-center">
                      <p className="text-xs text-text-muted mb-1">Status</p>
                      {expired ? <Badge variant="danger">Expired</Badge> : <Badge variant="success">{selected.status || "Active"}</Badge>}
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-xs text-text-muted mb-1">Certificate</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{selected.certId || "—"}</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-xs text-text-muted mb-1">Expires</p>
                      <p className={cn("text-sm font-medium", expired ? "text-danger" : "text-text-primary")}>
                        {selected.expirationDate ? new Date(selected.expirationDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </p>
                    </Card>
                  </div>

                  {/* Contact info */}
                  {(selected.address || selected.email || selected.phone || selected.website) && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Contact</p>
                        {selected.address && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
                            <span className="text-sm text-text-secondary">{selected.address}</span>
                          </div>
                        )}
                        {selected.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-text-muted shrink-0" />
                            <a href={`mailto:${selected.email}`} className="text-sm text-accent hover:underline">{selected.email}</a>
                          </div>
                        )}
                        {selected.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-text-muted shrink-0" />
                            <span className="text-sm text-text-secondary">{selected.phone}</span>
                          </div>
                        )}
                        {selected.website && (
                          <div className="flex items-center gap-3">
                            <Globe className="h-4 w-4 text-text-muted shrink-0" />
                            <a href={selected.website} target="_blank" className="text-sm text-accent hover:underline truncate">{selected.website}</a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Service categories */}
                  {selected.serviceCategories?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Service Categories</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.serviceCategories.map((c: string) => (
                          <Badge key={c} variant="accent" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Summary */}
                  {summaryText && (
                    <Card className="border-gold/20 bg-gold/[0.02]">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">Company Profile</p>
                        <p className="text-sm text-text-secondary leading-relaxed">{summaryText}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* External link */}
                  {selected.profileUrl && (
                    <a href={selected.profileUrl} target="_blank" className="block">
                      <Button variant="outline" className="w-full gap-2 text-sm">
                        <ExternalLink className="h-4 w-4" /> View on LCS Register
                      </Button>
                    </a>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
