"use client";

import { Sparkles, Briefcase, UserCog, BarChart3, Shield, Send, CheckCircle } from "lucide-react";
import { PortalTour, type TourStep } from "./PortalTour";

const STEPS: TourStep[] = [
  {
    title: "Welcome to the Supplier Portal",
    description: "Your hub for getting discovered by contractors, responding to procurement opportunities, and growing your business in Guyana's petroleum sector.",
    icon: Sparkles,
  },
  {
    title: "Your LCS Verification",
    description: "Your LCS Certificate status is front and center. Contractors use this to verify that procurement from you counts toward their Local Content Rate.",
    icon: Shield,
    extra: (
      <div className="mt-4 rounded-lg bg-success/5 border border-success/20 p-3">
        <p className="text-xs text-success font-medium mb-1">Why verification matters</p>
        <p className="text-[11px] text-text-secondary">Every dollar contractors spend with LCS-verified suppliers counts toward their compliance score. Your certificate is your competitive advantage.</p>
      </div>
    ),
  },
  {
    title: "Browse Opportunities",
    description: "190+ procurement notices from the LCS — RFQs, EOIs, RFPs. Filter by type, search by company. Express interest with one click.",
    icon: Briefcase,
    extra: (
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-bg-primary p-2"><p className="text-lg font-bold text-accent">190+</p><p className="text-[9px] text-text-muted">Notices</p></div>
        <div className="rounded-lg bg-bg-primary p-2"><p className="text-lg font-bold text-success">3/mo</p><p className="text-[9px] text-text-muted">Free Responses</p></div>
        <div className="rounded-lg bg-bg-primary p-2"><p className="text-lg font-bold text-gold">$99</p><p className="text-[9px] text-text-muted">Pro Unlimited</p></div>
      </div>
    ),
  },
  {
    title: "Respond to Opportunities",
    description: "When you find a relevant opportunity, click Respond to express interest. Add a cover note describing your capabilities. Free plan: 3 responses per month. Pro: unlimited.",
    icon: Send,
  },
  {
    title: "Build Your Profile",
    description: "A complete profile wins contracts. Add your service categories, contact info, employee count, and Guyanese ownership status. Pro members can add a capability statement.",
    icon: UserCog,
  },
  {
    title: "Track & Grow (Pro)",
    description: "Supplier Pro gives you analytics — see who views your profile, track your response pipeline (interested → awarded), and get priority placement in search results.",
    icon: BarChart3,
    extra: (
      <div className="mt-4 grid grid-cols-4 gap-1 text-center">
        {["Interested", "Contacted", "Shortlisted", "Awarded"].map((s, i) => (
          <div key={s}>
            <div className="h-6 w-6 mx-auto rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">{i + 1}</div>
            <p className="text-[8px] text-text-muted mt-0.5">{s}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "You're All Set!",
    description: "Complete your profile, browse opportunities, and start responding. The more active you are, the higher you rank when contractors search for suppliers.",
    icon: CheckCircle,
  },
];

export function SupplierTour() {
  return <PortalTour steps={STEPS} storageKey="lca-desk-supplier-tour-completed" />;
}
