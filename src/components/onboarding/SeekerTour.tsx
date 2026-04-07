"use client";

import { Sparkles, Search, FileText, GraduationCap, User, Briefcase, CheckCircle, BookOpen } from "lucide-react";
import { PortalTour, type TourStep } from "./PortalTour";

const STEPS: TourStep[] = [
  {
    title: "Welcome to LCA Desk",
    description: "Your portal for finding petroleum sector jobs in Guyana, building your professional profile, and getting LCA-certified. Let's show you around.",
    icon: Sparkles,
  },
  {
    title: "Find Jobs",
    description: "Browse jobs posted by contractors and scraped from the LCS employment notices. Filter by category, company, and location. Apply directly through the platform.",
    icon: Search,
    extra: (
      <div className="mt-4 grid grid-cols-2 gap-2">
        {["Company-Posted Jobs", "LCS Employment Notices", "Filter by Category", "One-Click Apply"].map(f => (
          <div key={f} className="rounded-lg bg-bg-primary p-2 text-center">
            <p className="text-[10px] text-text-secondary">{f}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Build Your Resume",
    description: "Use the AI-powered resume builder to create a petroleum-sector-ready CV. Extract from existing documents, generate from scratch, or enhance what you have.",
    icon: FileText,
  },
  {
    title: "Your Professional Profile",
    description: "Complete your profile with employment category, certifications (BOSIET, HUET, H2S), education, and skills. Opt into the Talent Pool so contractors can find you.",
    icon: User,
    extra: (
      <div className="mt-4 rounded-lg border border-accent/20 bg-accent-light p-3">
        <p className="text-xs text-accent font-medium mb-1">Talent Pool</p>
        <p className="text-[11px] text-text-secondary">When you opt in, contractors browsing the Talent Pool can see your profile, skills, and certifications. Your contact info is only visible to Professional plan subscribers.</p>
      </div>
    ),
  },
  {
    title: "Browse Opportunities",
    description: "See 190+ procurement notices from the LCS. Even as a job seeker, understanding which companies are active helps you target your applications.",
    icon: Briefcase,
  },
  {
    title: "Learn & Get Certified",
    description: "Take the LCA Fundamentals course to understand the Local Content Act. Pass the quizzes to earn your \"LCA Certified\" badge — visible to employers on your profile.",
    icon: GraduationCap,
    extra: (
      <div className="mt-4 space-y-2">
        {[
          { badge: "LCA Certified", color: "text-accent", desc: "Understand the Act" },
          { badge: "Supplier Certified", color: "text-success", desc: "Supply chain knowledge" },
        ].map(b => (
          <div key={b.badge} className="flex items-center gap-2 text-xs">
            <CheckCircle className={`h-3 w-3 ${b.color}`} />
            <span className="font-medium">{b.badge}</span>
            <span className="text-text-muted">— {b.desc}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "You're Ready!",
    description: "Complete your profile, browse jobs, and take the LCA Fundamentals course. The more complete your profile, the more visible you are to contractors.",
    icon: CheckCircle,
    extra: (
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-accent-light p-2.5 text-center">
          <User className="h-4 w-4 text-accent mx-auto mb-1" />
          <p className="text-xs font-medium text-accent">Complete Profile</p>
        </div>
        <div className="rounded-lg bg-accent-light p-2.5 text-center">
          <BookOpen className="h-4 w-4 text-accent mx-auto mb-1" />
          <p className="text-xs font-medium text-accent">Take a Course</p>
        </div>
      </div>
    ),
  },
];

export function SeekerTour() {
  return <PortalTour steps={STEPS} storageKey="lca-desk-seeker-tour-completed" />;
}
