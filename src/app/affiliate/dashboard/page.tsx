"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, TrendingUp, Gift, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { fetchMyReferralInfo } from "@/server/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AffiliateDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyReferralInfo().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" /></div>;

  const totalCommission = data?.referrals?.reduce((s: number, r: { commissionAmount?: string }) =>
    s + Number(r.commissionAmount || 0), 0) || 0;
  const pendingCommission = data?.referrals?.filter((r: { status: string; commissionPaidAt?: string }) =>
    r.status === "rewarded" && !r.commissionPaidAt).reduce((s: number, r: { commissionAmount?: string }) =>
    s + Number(r.commissionAmount || 0), 0) || 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <Gift className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Affiliate Dashboard</h1>
          <p className="text-sm text-text-secondary">Track your referrals, conversions, and earnings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-4 text-center">
          <Users className="h-4 w-4 text-text-muted mx-auto mb-1" />
          <p className="text-2xl font-bold text-text-primary">{data?.totalReferred || 0}</p>
          <p className="text-xs text-text-muted">Total Referrals</p>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-success/5 to-transparent">
          <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">{data?.totalSignedUp || 0}</p>
          <p className="text-xs text-text-muted">Signed Up</p>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-gold/5 to-transparent">
          <TrendingUp className="h-4 w-4 text-gold mx-auto mb-1" />
          <p className="text-2xl font-bold text-gold">{data?.totalQualified || 0}</p>
          <p className="text-xs text-text-muted">Converted</p>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-accent/5 to-transparent">
          <DollarSign className="h-4 w-4 text-accent mx-auto mb-1" />
          <p className="text-2xl font-bold text-accent">${totalCommission.toFixed(0)}</p>
          <p className="text-xs text-text-muted">Total Earned</p>
        </Card>
      </div>

      {/* Pending payout */}
      {pendingCommission > 0 && (
        <Card className="mb-4 border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gold/10">
                <DollarSign className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">${pendingCommission.toFixed(2)} pending payout</p>
                <p className="text-xs text-text-muted">Payouts are processed monthly by the LCA Desk team</p>
              </div>
            </div>
            <Badge variant="gold">Pending</Badge>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Link href="/affiliate/referrals">
          <Card className="hover:border-accent/30 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent-light">
                  <Gift className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Share & Refer</p>
                  <p className="text-xs text-text-muted">Get your link, share on social media</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/affiliate/earnings">
          <Card className="hover:border-gold/30 hover:shadow-md transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <DollarSign className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">View Earnings</p>
                  <p className="text-xs text-text-muted">Commission history and payouts</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent referrals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Recent Referrals</CardTitle>
            <Link href="/affiliate/referrals" className="text-xs text-accent hover:text-accent-hover">View All</Link>
          </div>
        </CardHeader>
        <CardContent>
          {!data?.referrals?.length ? (
            <div className="text-center py-8">
              <Gift className="h-8 w-8 text-text-muted/30 mx-auto mb-2" />
              <p className="text-sm text-text-muted">No referrals yet. Share your link to start earning.</p>
              <Link href="/affiliate/referrals">
                <Button size="sm" className="mt-3 gap-1"><Gift className="h-3.5 w-3.5" /> Get Your Link</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referrals.slice(0, 5).map((r: { id: string; referredEmail: string | null; status: string; commissionAmount?: string; createdAt: string | null }) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{r.referredEmail || "Pending"}</p>
                    <p className="text-xs text-text-muted">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.commissionAmount && <span className="text-xs font-medium text-gold">${r.commissionAmount}</span>}
                    <Badge variant={r.status === "rewarded" ? "gold" : r.status === "signed_up" ? "accent" : "default"} className="text-xs">
                      {r.status === "rewarded" ? "Converted" : r.status === "signed_up" ? "Signed Up" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
