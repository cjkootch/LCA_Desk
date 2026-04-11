"use client";

import { ReferralsPageContent } from "@/components/shared/ReferralsPage";

export default function AffiliateReferralsPage() {
  return (
    <div>
      <div className="border-b border-border bg-bg-surface px-6 py-4">
        <h1 className="text-lg font-bold text-text-primary">Referrals</h1>
        <p className="text-sm text-text-muted">Share your link and earn commissions on every converted referral.</p>
      </div>
      <ReferralsPageContent />
    </div>
  );
}
