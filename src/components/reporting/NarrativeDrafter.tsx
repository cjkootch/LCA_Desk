"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, RefreshCw } from "lucide-react";
import type { NarrativeSection } from "@/types/ai.types";

interface NarrativeDrafterProps {
  section: NarrativeSection;
  sectionLabel: string;
  data: Record<string, unknown>;
  jurisdictionCode: string;
  initialContent?: string;
  onSave: (content: string) => Promise<void>;
}

export function NarrativeDrafter({
  section,
  sectionLabel,
  data,
  jurisdictionCode,
  initialContent,
  onSave,
}: NarrativeDrafterProps) {
  const [content, setContent] = useState(initialContent || "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    setContent("");

    try {
      const response = await fetch("/api/ai/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data, jurisdiction_code: jurisdictionCode }),
      });

      if (!response.ok) throw new Error("Failed to generate narrative");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setContent(accumulated);
      }
    } catch (error) {
      console.error("Generation error:", error);
      setContent("Error generating narrative. Please try again.");
    }

    setGenerating(false);
  }, [section, data, jurisdictionCode]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(content);
    setSaving(false);
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface">
        <h3 className="text-sm font-semibold text-text-primary">{sectionLabel}</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            loading={generating}
            disabled={generating}
          >
            {content ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Generate with AI
              </>
            )}
          </Button>
          {content && (
            <Button size="sm" onClick={handleSave} loading={saving}>
              Save Draft
            </Button>
          )}
        </div>
      </div>
      <div className="p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Click "Generate with AI" to draft the ${sectionLabel.toLowerCase()} narrative, or write your own...`}
          className="w-full min-h-[200px] bg-transparent text-text-primary text-sm leading-relaxed resize-y focus:outline-none placeholder:text-text-muted"
        />
        {content && (
          <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-text-muted">
            <span>{wordCount} words</span>
            <span>{content.length} characters</span>
          </div>
        )}
      </div>
    </Card>
  );
}
