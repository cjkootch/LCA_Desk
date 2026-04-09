"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Gift, Copy, Check, Users, TrendingUp, Share2,
  Trophy, Star, Link2, Clock, CheckCircle, Sparkles, Mail,
} from "lucide-react";
import { fetchMyReferralInfo, updateMyReferralCode } from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ReferralsPageContent() {
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

  const promoText = "Simplify your local content compliance with LCA Desk — AI-powered reporting for the petroleum sector. Sign up with my link:";
  const emailSubject = "Try LCA Desk — Local Content Compliance Made Easy";
  const emailBody = `Hi,\n\nI've been using LCA Desk for local content compliance and thought you'd find it useful. It handles expenditure tracking, employment reporting, and deadline management — all in one platform.\n\nSign up here and we both get 14 extra trial days:\n${referralLink}\n\nBest regards`;

  const shareToLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`, "_blank", "width=600,height=500");
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(promoText)}`, "_blank", "width=600,height=500");
  };

  const shareViaEmail = () => {
    window.open(`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);
  };

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
      <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
    </div>
  );

  return (
    <div>
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

            {/* Share buttons */}
            <div>
              <label className="text-xs text-text-muted font-medium mb-1.5 block">Share Via</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={shareToLinkedIn}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0077B5]/10 text-[#0077B5] hover:bg-[#0077B5]/20 transition-colors text-xs font-medium"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </button>
                <button
                  onClick={shareToFacebook}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors text-xs font-medium"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </button>
                <button
                  onClick={shareViaEmail}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-medium"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
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
            <div className="grid sm:grid-cols-3 gap-4 relative">
              {/* Connecting line (desktop only) */}
              <div className="hidden sm:block absolute top-6 left-[16%] right-[16%] h-px bg-border-light" />
              {[
                { icon: Share2, label: "1. Share Your Link", desc: "Send your referral link to colleagues, companies, or post it on social media", color: "bg-accent-light text-accent" },
                { icon: Users, label: "2. They Sign Up", desc: "When they create an account using your link, they appear in your referral history", color: "bg-success/10 text-success" },
                { icon: Sparkles, label: "3. Both Earn", desc: "When they file their first report, you both get 14 extra trial days — automatically", color: "bg-gold/10 text-gold" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center relative z-10">
                  <div className={cn("p-3 rounded-xl mb-2", step.color)}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{step.label}</p>
                  <p className="text-xs text-text-muted mt-0.5 max-w-[200px]">{step.desc}</p>
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
