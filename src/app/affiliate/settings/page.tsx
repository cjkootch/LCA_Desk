"use client";

import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { ReferralCard } from "@/components/settings/ReferralCard";
import { CancelAccount } from "@/components/settings/CancelAccount";
import { Settings } from "lucide-react";

export default function AffiliateSettingsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">Manage your affiliate account</p>
        </div>
      </div>
      <div className="space-y-5">
        <ProfileSettings />
        <ReferralCard />
        <CancelAccount hasPaidPlan={false} userType="filer" />
      </div>
    </div>
  );
}
