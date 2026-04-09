"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ExternalLink, Sparkles } from "lucide-react";
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

export function IndustryNewsFeed() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIndustryNews(8)
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" /></div>;
  if (articles.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Newspaper className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Industry News</h3>
        </div>
        <div className="space-y-3">
          {articles.map(article => (
            <a key={article.id} href={article.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="block group">
              <div className="flex items-start gap-3 py-2 border-b border-border-light last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors line-clamp-2">
                    {article.title}
                  </p>
                  {article.aiSummary && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">{article.aiSummary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-text-muted">{article.sourceName}</span>
                    {article.publishedAt && (
                      <span className="text-[10px] text-text-muted">
                        · {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    {article.category && article.category !== "general" && (
                      <Badge variant={CATEGORY_COLORS[article.category] || "default"} className="text-[8px]">
                        {article.category.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {article.relevanceScore >= 8 && (
                      <Sparkles className="h-3 w-3 text-gold" />
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
