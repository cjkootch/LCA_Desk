"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, ChevronRight, ChevronLeft, Volume2, VolumeX, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BriefingStep {
  id: string;
  title: string;
  narration: string;
  bullets: string[];
  target?: string;
  navigateTo?: string;
  position?: "left" | "right" | "top" | "bottom" | "center";
}

export const SECRETARIAT_BRIEFING: BriefingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Secretariat Dashboard",
    narration: "Welcome to LCA Desk. This is your command center for monitoring local content compliance across your jurisdiction. Over the next few minutes, I'll walk you through the key areas you'll use every day. You can pause or skip at any time.",
    bullets: [
      "This briefing covers 8 key areas of your dashboard",
      "Takes about 3 minutes",
      "Pause or skip anytime — you can replay from Support",
    ],
    position: "center",
  },
  {
    id: "submissions",
    title: "Submission Review Queue",
    narration: "This is your submission queue. Every Half-Yearly Report filed by a contractor or sub-contractor in your jurisdiction appears here. Reports arrive with a pending review status. You'll open each one, verify the data against supporting documents, and either approve it or send it back with comments. The queue is sorted by deadline proximity, so the most urgent filings appear first.",
    bullets: [
      "Half-Yearly Reports land here when filed",
      "Sorted by deadline — most urgent first",
      "Open to review, approve, or request corrections",
      "Status badges show where each filing stands",
    ],
    navigateTo: "/secretariat/dashboard",
    target: "[data-briefing='submissions']",
    position: "right",
  },
  {
    id: "review",
    title: "Reviewing a Filing",
    narration: "When you open a submission, you'll see the full filing broken into sections: expenditure records, employment data, capacity development, and the comparative analysis narrative. For expenditure, cross-reference supplier payments against LCS certificate numbers. For employment, verify that Guyanese percentages meet the minimums: 75 percent for managerial, 60 percent for technical, 80 percent for non-technical. The AI has already flagged potential issues, which appear as yellow warnings.",
    bullets: [
      "Expenditure: verify LCS certificate numbers",
      "Employment: check against 75% / 60% / 80% minimums",
      "Narrative: AI-generated, review for accuracy",
      "Yellow flags = potential compliance issues to investigate",
    ],
    navigateTo: "/secretariat/compliance",
    target: "[data-section='compliance']",
    position: "right",
  },
  {
    id: "compliance",
    title: "Compliance Monitoring",
    narration: "The compliance dashboard gives you a bird's-eye view of every entity in your jurisdiction. Green means they're meeting all requirements. Yellow means they're at risk — perhaps employment percentages are close to the minimum, or a deadline is approaching. Red means they've missed a deadline or are below required thresholds. Click any entity to drill into their specific compliance history.",
    bullets: [
      "Green = fully compliant",
      "Yellow = at risk, approaching minimums",
      "Red = missed deadline or below thresholds",
      "Click any entity to see their full history",
    ],
    navigateTo: "/secretariat/compliance",
    target: "[data-section='compliance']",
    position: "right",
  },
  {
    id: "register",
    title: "The LCS Register",
    narration: "The LCS Register is the official database of certified Guyanese suppliers. Contractors use this register to verify that their suppliers qualify for local content credit. From here, you can review new applications, renew certificates, and flag expired registrations. Every certificate has a unique LCSR number that contractors reference in their filings.",
    bullets: [
      "Official database of certified suppliers",
      "Review applications, renew certificates",
      "LCSR numbers link suppliers to filing data",
      "Expired certificates are flagged automatically",
    ],
    navigateTo: "/secretariat/suppliers",
    target: "[data-section='suppliers']",
    position: "right",
  },
  {
    id: "training",
    title: "Training & Course Management",
    narration: "You can create compliance training courses specific to your jurisdiction. The AI course builder generates complete modules from a few topic prompts — slides, diagrams, quizzes, and voice narration. Courses you publish here are available to all users in your market. This is a powerful tool for standardizing compliance knowledge across your industry.",
    bullets: [
      "Create jurisdiction-specific training courses",
      "AI builds slides, diagrams, and quizzes for you",
      "Published courses appear for all users in your market",
      "Use templates: Compliance Overview, Practical Guide, and more",
    ],
    navigateTo: "/secretariat/courses",
    target: "[data-section='courses']",
    position: "right",
  },
  {
    id: "team",
    title: "Team Management",
    narration: "Invite your colleagues to join the Secretariat dashboard. Each team member can be assigned specific review permissions. You control who can approve submissions, manage the register, and create training content. Only the team owner can change roles or remove members.",
    bullets: [
      "Invite reviewers with specific permissions",
      "Control who can approve, manage register, create courses",
      "Only the owner can change roles",
    ],
    navigateTo: "/secretariat/team",
    target: "[data-section='team']",
    position: "right",
  },
  {
    id: "ready",
    title: "Ready to Talk?",
    narration: "That completes your platform briefing. When you're ready to discuss how LCA Desk fits your jurisdiction, tap the contact button to reach me directly — by email, Teams, or WhatsApp. You can also view a tailored proposal I've prepared. Take your time exploring the dashboard. Every section has an info icon if you need more detail. Welcome to LCA Desk.",
    bullets: [
      "Tap the contact button to reach Cole directly",
      "View the tailored proposal for your jurisdiction",
      "Explore the dashboard — (i) icons explain each section",
      "Switch demo views anytime from the banner above",
    ],
    navigateTo: "/secretariat/dashboard",
    target: "[data-briefing='contact-card']",
    position: "left",
  },
];

interface PlatformBriefingProps {
  onComplete: () => void;
  steps?: BriefingStep[];
}

export function PlatformBriefing({ onComplete, steps = SECRETARIAT_BRIEFING }: PlatformBriefingProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  useEffect(() => { currentRef.current = current; }, [current]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchCache = useRef<Map<number, Blob>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const progress = ((current + 1) / steps.length) * 100;

  // Try each comma-separated selector until one matches a visible element
  const findAndSetSpotlight = useCallback((target?: string) => {
    if (!target) { setSpotlightRect(null); return; }
    const selectors = target.split(",").map(s => s.trim());
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setSpotlightRect(rect);
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
      } catch {}
    }
    setSpotlightRect(null);
  }, []);

  // Navigate if needed, then find spotlight target
  useEffect(() => {
    const needsNav = step.navigateTo && pathname !== step.navigateTo;
    if (needsNav) {
      router.push(step.navigateTo!);
      // Wait for the new page to render before measuring
      const timer = setTimeout(() => {
        if (mountedRef.current) findAndSetSpotlight(step.target);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        if (mountedRef.current) findAndSetSpotlight(step.target);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch the next step's audio
  const prefetchStep = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= steps.length || prefetchCache.current.has(idx)) return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: steps[idx].narration, voice: "nova" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        prefetchCache.current.set(idx, blob);
      }
    } catch {}
  }, [steps]);

  const speak = useCallback(async (text: string) => {
    if (!audioEnabled || !text) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(true);

    // Check prefetch cache first for instant playback
    const cachedBlob = prefetchCache.current.get(current);
    let blob: Blob | null = cachedBlob || null;

    if (!blob) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "nova" }),
        });
        if (!res.ok || !mountedRef.current) { setSpeaking(false); return; }
        blob = await res.blob();
      } catch {
        if (mountedRef.current) setSpeaking(false);
        return;
      }
    }

    if (!mountedRef.current || !blob) { setSpeaking(false); return; }
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (!mountedRef.current) return;
        setSpeaking(false);
        // Auto-advance to next step after audio ends
        if (currentRef.current < steps.length - 1) {
          setTimeout(() => {
            if (mountedRef.current) setCurrent(c => Math.min(c + 1, steps.length - 1));
          }, 1500);
        }
      };
      audio.onerror = () => { URL.revokeObjectURL(url); if (mountedRef.current) setSpeaking(false); };
      audio.play().catch(() => { setSpeaking(false); });
    } catch {
      if (mountedRef.current) setSpeaking(false);
    }
  }, [audioEnabled, current, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure spotlight on scroll (user might scroll while on a step)
  useEffect(() => {
    if (!spotlightRect) return;
    const step = steps[current];
    if (!step?.target) return;
    const handler = () => {
      try {
        const el = document.querySelector(step.target!);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) setSpotlightRect(rect);
        }
      } catch {}
    };
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [current, spotlightRect, steps]);

  // Speak on step change + prefetch next
  useEffect(() => {
    speak(step.narration);
    prefetchStep(current + 1);
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSpeaking(false);
    };
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch step 1 audio immediately on mount
  useEffect(() => { prefetchStep(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(false);
  };

  const next = () => { stopAudio(); setCurrent(c => Math.min(c + 1, steps.length - 1)); };
  const prev = () => { stopAudio(); setCurrent(c => Math.max(c - 1, 0)); };
  const skip = () => { stopAudio(); onComplete(); };

  // Card positioning
  const getCardStyle = (): React.CSSProperties => {
    const padding = 24;
    const cardWidth = 380;

    if (!spotlightRect || step.position === "center") {
      return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: cardWidth };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    switch (step.position) {
      case "right": {
        const left = Math.min(spotlightRect.right + padding, vw - cardWidth - 16);
        const top = Math.max(16, Math.min(spotlightRect.top, vh - 480));
        return { position: "fixed", top, left, width: cardWidth };
      }
      case "left": {
        const right = Math.max(16, vw - spotlightRect.left + padding);
        const top = Math.max(16, Math.min(spotlightRect.top, vh - 480));
        return { position: "fixed", top, right, width: cardWidth };
      }
      case "bottom": {
        const top = Math.min(spotlightRect.bottom + padding, vh - 480);
        const left = Math.max(16, Math.min(spotlightRect.left, vw - cardWidth - 16));
        return { position: "fixed", top, left, width: cardWidth };
      }
      default:
        return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: cardWidth };
    }
  };

  // On mobile: full-screen modal, no spotlight
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[300] bg-bg-card flex flex-col" aria-modal="true" role="dialog" aria-label="Platform Briefing">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/10">
              <Shield className="h-3.5 w-3.5 text-accent" />
            </div>
            <span className="text-xs text-text-muted font-medium">
              Platform Briefing · {current + 1} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (audioEnabled) stopAudio(); setAudioEnabled(!audioEnabled); }}
              className="p-1.5 rounded-lg hover:bg-bg-primary transition-colors"
              title={audioEnabled ? "Mute narration" : "Enable narration"}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4 text-accent" /> : <VolumeX className="h-4 w-4 text-text-muted" />}
            </button>
            <button onClick={skip} className="p-1.5 rounded-lg hover:bg-bg-primary transition-colors" title="Close briefing">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-bg-primary overflow-hidden">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <h3 className="text-xl font-heading font-bold text-text-primary mb-4">{step.title}</h3>
          <ul className="space-y-3 mb-6">
            {step.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {speaking && (
            <div className="flex items-center gap-2 text-xs text-accent">
              <div className="flex gap-0.5 items-end h-4">
                {[0, 150, 300, 100, 200].map((delay, i) => (
                  <div key={i} className={cn("w-1 rounded-full bg-accent/70 animate-pulse", ["h-3","h-4","h-2.5","h-3.5","h-2"][i])} style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
              <span>Narrating...</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-5 pb-8 pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={prev} disabled={isFirst} className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {isLast ? (
              <button onClick={onComplete} className="flex items-center gap-1.5 bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors">
                Get Started
              </button>
            ) : (
              <button onClick={next} className="flex items-center gap-1.5 bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          {!isLast && (
            <button onClick={skip} className="w-full text-center text-xs text-text-muted hover:text-text-secondary transition-colors">
              Skip briefing
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300]" aria-modal="true" role="dialog" aria-label="Platform Briefing">
      {/* Backdrop with optional spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/60 transition-all duration-500"
        style={spotlightRect ? {
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${spotlightRect.top - 12}px,
            ${spotlightRect.left - 12}px ${spotlightRect.top - 12}px,
            ${spotlightRect.left - 12}px ${spotlightRect.bottom + 12}px,
            ${spotlightRect.right + 12}px ${spotlightRect.bottom + 12}px,
            ${spotlightRect.right + 12}px ${spotlightRect.top - 12}px,
            0% ${spotlightRect.top - 12}px
          )`,
        } : undefined}
        onClick={skip}
      />

      {/* Spotlight border glow */}
      {spotlightRect && (
        <div
          className="absolute border-2 border-accent/60 rounded-xl pointer-events-none"
          style={{
            top: spotlightRect.top - 12,
            left: spotlightRect.left - 12,
            width: spotlightRect.width + 24,
            height: spotlightRect.height + 24,
            boxShadow: "0 0 30px rgba(113, 181, 154, 0.3)",
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Briefing card */}
      <div
        className="absolute bg-bg-card border border-border rounded-2xl shadow-2xl p-6 w-[380px] max-w-[90vw]"
        style={{
          ...getCardStyle(),
          transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent/10">
              <Shield className="h-3.5 w-3.5 text-accent" />
            </div>
            <span className="text-xs text-text-muted font-medium">
              Platform Briefing · {current + 1} of {steps.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (audioEnabled) stopAudio();
                setAudioEnabled(!audioEnabled);
              }}
              className="p-1.5 rounded-lg hover:bg-bg-primary transition-colors"
              title={audioEnabled ? "Mute narration" : "Enable narration"}
            >
              {audioEnabled
                ? <Volume2 className="h-4 w-4 text-accent" />
                : <VolumeX className="h-4 w-4 text-text-muted" />
              }
            </button>
            <button onClick={skip} className="p-1.5 rounded-lg hover:bg-bg-primary transition-colors" title="Close briefing">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-bg-primary rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <h3 className="text-lg font-heading font-bold text-text-primary mb-3">{step.title}</h3>
        <ul className="space-y-2 mb-5">
          {step.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
              <div className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Speaking indicator */}
        {speaking && (
          <div className="flex items-center gap-2 mb-4 text-xs text-accent">
            <div className="flex gap-0.5 items-end h-4">
              {[0, 150, 300, 100, 200].map((delay, i) => (
                <div
                  key={i}
                  className={cn("w-1 rounded-full bg-accent/70 animate-pulse", [
                    "h-3", "h-4", "h-2.5", "h-3.5", "h-2",
                  ][i])}
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span>Narrating...</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={isFirst}
            className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          {isLast ? (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 bg-accent text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-1.5 bg-accent text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isLast && (
          <button
            onClick={skip}
            className="w-full text-center text-xs text-text-muted hover:text-text-secondary mt-3 transition-colors"
          >
            Skip briefing
          </button>
        )}
      </div>
    </div>
  );
}
