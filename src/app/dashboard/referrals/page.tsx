"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Gift, Copy, Check, Users, TrendingUp, Share2,
  Trophy, Star, Link2, Clock, CheckCircle, Sparkles,
} from "lucide-react";
import { fetchMyReferralInfo, updateMyReferralCode } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReferralsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  useEffect(() => {
    fetchMyReferralInfo()
      .then(d => { setData(d); if (d?.code) setCustomCode(d.code); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.lcadesk.com";
  const referralLink = data?.code ? `${baseUrl}/auth/signup?ref=${data.code}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCode = async () => {
    if (!customCode.trim()) return;
    setSavingCode(true);
    try {
      await updateMyReferralCode(customCode.trim().toUpperCase());
      setData({ ...data, code: customCode.trim().toUpperCase() });
      setEditingCode(false);
      toast.success("Referral code updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update code");
    }
    setSavingCode(false);
  };

  if (loading) return (
    <div>
      <TopBar title="Referrals" />
      <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
    </div>
  );

  return (
    <div>
      <TopBar title="Referrals" description="Invite others and earn rewards" />
      <div className="p-4 sm:p-6 max-w-4xl space-y-4">

        {/* Hero card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-5 w-5 text-gold" />
                  <h2 className="text-lg font-bold text-text-primary">Refer & Earn</h2>
                </div>
                <p className="text-sm text-text-secondary max-w-md">
                  Share your referral link with colleagues and companies. When they sign up and file their first report, you both earn rewards.
                </p>
              </div>
              <Trophy className="h-10 w-10 text-gold/30 shrink-0" />
            </div>
          </div>
          <CardContent className="p-5 space-y-4">
            {/* Referral link */}
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 block">Your Referral Link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-bg-primary rounded-lg px-3 py-2.5 text-sm font-mono text-text-secondary truncate border border-border-light">
                  {referralLink || "Loading..."}
                </div>
                <Button onClick={handleCopy} className="gap-1.5 shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>

            {/* Custom code */}
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 block">Your Referral Code</label>
              {editingCode ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                    placeholder="YOUR-CODE"
                    className="font-mono uppercase"
                    maxLength={20}
                  />
                  <Button size="sm" onClick={handleSaveCode} loading={savingCode}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingCode(false); setCustomCode(data?.code || ""); }}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-text-primary bg-bg-primary px-3 py-2 rounded-lg border border-border-light">{data?.code || "—"}</span>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCode(true)} className="text-xs text-accent">
                    Customize
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <Users className="h-4 w-4 text-text-muted mx-auto mb-1" />
            <p className="text-2xl font-bold text-text-primary">{data?.totalReferred || 0}</p>
            <p className="text-xs text-text-muted">Total Referred</p>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-success/5 to-transparent">
            <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-success">{data?.totalSignedUp || 0}</p>
            <p className="text-xs text-text-muted">Signed Up</p>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-gold/5 to-transparent">
            <Star className="h-4 w-4 text-gold mx-auto mb-1" />
            <p className="text-2xl font-bold text-gold">{data?.totalQualified || 0}</p>
            <p className="text-xs text-text-muted">Qualified</p>
          </Card>
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Share2, label: "Share", desc: "Send your referral link to colleagues or companies needing compliance tools" },
                { icon: Users, label: "They Sign Up", desc: "When they create an account using your link, you'll see them here" },
                { icon: Sparkles, label: "Both Earn", desc: "When they file their first report, you both get 14 extra trial days" },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent-light shrink-0">
                    <step.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{step.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Referral history */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Referral History</CardTitle>
              {data?.referrals?.length > 0 && (
                <span className="text-xs text-text-muted">{data.referrals.length} total</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!data?.referrals?.length ? (
              <EmptyState
                icon={Gift}
                title="No referrals yet"
                description="Share your referral link to start earning rewards. Each qualified referral earns you 14 extra trial days."
              />
            ) : (
              <div className="space-y-2">
                {data.referrals.map((r: { id: string; referredEmail: string | null; status: string; rewardType: string | null; rewardAmount: string | null; createdAt: string | null }) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{r.referredEmail || "Pending signup"}</p>
                      <p className="text-xs text-text-muted">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.rewardAmount && (
                        <span className="text-xs text-gold font-medium">{r.rewardAmount}</span>
                      )}
                      <Badge
                        variant={r.status === "rewarded" ? "gold" : r.status === "qualified" ? "success" : r.status === "signed_up" ? "accent" : "default"}
                        className="text-xs"
                      >
                        {r.status === "signed_up" ? "Signed Up" : r.status === "qualified" ? "Qualified" : r.status === "rewarded" ? "Rewarded" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
