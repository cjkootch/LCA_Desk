"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { fetchMyReferralInfo } from "@/server/actions";

export default function EarningsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyReferralInfo().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;

  const referrals = data?.referrals || [];
  const converted = referrals.filter((r: { status: string }) => r.status === "rewarded");
  const totalEarned = converted.reduce((s: number, r: { commissionAmount?: string }) => s + Number(r.commissionAmount || 0), 0);
  const totalPaid = converted.filter((r: { commissionPaidAt?: string }) => r.commissionPaidAt).reduce((s: number, r: { commissionAmount?: string }) => s + Number(r.commissionAmount || 0), 0);
  const pending = totalEarned - totalPaid;

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <DollarSign className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Earnings</h1>
          <p className="text-sm text-text-secondary">Track your commissions and payout history</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 text-center bg-gradient-to-br from-gold/5 to-transparent">
          <TrendingUp className="h-4 w-4 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold text-gold">${totalEarned.toFixed(0)}</p>
          <p className="text-xs text-text-muted">Total Earned</p>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="h-4 w-4 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-warning">${pending.toFixed(0)}</p>
          <p className="text-xs text-text-muted">Pending Payout</p>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-success/5 to-transparent">
          <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">${totalPaid.toFixed(0)}</p>
          <p className="text-xs text-text-muted">Paid Out</p>
        </Card>
      </div>

      {/* Commission history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          {converted.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No commissions yet. Refer businesses to start earning.</p>
          ) : (
            <div className="space-y-2">
              {converted.map((r: { id: string; referredEmail: string | null; commissionAmount?: string; commissionPaidAt?: string; convertedPlan?: string; rewardedAt?: string }) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{r.referredEmail || "—"}</p>
                    <p className="text-xs text-text-muted">
                      {r.convertedPlan && `${r.convertedPlan} plan · `}
                      {r.rewardedAt ? new Date(r.rewardedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gold">${Number(r.commissionAmount || 0).toFixed(2)}</span>
                    <Badge variant={r.commissionPaidAt ? "success" : "warning"} className="text-xs">
                      {r.commissionPaidAt ? "Paid" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-text-muted mt-4 text-center">
        Payouts are processed monthly. Contact us at hello@lcadesk.com for payout questions.
      </p>
    </div>
  );
}
