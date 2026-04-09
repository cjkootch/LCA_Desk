"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { CompanyLogo } from "@/components/shared/CompanyLogo";
import {
  Building2, Search, Briefcase, Megaphone, CheckCircle, Shield,
  RefreshCw,
} from "lucide-react";
import { fetchAllCompanyProfiles, aggregateCompanyProfiles } from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CompaniesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [aggregating, setAggregating] = useState(false);

  useEffect(() => {
    fetchAllCompanyProfiles()
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAggregate = async () => {
    setAggregating(true);
    try {
      const result = await aggregateCompanyProfiles();
      toast.success(`Profiles updated: ${result.created} created, ${result.updated} updated`);
      const fresh = await fetchAllCompanyProfiles();
      setProfiles(fresh);
    } catch { toast.error("Failed to aggregate"); }
    setAggregating(false);
  };

  const filtered = search
    ? profiles.filter(p => p.companyName.toLowerCase().includes(search.toLowerCase()))
    : profiles;

  return (
    <div>
      <TopBar title="Verified Companies" />
      <div className="p-4 sm:p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Verified Companies</h1>
            <p className="text-sm text-text-secondary">{profiles.length} LCS-registered companies in Guyana&apos;s petroleum sector</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAggregate} loading={aggregating} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh Profiles
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search companies..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="p-4">
            <p className="text-xs text-text-muted">LCS Verified</p>
            <p className="text-2xl font-bold">{profiles.filter(p => p.lcsRegistered).length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">With Open Opportunities</p>
            <p className="text-2xl font-bold text-accent">{profiles.filter(p => p.activeOpportunities > 0).length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Hiring Now</p>
            <p className="text-2xl font-bold text-success">{profiles.filter(p => p.openJobPostings > 0).length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Claimed</p>
            <p className="text-2xl font-bold text-gold">{profiles.filter(p => p.claimed).length}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : filtered.length === 0 ? (
          profiles.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No company profiles yet"
              description="Click 'Refresh Profiles' to generate profiles from scraped data."
              actionLabel="Generate Profiles"
              onAction={handleAggregate}
            />
          ) : (
            <EmptyState icon={Search} title="No companies match" description="Try a different search." />
          )
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const initial = (p.companyName || "?").charAt(0).toUpperCase();
              return (
                <Link key={p.id} href={`/dashboard/companies/${p.slug}`}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer overflow-hidden group h-full">
                    {/* Cover banner */}
                    <div className={cn("h-14 relative",
                      p.lcsRegistered
                        ? "bg-gradient-to-r from-accent/15 via-accent/5 to-gold/5"
                        : "bg-gradient-to-r from-slate-100 via-slate-50 to-white"
                    )} />
                    {/* Logo */}
                    <div className="px-4 -mt-7 relative">
                      <div className="h-14 w-14 rounded-xl border-4 border-white shadow-sm mx-auto overflow-hidden bg-white">
                        <CompanyLogo companyName={p.companyName} size={48} />
                      </div>
                    </div>
                    <CardContent className="pt-2 pb-4 px-4 text-center">
                      {/* Name */}
                      <p className="text-sm font-semibold text-text-primary truncate mb-1">{p.companyName}</p>
                      {/* Status */}
                      <div className="flex justify-center gap-1 mb-2">
                        {p.lcsRegistered ? (
                          <Badge variant="success" className="text-xs gap-0.5"><Shield className="h-2.5 w-2.5" /> LCS Verified</Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Unverified</Badge>
                        )}
                        {p.claimed && <Badge variant="accent" className="text-xs gap-0.5"><CheckCircle className="h-2.5 w-2.5" /></Badge>}
                      </div>
                      {/* Stats */}
                      <div className="space-y-1 text-xs text-text-muted mb-3">
                        <div className="flex items-center justify-center gap-1">
                          <Megaphone className="h-3 w-3" />
                          {p.totalOpportunities} opportunit{p.totalOpportunities !== 1 ? "ies" : "y"}
                          {p.activeOpportunities > 0 && <span className="text-accent font-medium">({p.activeOpportunities} active)</span>}
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {p.totalJobPostings} job{p.totalJobPostings !== 1 ? "s" : ""}
                          {p.openJobPostings > 0 && <span className="text-success font-medium">({p.openJobPostings} open)</span>}
                        </div>
                      </div>
                      {/* Categories */}
                      {p.procurementCategories?.length > 0 && (
                        <p className="text-xs text-text-muted line-clamp-1 mb-3">
                          {p.procurementCategories.slice(0, 2).join(", ")}
                        </p>
                      )}
                      <Button variant="outline" size="sm" className="w-full text-xs group-hover:border-accent group-hover:text-accent transition-colors">
                        View Company
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
