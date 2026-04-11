"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ProposalPage() {
  return (
    <div className="min-h-screen bg-[#0B1B18]">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/secretariat/dashboard" className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src="/logo-white.svg" alt="LCA Desk" style={{ height: 28 }} />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-white">Compliance Command Center</p>
          <p className="text-xs text-white/40">Proposal by Cole Kutschinski</p>
        </div>
      </div>

      {/* Embedded Canva presentation */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div style={{
          position: "relative",
          width: "100%",
          height: 0,
          paddingTop: "56.25%",
          paddingBottom: 0,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          overflow: "hidden",
          borderRadius: 12,
        }}>
          <iframe
            loading="lazy"
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
              border: "none",
              padding: 0,
              margin: 0,
            }}
            src="https://www.canva.com/design/DAHGewCuaec/nNE89is9dlacn6QndL3arA/view?embed"
            allowFullScreen
            allow="fullscreen"
          />
        </div>

        {/* CTA below presentation */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://teams.microsoft.com/l/chat/0/0?users=Cole@lcadesk.com&message=Hi%20Cole%2C%20I%27ve%20reviewed%20the%20proposal%20and%20I%27d%20like%20to%20discuss%20next%20steps."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#5B5FC7] text-white text-sm font-semibold hover:bg-[#4B4FB7] transition-colors"
          >
            Schedule a Discussion
          </a>
          <a
            href="https://wa.me/18324927169?text=Hi%20Cole%2C%20I%27ve%20reviewed%20the%20proposal%20and%20I%27d%20like%20to%20discuss."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1DA851] transition-colors"
          >
            Message on WhatsApp
          </a>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          Cole Kutschinski · Founder, LCA Desk · Cole@lcadesk.com
        </p>
      </div>
    </div>
  );
}
