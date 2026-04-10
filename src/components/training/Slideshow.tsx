"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Presentation, X, SkipForward, CheckCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface SlideshowProps {
  content: string; // markdown content
  title: string; // "Course Title — Module Title"
  courseTitle?: string;
  moduleTitle?: string;
  onClose: () => void;
  onComplete?: () => void;
  isModuleComplete?: boolean;
}

function parseSlides(markdown: string): { heading: string; body: string }[] {
  const sections = markdown.split(/^## /m).filter(Boolean);
  if (sections.length <= 1) {
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

// Build TTS text with natural pacing — pauses between bullets and sections
function buildSpeechText(heading: string, body: string): string {
  const lines = body.split("\n").filter(Boolean);
  const parts: string[] = [];

  if (heading) parts.push(heading + ".");

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("### ")) {
      // Sub-header — add a longer pause before it
      parts.push("... " + stripMarkdown(t) + ".");
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      // Bullet — ensure it ends with punctuation for a natural pause
      let cleaned = stripMarkdown(t);
      if (cleaned && !/[.!?]$/.test(cleaned)) cleaned += ".";
      parts.push(cleaned);
    } else if (t.startsWith("**") && t.endsWith("**")) {
      parts.push(stripMarkdown(t) + ".");
    } else if (t.startsWith('"') || t.startsWith('\u201c')) {
      parts.push(stripMarkdown(t));
    } else {
      let cleaned = stripMarkdown(t);
      if (cleaned && !/[.!?]$/.test(cleaned)) cleaned += ".";
      parts.push(cleaned);
    }
  }

  return parts.filter(Boolean).join(" ");
}

// Estimate cumulative word offsets for each line to sync animations
// Assumes ~2.8 words/sec at 1.05x speed for OpenAI TTS
const WORDS_PER_SEC = 2.8;

function estimateLineTimings(heading: string, body: string): number[] {
  const lines = body.split("\n").filter(Boolean);
  const timings: number[] = [];
  let cumulativeWords = 0;

  // Account for heading being spoken first
  if (heading) {
    cumulativeWords += heading.split(/\s+/).length + 1; // +1 for the pause after period
  }

  for (const line of lines) {
    const t = line.trim();
    // Push current timing (when this line starts being spoken)
    timings.push(cumulativeWords / WORDS_PER_SEC);

    // Count words in this line
    const cleaned = stripMarkdown(t);
    const wordCount = cleaned ? cleaned.split(/\s+/).length : 0;
    cumulativeWords += wordCount + 0.5; // +0.5 for inter-bullet pause
  }

  return timings;
}

export function Slideshow({ content, title, courseTitle, moduleTitle, onClose, onComplete, isModuleComplete }: SlideshowProps) {
  const contentSlides = parseSlides(content);

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
  const [autoPlay, setAutoPlay] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Audio cache: slide index → blob URL (prefetched or fetched)
  const audioCache = useRef<Map<number, string>>(new Map());
  const prefetchingSet = useRef<Set<number>>(new Set());
  const speakAbortRef = useRef<AbortController | null>(null);

  const isLastSlide = current === slides.length - 1;
  const isIntro = current === 0;

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    // Abort any in-flight TTS fetch
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    clearAdvanceTimer();
    setSpeaking(false);
  }, [clearAdvanceTimer]);

  const onSpeechEnd = useCallback(() => {
    if (!mountedRef.current) return;
    setSpeaking(false);
    if (autoPlay) {
      advanceTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setCurrent(prev => {
          const totalSlides = contentSlides.length + 1;
          return prev < totalSlides - 1 ? prev + 1 : prev;
        });
      }, 2000);
    }
  }, [autoPlay, contentSlides.length]);

  // Play a cached blob URL immediately
  const playFromUrl = useCallback((url: string, owned: boolean) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { if (owned) URL.revokeObjectURL(url); onSpeechEnd(); };
    audio.onerror = () => { if (owned) URL.revokeObjectURL(url); if (mountedRef.current) setSpeaking(false); };
    audio.play();
  }, [onSpeechEnd]);

  const speak = useCallback(async (text: string, slideIdx?: number) => {
    if (!voiceEnabled) return;
    // Abort any in-flight fetch from a previous speak call
    // Stop any current audio and abort previous fetch
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    speakAbortRef.current?.abort();
    clearAdvanceTimer();
    const controller = new AbortController();
    speakAbortRef.current = controller;
    if (!text) return;

    setSpeaking(true);

    // Cache hit — instant playback, no network wait
    if (slideIdx !== undefined && audioCache.current.has(slideIdx)) {
      playFromUrl(audioCache.current.get(slideIdx)!, false);
      return;
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" }),
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mountedRef.current) return;

      if (!res.ok) {
        if (mountedRef.current) setSpeaking(false);
        return;
      }

      const blob = await res.blob();
      if (controller.signal.aborted || !mountedRef.current) return;

      const url = URL.createObjectURL(blob);
      if (slideIdx !== undefined) {
        audioCache.current.set(slideIdx, url);
        playFromUrl(url, false); // cache owns the URL, revoked on unmount
      } else {
        playFromUrl(url, true); // ephemeral, revoke on ended
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (mountedRef.current) setSpeaking(false);
    }
  }, [voiceEnabled, stopSpeech, onSpeechEnd, playFromUrl]);

  // Prefetch the TTS audio for a slide index into the cache
  const prefetchSlide = useCallback(async (idx: number) => {
    if (!voiceEnabled) return;
    if (idx < 0 || idx >= slides.length) return;
    if (audioCache.current.has(idx) || prefetchingSet.current.has(idx)) return;

    prefetchingSet.current.add(idx);
    const slide = slides[idx];
    const text = buildSpeechText(slide.heading, slide.body);
    if (!text) { prefetchingSet.current.delete(idx); return; }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" }),
      });
      if (!mountedRef.current || !res.ok) { prefetchingSet.current.delete(idx); return; }
      const blob = await res.blob();
      if (!mountedRef.current) { prefetchingSet.current.delete(idx); return; }
      audioCache.current.set(idx, URL.createObjectURL(blob));
    } catch { /* silent — cache miss is handled gracefully */ }
    prefetchingSet.current.delete(idx);
  }, [voiceEnabled, slides]);

  // Speak current slide immediately (no delay) and prefetch the next one
  useEffect(() => {
    const slide = slides[current];
    if (slide && voiceEnabled) {
      const speechText = buildSpeechText(slide.heading, slide.body);
      speak(speechText, current);
      prefetchSlide(current + 1);
    }
    return () => stopSpeech();
  }, [current, voiceEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speakAbortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
      // Revoke all prefetched blob URLs
      audioCache.current.forEach(url => URL.revokeObjectURL(url));
      audioCache.current.clear();
    };
  }, []);

  const slide = slides[current];
  const progress = ((current + 1) / slides.length) * 100;

  const [animKey, setAnimKey] = useState(0);
  useEffect(() => setAnimKey(k => k + 1), [current]);

  // Compute estimated timings for progressive reveal synced to voice
  const lineTimings = slide ? estimateLineTimings(slide.heading, slide.body) : [];

  // Render markdown body with voice-synced progressive reveal
  const renderBody = (body: string) => {
    const lines = body.split("\n").filter(Boolean);
    return lines.map((line, i) => {
      const trimmed = line.trim();

      // When voice is enabled, sync animation to estimated speech timing
      // When muted, use fast stagger so content appears quickly
      const voiceDelay = voiceEnabled && lineTimings[i] !== undefined
        ? lineTimings[i] * 1000 // convert seconds to ms
        : 0;
      const fallbackDelay = 200 + i * 120; // fast stagger when muted
      const delay = `${voiceEnabled ? Math.max(200, voiceDelay) : fallbackDelay}ms`;
      const style = { animationDelay: delay };

      if (trimmed.startsWith("### ")) return (
        <h3 key={i} className="text-xl font-bold text-[#19544c] mt-8 mb-4 animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={style}>
          {trimmed.slice(4)}
        </h3>
      );
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) return (
        <div key={i} className="flex items-start gap-3 mb-4 animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={style}>
          <div className="h-2 w-2 rounded-full bg-[#71b59a] mt-2.5 shrink-0" />
          <span className="text-[#475569] text-base sm:text-lg leading-relaxed">
            {trimmed.slice(2).replace(/\*\*(.+?)\*\*/g, (_, m) => m)}
          </span>
        </div>
      );
      if (trimmed.startsWith('"') || trimmed.startsWith('\u201c')) return (
        <blockquote key={i} className="border-l-4 border-[#71b59a] pl-5 py-2 my-5 animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={style}>
          <p className="text-[#334155] italic text-base sm:text-lg">{trimmed}</p>
        </blockquote>
      );
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) return (
        <p key={i} className="text-[#19544c] font-semibold text-base sm:text-lg mb-3 animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={style}>
          {trimmed.replace(/\*\*/g, "")}
        </p>
      );
      return (
        <p key={i} className="text-[#475569] text-base sm:text-lg mb-3 leading-relaxed animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={style}>
          {trimmed.replace(/\*\*(.+?)\*\*/g, (_, m) => m)}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#E8E4DF] flex flex-col">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(113, 181, 154, 0.4); }
          50% { box-shadow: 0 0 20px 4px rgba(113, 181, 154, 0.15); }
        }
        @keyframes slideContentIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes completePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>

      {/* Top bar */}
      <div className="relative flex items-center justify-between h-12 px-4 sm:px-6 bg-[#19544c]">
        <div className="flex items-center gap-3">
          <Presentation className="h-4 w-4 text-[#71b59a]" />
          <span className="text-sm font-medium text-white/90 truncate">{title}</span>
          <span className="text-xs text-white/50">Slide {current + 1} of {slides.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setAutoPlay(!autoPlay); if (!autoPlay) clearAdvanceTimer(); }}
            className={cn("p-1.5 rounded-lg transition-colors", autoPlay ? "text-[#71b59a] hover:text-[#71b59a]/80" : "text-white/30 hover:text-white/50")}
            title={autoPlay ? "Disable auto-advance" : "Enable auto-advance"}>
            <SkipForward className="h-4 w-4" />
          </button>
          <button onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeech(); }}
            className={cn("p-1.5 rounded-lg transition-colors", voiceEnabled ? "text-[#71b59a] hover:text-[#71b59a]/80" : "text-white/30 hover:text-white/50")}
            title={voiceEnabled ? "Mute voiceover" : "Enable voiceover"}>
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          {speaking ? (
            <button onClick={stopSpeech} className="p-1.5 rounded-lg text-[#71b59a] hover:text-[#71b59a]/80" style={{ animation: "pulseGlow 2s ease-in-out infinite" }}>
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => {
              const speechText = buildSpeechText(slide.heading, slide.body);
              speak(speechText, current);
            }} className="p-1.5 rounded-lg text-white/50 hover:text-white/80">
              <Play className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => { stopSpeech(); onClose(); }} className="p-1.5 rounded-lg text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-[#19544c]/20">
        <div className="h-full bg-[#71b59a] transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Slide content */}
      <div className="relative flex-1 flex items-start justify-center px-4 sm:px-8 overflow-y-auto pt-8" key={animKey}>
        <div className={cn(
          "max-w-2xl w-full py-10 animate-[slideContentIn_0.5s_ease_forwards]",
          isIntro ? "text-center" : ""
        )}>
          {!isIntro && (
            <div className="animate-[fadeIn_0.3s_ease_forwards] opacity-0 mb-4">
              <span className="inline-block px-3 py-1 rounded-full bg-[#19544c]/10 text-[#19544c] text-xs font-medium tracking-wider uppercase">
                {current} of {slides.length - 1}
              </span>
            </div>
          )}

          {slide.heading && (
            <h2 className={cn(
              "font-bold text-[#19544c] animate-[scaleIn_0.5s_ease_forwards] opacity-0",
              isIntro ? "text-3xl sm:text-5xl mb-8" : "text-2xl sm:text-4xl mb-6"
            )} style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
              {slide.heading}
            </h2>
          )}

          {isIntro && (
            <div className="mx-auto w-16 h-1 rounded-full bg-[#71b59a] mb-8 animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={{ animationDelay: "200ms" }} />
          )}

          <div className={cn(isIntro ? "text-lg sm:text-xl" : "text-base sm:text-lg")}>
            {renderBody(slide.body)}
          </div>

          {isLastSlide && onComplete && (
            <div className="mt-10 text-center animate-[fadeSlideUp_0.6s_ease_forwards] opacity-0" style={{ animationDelay: "800ms" }}>
              <div className="inline-flex flex-col items-center gap-3">
                <div className="h-px w-24 bg-[#19544c]/20" />
                {isModuleComplete ? (
                  <div className="flex items-center gap-2 text-[#19544c]/60 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>Module completed</span>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="gap-2 px-8 bg-[#19544c] hover:bg-[#19544c]/90 text-white shadow-lg"
                    style={{ animation: "completePulse 2s ease-in-out infinite" }}
                    onClick={() => { stopSpeech(); onComplete(); }}
                  >
                    <CheckCircle className="h-5 w-5" />
                    Take the Quiz
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Powered by LCA Desk watermark */}
      <div className="absolute bottom-20 right-6 flex items-center gap-2 opacity-30 pointer-events-none select-none z-10">
        <span className="text-sm text-[#19544c] font-medium tracking-wide">Powered by</span>
        <Image src="/logo-full.svg" alt="LCA Desk" width={180} height={54} className="opacity-80" />
      </div>

      {/* Navigation */}
      <div className="relative flex items-center justify-between h-16 px-4 sm:px-8 bg-[#19544c]">
        <Button
          variant="ghost"
          onClick={() => { clearAdvanceTimer(); stopSpeech(); setCurrent(Math.max(0, current - 1)); }}
          disabled={current === 0}
          className="text-white/70 hover:text-white disabled:opacity-30 gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => { clearAdvanceTimer(); stopSpeech(); setCurrent(i); }}
              className={cn("h-2 rounded-full transition-all duration-300",
                i === current ? "w-8 bg-[#71b59a]" : i < current ? "w-2 bg-[#71b59a]/50" : "w-2 bg-white/20"
              )} />
          ))}
        </div>
        {isLastSlide && onComplete && !isModuleComplete ? (
          <Button
            onClick={() => { stopSpeech(); onComplete(); }}
            className="gap-1.5 bg-[#71b59a] hover:bg-[#71b59a]/90 text-white"
          >
            Take Quiz <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => { clearAdvanceTimer(); stopSpeech(); setCurrent(Math.min(slides.length - 1, current + 1)); }}
            disabled={isLastSlide}
            className="text-white/70 hover:text-white disabled:opacity-30 gap-1.5"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
