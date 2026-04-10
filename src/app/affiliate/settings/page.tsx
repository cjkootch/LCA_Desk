"use client";

import { useEffect, useState } from "react";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { ReferralCard } from "@/components/settings/ReferralCard";
import { CancelAccount } from "@/components/settings/CancelAccount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, DollarSign, Save } from "lucide-react";
import { fetchUserSettings, updateUserSettings } from "@/server/actions";
import { toast } from "sonner";

export default function AffiliateSettingsPage() {
  const [payoutEmail, setPayoutEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserSettings().then(u => {
      if (u?.affiliatePayoutEmail) setPayoutEmail(u.affiliatePayoutEmail);
    }).catch(() => {});
  }, []);

  const handleSavePayout = async () => {
    setSaving(true);
    try {
      await updateUserSettings({ affiliatePayoutEmail: payoutEmail });
      toast.success("Payout email saved");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">Manage your affiliate account and payout preferences</p>
        </div>
      </div>
      <div className="space-y-5">
        <ProfileSettings />

        {/* Payout settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Payout Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 block">Payout Email (PayPal)</label>
              <Input value={payoutEmail} onChange={e => setPayoutEmail(e.target.value)} placeholder="your-paypal@email.com" />
              <p className="text-xs text-text-muted mt-1">Commissions are paid monthly via PayPal to this email.</p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSavePayout} loading={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Save Payout Info
              </Button>
            </div>
          </CardContent>
        </Card>

        <ReferralCard />
        <CancelAccount hasPaidPlan={false} userType="filer" />
      </div>
    </div>
  );
}
