"use client";

import { Sparkles, FileText, ClipboardCheck, BarChart3, Bot, Shield, PieChart, UserPlus, CheckCircle } from "lucide-react";
import { PortalTour, type TourStep } from "./PortalTour";

const STEPS: TourStep[] = [
  {
    title: "Welcome to the Secretariat Portal",
    description: "Your regulatory command center for reviewing submissions, tracking compliance, and monitoring the petroleum sector's local content performance.",
    icon: Shield,
  },
  {
    title: "Submission Review",
    description: "All filed reports appear here. Review compliance metrics, employment breakdowns, and attestation details. Acknowledge, approve, reject, or request amendments.",
    icon: FileText,
    extra: (
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Review", desc: "Full compliance data" },
          { label: "Acknowledge", desc: "Confirm receipt" },
          { label: "Amend", desc: "Request corrections" },
          { label: "Approve", desc: "Accept submission" },
        ].map(a => (
          <div key={a.label} className="rounded-lg bg-bg-primary p-2 text-center">
            <p className="text-xs font-semibold text-gold">{a.label}</p>
            <p className="text-[9px] text-text-muted">{a.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Filing Compliance Tracker",
    description: "See which companies have filed vs who's overdue. Filter by year, report type, and status. Color-coded: green (submitted), yellow (in progress), red (not filed).",
    icon: ClipboardCheck,
  },
  {
    title: "Sector Reports",
    description: "Customizable dashboard with 12 toggleable widgets. Choose which KPIs to display. Export as PDF for ministerial briefings. Generate AI executive summaries with one click.",
    icon: PieChart,
    extra: (
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        {[
          { label: "Local Spend", color: "text-success" },
          { label: "Jobs Created", color: "text-accent" },
          { label: "Hours Saved", color: "text-gold" },
          { label: "Economic Impact", color: "text-text-primary" },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-bg-primary p-2">
            <p className={`text-xs font-bold ${k.color}`}>{k.label}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Market Intelligence",
    description: "Analytics on procurement opportunities, employment notices, and job seeker data. Pin high-priority notices, add internal notes, and moderate content.",
    icon: BarChart3,
  },
  {
    title: "LCS Applications",
    description: "Review LCS certificate registration applications submitted through LCA Desk. Download documents, verify information, and approve with a certificate ID.",
    icon: UserPlus,
  },
  {
    title: "Compliance Analyst AI",
    description: "Your AI assistant trained on sector-wide compliance data. Ask about violations, enforcement options, amendment language, or compliance trends — with real numbers.",
    icon: Bot,
    extra: (
      <div className="mt-4 space-y-2">
        <div className="rounded-lg bg-[#1e293b] text-white px-3 py-2 text-xs ml-auto max-w-[80%]">
          Which companies are below the 75% managerial employment minimum?
        </div>
        <div className="rounded-lg bg-bg-primary border border-border px-3 py-2 text-xs max-w-[90%]">
          Based on current submissions, 3 entities are below the managerial threshold...
        </div>
      </div>
    ),
  },
  {
    title: "You're All Set!",
    description: "Review pending submissions, monitor sector KPIs, and use the AI analyst for regulatory decisions. Your data updates in real-time as filers submit reports.",
    icon: CheckCircle,
  },
];

export function SecretariatTour() {
  return <PortalTour steps={STEPS} storageKey="lca-desk-secretariat-tour-completed" />;
}
