"use client";

import { TopBar } from "@/components/layout/TopBar";
import { ReferralsPageContent } from "@/components/shared/ReferralsPage";

export default function FilerReferralsPage() {
  return (
    <div>
      <TopBar title="Referrals" description="Invite others and earn rewards" />
      <ReferralsPageContent />
    </div>
  );
}
