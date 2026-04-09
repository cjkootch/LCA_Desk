"use client";

import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { ReferralsPageContent } from "@/components/shared/ReferralsPage";

export default function SeekerReferralsPage() {
  return (
    <>
      <SeekerTopBar title="Referrals" description="Invite others and earn rewards" />
      <ReferralsPageContent />
    </>
  );
}
