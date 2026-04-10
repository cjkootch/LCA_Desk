"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Presentation, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideshowProps {
  content: string; // markdown content
  title: string; // "Course Title — Module Title"
  courseTitle?: string;
  moduleTitle?: string;
  onClose: () => void;
}

function parseSlides(markdown: string): { heading: string; body: string }[] {
  const sections = markdown.split(/^## /m).filter(Boolean);
  if (sections.length <= 1) {
    // No ## headers — split by ### or paragraphs
    const parts = markdown.split(/^### /m).filter(Boolean);
    if (parts.length <= 1) {
      return [{ heading: "", body: markdown }];
    }
    return parts.map(p => {
      const lines = p.trim().split("\n");
      return { heading: lines[0] || "", body: lines.slice(1).join("\n").trim() };
    });
  }
  return sections.map(s => {
    const lines = s.trim().split("\n");
    return { heading: lines[0] || "", body: lines.slice(1).join("\n").trim() };
  });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s?/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*]\s/gm, "")
    .replace(/^\d+\.\s/gm, "")
    .trim();
}

export function Slideshow({ content, title, courseTitle, moduleTitle, onClose }: SlideshowProps) {
  const contentSlides = parseSlides(content);

  // Build intro slide from the section headings
  const topicList = contentSlides
    .map(s => s.heading)
    .filter(Boolean)
    .map(h => `• ${h}`)
    .join("\n");

  const introSlide = {
    heading: moduleTitle || title,
    body: `${courseTitle ? `**${courseTitle}**\n\n` : ""}In this module, you'll learn:\n\n${topicList || "Key concepts and practical techniques."}`,
  };

  const slides = [introSlide, ...contentSlides];
  const [current, setCurrent] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled) return;
    stopSpeech();
    const clean = stripMarkdown(text);
    if (!clean) return;

    try {
      setSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voice: "nova" }),
      });

      if (!res.ok) {
        // Fallback to browser speech if API fails
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(clean);
          utterance.rate = 0.92;
          utterance.onend = () => setSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setSpeaking(false);
        }
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch {
      setSpeaking(false);
    }
  }, [voiceEnabled, stopSpeech]);

  // Speak slide content when navigating
  useEffect(() => {
    const slide = slides[current];
    if (slide && voiceEnabled) {
      const text = slide.heading ? `${slide.heading}. ${slide.body}` : slide.body;
      // Small delay to let the UI render first
      const timer = setTimeout(() => speak(text), 300);
      return () => { clearTimeout(timer); stopSpeech(); };
    }
    return () => stopSpeech();
  }, [current, voiceEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => stopSpeech(), [stopSpeech]);

  const slide = slides[current];
  const progress = ((current + 1) / slides.length) * 100;

  // Render markdown body as simple HTML
  const renderBody = (body: string) => {
    const lines = body.split("\n").filter(Boolean);
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("### ")) return <h3 key={i} className="text-lg font-bold text-text-primary mt-4 mb-2">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) return <li key={i} className="text-text-secondary ml-4 mb-1">{trimmed.slice(2).replace(/\*\*(.+?)\*\*/g, "$1")}</li>;
      if (trimmed.startsWith('"') || trimmed.startsWith('"')) return <blockquote key={i} className="border-l-4 border-accent/30 pl-4 py-1 my-2 text-text-secondary italic">{trimmed}</blockquote>;
      return <p key={i} className="text-text-secondary mb-2 leading-relaxed">{trimmed.replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#E8E4DF] flex flex-col">
      {/* Top bar */}
      <div className="relative flex items-center justify-between h-12 px-4 sm:px-6 bg-[#19544c] border-b border-[#19544c]/20">
        <div className="flex items-center gap-3">
          <Presentation className="h-4 w-4 text-[#71b59a]" />
          <span className="text-sm font-medium text-white/90 truncate">{title}</span>
          <span className="text-xs text-white/50">Slide {current + 1} of {slides.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeech(); }}
            className={cn("p-1.5 rounded-lg transition-colors", voiceEnabled ? "text-[#71b59a] hover:text-[#71b59a]/80" : "text-white/30 hover:text-white/50")}
            title={voiceEnabled ? "Mute voiceover" : "Enable voiceover"}>
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          {speaking ? (
            <button onClick={stopSpeech} className="p-1.5 rounded-lg text-[#71b59a] hover:text-[#71b59a]/80">
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => speak(slide.heading ? `${slide.heading}. ${slide.body}` : slide.body)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white/80">
              <Play className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => { stopSpeech(); onClose(); }} className="p-1.5 rounded-lg text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-1 rounded-none" indicatorClassName="bg-gold rounded-none" />

      {/* Slide content */}
      <div className="relative flex-1 flex items-center justify-center px-4 sm:px-8 overflow-y-auto">
        <div className="max-w-2xl w-full py-8">
          {slide.heading && (
            <h2 className="text-2xl sm:text-4xl font-bold text-[#19544c] mb-6" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>{slide.heading}</h2>
          )}
          <div className="text-base sm:text-lg text-[#334155] leading-relaxed space-y-1">
            {renderBody(slide.body)}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="relative flex items-center justify-between h-16 px-4 sm:px-8 bg-[#19544c] border-t border-[#19544c]/20">
        <Button
          variant="ghost"
          onClick={() => { stopSpeech(); setCurrent(Math.max(0, current - 1)); }}
          disabled={current === 0}
          className="text-white/70 hover:text-white disabled:opacity-30 gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => { stopSpeech(); setCurrent(i); }}
              className={cn("h-2 rounded-full transition-all",
                i === current ? "w-6 bg-[#71b59a]" : i < current ? "w-2 bg-[#71b59a]/40" : "w-2 bg-white/20"
              )} />
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => { stopSpeech(); setCurrent(Math.min(slides.length - 1, current + 1)); }}
          disabled={current === slides.length - 1}
          className="text-white/70 hover:text-white disabled:opacity-30 gap-1.5"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
