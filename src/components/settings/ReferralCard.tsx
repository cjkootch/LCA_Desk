"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Check, Users, TrendingUp } from "lucide-react";
import { fetchMyReferralInfo } from "@/server/actions";
import { toast } from "sonner";

export function ReferralCard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyReferralInfo().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.lcadesk.com";
  const referralLink = `${baseUrl}/auth/signup?ref=${data.code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-gold" />
          <CardTitle className="text-sm">Refer & Earn</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-text-secondary">
          Share your referral link. When someone signs up, you both benefit.
        </p>

        {/* Referral link */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-bg-primary rounded-lg px-3 py-2 text-xs font-mono text-text-secondary truncate border border-border-light">
            {referralLink}
          </div>
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0 h-8">
            {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Stats */}
        {data.totalReferred > 0 && (
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-text-primary">{data.totalReferred}</p>
              <p className="text-xs text-text-muted">Referred</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">{data.totalSignedUp}</p>
              <p className="text-xs text-text-muted">Signed Up</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gold">{data.totalQualified}</p>
              <p className="text-xs text-text-muted">Qualified</p>
            </div>
          </div>
        )}

        {/* Recent referrals */}
        {data.referrals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent Referrals</p>
            {data.referrals.slice(0, 5).map((r: { id: string; referredEmail: string | null; status: string; createdAt: string | null }) => (
              <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-border-light last:border-0">
                <span className="text-text-secondary truncate">{r.referredEmail || "—"}</span>
                <Badge
                  variant={r.status === "rewarded" ? "gold" : r.status === "qualified" ? "success" : r.status === "signed_up" ? "accent" : "default"}
                  className="text-[11px]"
                >
                  {r.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-text-muted">
          Your code: <span className="font-mono font-medium">{data.code}</span>
        </p>
      </CardContent>
    </Card>
  );
}
