"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Newspaper, ExternalLink, Sparkles, Search, Filter } from "lucide-react";
import { fetchIndustryNews } from "@/server/actions";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, "accent" | "gold" | "warning" | "success" | "default"> = {
  contracts: "accent",
  production: "gold",
  policy: "warning",
  local_content: "success",
  employment: "accent",
  general: "default",
};

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "local_content", label: "Local Content" },
  { value: "contracts", label: "Contracts" },
  { value: "policy", label: "Policy" },
  { value: "production", label: "Production" },
  { value: "employment", label: "Employment" },
];

interface IndustryNewsFeedProps {
  userType?: "filer" | "supplier" | "seeker" | "secretariat";
  expanded?: boolean;
}

export function IndustryNewsFeed({ userType, expanded }: IndustryNewsFeedProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchIndustryNews(expanded ? 30 : 8, userType)
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userType, expanded]);

  if (loading) return <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" /></div>;
  if (articles.length === 0) return null;

  const filtered = articles.filter(a => {
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.title || "").toLowerCase().includes(q)
        || (a.aiSummary || "").toLowerCase().includes(q)
        || (a.companies || []).some((c: string) => c.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Industry News</h3>
            <span className="text-xs text-text-muted">({filtered.length})</span>
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn("p-1.5 rounded-lg transition-colors", showFilters ? "bg-accent-light text-accent" : "text-text-muted hover:text-text-primary")}>
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <Input placeholder="Search news..." value={search} onChange={e => setSearch(e.target.value)}
                className="h-8 text-xs pl-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map(cat => (
                <button key={cat.value} onClick={() => setCategoryFilter(cat.value)}
                  className={cn("px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                    categoryFilter === cat.value ? "bg-accent text-white" : "bg-bg-primary text-text-muted hover:text-text-primary"
                  )}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Articles */}
        <div className="space-y-1">
          {filtered.map(article => (
            <a key={article.id} href={article.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="block group">
              <div className="flex items-start gap-3 py-2.5 border-b border-border-light last:border-0 hover:bg-bg-primary -mx-2 px-2 rounded-lg transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  {article.aiSummary && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{article.aiSummary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-text-muted">{article.sourceName}</span>
                    {article.publishedAt && (
                      <span className="text-xs text-text-muted">
                        · {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {article.category && article.category !== "general" && (
                      <Badge variant={CATEGORY_COLORS[article.category] || "default"} className="text-[11px]">
                        {article.category.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {article.relevanceScore >= 8 && (
                      <Sparkles className="h-3 w-3 text-gold" />
                    )}
                    {article.companies?.length > 0 && (
                      <span className="text-xs text-text-muted">{article.companies.slice(0, 2).join(", ")}</span>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No articles match your filters.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
