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
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">LCS Supplier Directory</h1>
          <p className="text-sm text-text-secondary">
            {data ? `${data.total} registered · ${data.active} active · ${data.expired} expired` : "Loading..."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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
        <div className="space-y-2">
          {data.suppliers.map((s: any) => {
            const expired = isExpired(s.expirationDate);
            return (
              <Card key={s.id} className={cn("hover:border-accent/20 transition-colors cursor-pointer", expired && "opacity-70")} onClick={() => setSelected(s)}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-text-primary truncate">{s.legalName}</p>
                      {s.tradingName && <span className="text-xs text-text-muted shrink-0">t/a {s.tradingName}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      {s.certId && <span className="font-mono">{s.certId}</span>}
                      {s.serviceCategories?.slice(0, 2).map((c: string) => <Badge key={c} variant="default" className="text-xs">{c}</Badge>)}
                      {(s.serviceCategories?.length || 0) > 2 && <span>+{s.serviceCategories.length - 2}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {expired ? (
                      <Badge variant="danger" className="text-xs"><AlertTriangle className="h-3 w-3 mr-0.5" />Expired</Badge>
                    ) : s.status === "Active" ? (
                      <Badge variant="success" className="text-xs"><CheckCircle className="h-3 w-3 mr-0.5" />Active</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">{s.status || "Unknown"}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gold" /> {selected.legalName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-3">
                <div className="bg-bg-primary rounded-lg p-4 space-y-2 text-sm">
                  {selected.certId && <div className="flex justify-between"><span className="text-text-muted">Certificate ID</span><span className="font-mono font-medium">{selected.certId}</span></div>}
                  {selected.tradingName && <div className="flex justify-between"><span className="text-text-muted">Trading Name</span><span>{selected.tradingName}</span></div>}
                  <div className="flex justify-between"><span className="text-text-muted">Status</span>{isExpired(selected.expirationDate) ? <Badge variant="danger">Expired</Badge> : <Badge variant="success">{selected.status || "Active"}</Badge>}</div>
                  {selected.expirationDate && <div className="flex justify-between"><span className="text-text-muted">Expiration</span><span className={cn(isExpired(selected.expirationDate) && "text-danger font-medium")}>{new Date(selected.expirationDate).toLocaleDateString()}</span></div>}
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {selected.address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-text-muted mt-0.5 shrink-0" /><span className="text-text-secondary">{selected.address}</span></div>}
                  {selected.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-text-muted" /><a href={`mailto:${selected.email}`} className="text-accent hover:underline">{selected.email}</a></div>}
                  {selected.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-text-muted" /><span className="text-text-secondary">{selected.phone}</span></div>}
                  {selected.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-text-muted" /><a href={selected.website} target="_blank" className="text-accent hover:underline truncate">{selected.website}</a></div>}
                  {selected.profileUrl && <div className="flex items-center gap-2"><ExternalLink className="h-4 w-4 text-text-muted" /><a href={selected.profileUrl} target="_blank" className="text-accent hover:underline text-xs">View on LCS Register</a></div>}
                </div>
                {selected.serviceCategories?.length > 0 && (
                  <div><p className="text-xs font-semibold text-text-muted mb-1.5">Service Categories</p><div className="flex flex-wrap gap-1">{selected.serviceCategories.map((c: string) => <Badge key={c} variant="accent" className="text-xs">{c}</Badge>)}</div></div>
                )}
                {selected.aiSummary && (
                  <div><p className="text-xs font-semibold text-text-muted mb-1.5">AI Summary</p><p className="text-sm text-text-secondary">{selected.aiSummary}</p></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
