"use client";

import { TopBar } from "@/components/layout/TopBar";
import { LcaExpertChat } from "@/components/ai/LcaExpertChat";

export default function ExpertPage() {
  return (
    <div>
      <TopBar title="Ask the LCA Expert" description="AI-powered compliance assistant trained on the Local Content Act" />
      <LcaExpertChat />
    </div>
  );
}
