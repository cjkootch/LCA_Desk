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

export const FILER_BRIEFING: BriefingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Compliance Dashboard",
    narration: "Welcome to LCA Desk. This is your compliance command center for managing local content filings under the Local Content Act. Over the next few minutes, I'll walk you through the key areas you'll use to prepare and submit your Half-Yearly Reports. You can pause or skip at any time.",
    bullets: [
      "This briefing covers 7 key areas of your dashboard",
      "Takes about 3 minutes",
      "Pause or skip anytime — replay from Settings",
    ],
    position: "center",
  },
  {
    id: "entities",
    title: "Your Entities",
    narration: "Entities are the companies or projects you file reports for. Most contractors have one entity, but if you operate subsidiaries or joint ventures, each may need its own filing. Your first step is always to add your entity with its legal name, LCS Certificate number, and contact details.",
    bullets: [
      "Each entity files its own Half-Yearly Report",
      "Add your company name, LCS Certificate ID, and contacts",
      "Most users have one entity — JVs may need separate ones",
    ],
    target: '[data-briefing="entities"], [data-section="entities"]',
    position: "right",
  },
  {
    id: "filing",
    title: "The Filing Workflow",
    narration: "Once your entity is set up, you'll work through a guided 7-step filing process. You'll enter expenditure records showing how much you spent with local versus international suppliers, employment data breaking down your workforce by category and Guyanese percentage, and capacity development activities. The platform validates your data against LCA requirements as you go.",
    bullets: [
      "7-step guided process from data entry to submission",
      "Expenditure: local vs international supplier spend",
      "Employment: Guyanese percentages by category",
      "Capacity development: training and skills investment",
    ],
    navigateTo: "/dashboard/entities",
    target: "main table, main > div > div, [data-section]",
    position: "right",
  },
  {
    id: "narrative",
    title: "AI Narrative Drafting",
    narration: "This is where LCA Desk saves you the most time. Once your data is entered, the AI generates your Comparative Analysis narrative — the written portion of your Half-Yearly Report that explains your local content performance. It references your actual data, cites the correct sections of the Act, and produces a first draft in under a minute. You review, edit, and approve it.",
    bullets: [
      "AI drafts your Comparative Analysis from your data",
      "References actual numbers and LCA sections",
      "First draft in under a minute",
      "Review, edit, and approve before submission",
    ],
    position: "center",
  },
  {
    id: "expert",
    title: "Ask the LCA Expert",
    narration: "Have a question about the Act, a filing deadline, or what data to report? The LCA Expert is an AI assistant trained on the full Local Content Act and its regulations. Ask it anything — it gives you cited answers with section references. Think of it as having a compliance consultant available 24/7.",
    bullets: [
      "AI trained on the full Local Content Act",
      "Cited answers with section references",
      "Ask about deadlines, requirements, or penalties",
      "Available 24/7 — no waiting for a consultant",
    ],
    navigateTo: "/dashboard/expert",
    target: "main",
    position: "center",
  },
  {
    id: "training",
    title: "Compliance Training",
    narration: "The training section has courses designed to help you understand your obligations under the Act. The LCA Fundamentals course covers everything from employment categories to the LCS Register. Each course has voice-narrated slides, interactive diagrams, and quizzes. Completing courses earns you badges that demonstrate compliance knowledge.",
    bullets: [
      "LCA Fundamentals and other compliance courses",
      "Voice-narrated slides with interactive diagrams",
      "Quizzes test your understanding",
      "Earn badges to demonstrate compliance knowledge",
    ],
    navigateTo: "/dashboard/training",
    target: "main",
    position: "center",
  },
  {
    id: "calendar",
    title: "Deadlines & Calendar",
    narration: "Never miss a filing deadline. The compliance calendar shows all your upcoming due dates with color-coded urgency. H1 reports covering January through June are due July 30th. H2 reports covering July through December are due January 30th. The platform sends you reminders at 30, 14, and 7 days before each deadline.",
    bullets: [
      "H1 due July 30 — H2 due January 30",
      "Color-coded: green on track, orange soon, red overdue",
      "Automatic reminders at 30, 14, and 7 days out",
    ],
    target: '[data-briefing="deadlines"], [data-section="deadlines"], .compliance-calendar',
    position: "right",
  },
  {
    id: "ready",
    title: "You're Ready to File",
    narration: "That's your platform briefing complete. Your next step is to add your first entity — it takes about 2 minutes. From there, the platform guides you through every step of your filing. If you need help at any point, the LCA Expert is one click away, and info icons throughout the dashboard explain each section. Good luck with your filing.",
    bullets: [
      "Add your first entity to get started (2 minutes)",
      "The platform guides you through every step",
      "LCA Expert available for any questions",
      "Look for (i) icons for section explanations",
    ],
    position: "center",
  },
];

export const SEEKER_BRIEFING: BriefingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Job Portal",
    narration: "Welcome to LCA Desk. This portal connects you with job opportunities in Guyana's petroleum sector. Over the next few minutes, I'll show you how to find jobs, track applications, build your resume, and develop your skills through compliance training. Let's get started.",
    bullets: [
      "Find petroleum sector jobs in your jurisdiction",
      "Track applications and get status updates",
      "Build your resume and earn training badges",
    ],
    position: "center",
  },
  {
    id: "jobs",
    title: "Find Jobs",
    narration: "The job board shows current openings across the petroleum sector. You can filter by category, company, and location. Each listing shows the role, requirements, and whether the position prioritizes Guyanese nationals under the Local Content Act. Tap any job to see full details and apply directly.",
    bullets: [
      "Filter by category, company, and location",
      "See which roles prioritize Guyanese nationals",
      "Apply directly from the listing",
    ],
    target: '[href="/seeker/jobs"]',
    position: "right",
  },
  {
    id: "opportunities",
    title: "Procurement Opportunities",
    narration: "Beyond jobs, the opportunities board shows procurement tenders and contracts from operators and contractors. If you're also a business owner or thinking of starting one, these are the contracts being awarded in the petroleum sector right now.",
    bullets: [
      "Procurement tenders from operators and contractors",
      "See what's being contracted in the sector",
      "Useful for business owners and entrepreneurs",
    ],
    target: '[href="/seeker/opportunities"]',
    position: "right",
  },
  {
    id: "applications",
    title: "Track Your Applications",
    narration: "Every job you apply for is tracked here. You'll see the status of each application — whether it's been received, is under review, or has a decision. You'll also get notifications when your status changes.",
    bullets: [
      "See all your submitted applications",
      "Track status: received, under review, decision",
      "Get notified when status changes",
    ],
    target: '[href="/seeker/applications"]',
    position: "right",
  },
  {
    id: "resume",
    title: "Resume Builder",
    narration: "Build a resume tailored to the petroleum sector. The builder helps you highlight relevant skills, certifications, and experience that employers in the oil and gas industry are looking for. You can export it as a PDF to attach to applications.",
    bullets: [
      "Tailored to petroleum sector employers",
      "Highlight relevant certifications and skills",
      "Export as PDF for applications",
    ],
    target: '[href="/seeker/resume"]',
    position: "right",
  },
  {
    id: "training",
    title: "Compliance Training",
    narration: "Earn badges by completing training courses. The LCA Fundamentals course teaches you your rights under the Local Content Act — equal pay, first consideration for Guyanese nationals, and capacity development obligations. Badges on your profile show employers you understand the compliance landscape.",
    bullets: [
      "LCA Fundamentals and other courses",
      "Learn your rights under the Local Content Act",
      "Earn badges that show on your profile",
    ],
    target: '[href="/seeker/learn"]',
    position: "right",
  },
  {
    id: "ready",
    title: "Start Exploring",
    narration: "That's your portal overview. Start by browsing the job board — new listings are added regularly as operators and contractors post positions. If you have questions about your rights under the Local Content Act, check the training section. Good luck with your job search.",
    bullets: [
      "Browse the job board for current openings",
      "Complete LCA Fundamentals to understand your rights",
      "Check back regularly — new jobs posted often",
    ],
    position: "center",
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
  const abortRef = useRef<AbortController | null>(null);
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

  // Try each comma-separated selector — scroll into view first, measure after scroll settles
  const findAndSetSpotlight = useCallback((target?: string) => {
    if (!target) { setSpotlightRect(null); return; }
    const selectors = target.split(",").map(s => s.trim());
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          // Scroll element into view first
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Measure AFTER scroll animation settles
          setTimeout(() => {
            if (!mountedRef.current) return;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              setSpotlightRect(rect);
            } else {
              setSpotlightRect(null);
            }
          }, 600);
          return;
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
    // Stop any previous audio and abort in-flight fetch
    stopAudio();
    const controller = new AbortController();
    abortRef.current = controller;
    setSpeaking(true);

    // Check prefetch cache first for instant playback
    const cachedBlob = prefetchCache.current.get(currentRef.current);
    let blob: Blob | null = cachedBlob || null;

    if (!blob) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "nova" }),
          signal: controller.signal,
        });
        if (!res.ok || !mountedRef.current || controller.signal.aborted) { setSpeaking(false); return; }
        blob = await res.blob();
        if (controller.signal.aborted) { setSpeaking(false); return; }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (mountedRef.current) setSpeaking(false);
        return;
      }
    }

    if (!mountedRef.current || !blob || controller.signal.aborted) { setSpeaking(false); return; }
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
      stopAudio();
    };
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch step 1 audio immediately on mount
  useEffect(() => { prefetchStep(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopAudio = () => {
    // Abort any in-flight TTS fetch
    abortRef.current?.abort();
    abortRef.current = null;
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
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
