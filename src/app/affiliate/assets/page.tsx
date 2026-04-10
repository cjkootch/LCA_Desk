"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Image, FileText, Mail, MessageSquare, Copy, Check } from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @next/next/no-img-element */

const SOCIAL_POSTS = [
  {
    platform: "LinkedIn",
    text: "Struggling with local content compliance reporting? LCA Desk automates expenditure tracking, employment reporting, and deadline management for petroleum sector companies. We switched and saved 20+ hours per filing period.\n\nTry it free for 30 days →",
  },
  {
    platform: "LinkedIn",
    text: "If you're a contractor or sub-contractor in Guyana's petroleum sector, you know how painful Half-Yearly Reports are. LCA Desk just made it painless — AI drafts your narrative, tracks your suppliers, and submits directly to the Secretariat.\n\nWorth checking out →",
  },
  {
    platform: "Twitter/X",
    text: "Local content compliance shouldn't take days. @LCADesk handles expenditure, employment & capacity reporting in one platform. AI-powered narrative drafting is a game changer. Try it free →",
  },
];

const EMAIL_TEMPLATES = [
  {
    subject: "Simplify Your Local Content Compliance",
    body: `Hi [Name],

I wanted to share a tool that's been incredibly useful for local content compliance reporting in the petroleum sector.

LCA Desk handles everything — expenditure tracking, employment reporting, capacity development, and even AI-powered narrative drafting. It submits directly to the Local Content Secretariat.

They offer a 30-day free trial, and it's already being used by companies across Guyana.

Here's my referral link (we both get 14 extra trial days): [YOUR LINK]

Worth a look if you're tired of spending days on Half-Yearly Reports.

Best,
[Your Name]`,
  },
  {
    subject: "Save 20+ Hours Per Filing Period",
    body: `Hi [Name],

Quick question — how long does your team spend on LCA compliance reports each period?

I've been recommending LCA Desk to companies in the sector. It automates the entire Half-Yearly Report process: expenditure, employment, capacity development, plus AI narrative drafting.

Companies I've referred are saving 20+ hours per filing period.

Try it here: [YOUR LINK]

Happy to walk you through it if helpful.

[Your Name]`,
  },
];

export default function MarketingAssetsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadImage = (src: string, name: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = name;
    a.click();
    toast.success("Image downloaded!");
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <Image className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Marketing Assets</h1>
          <p className="text-sm text-text-secondary">Ready-to-use images, social posts, and email templates to promote LCA Desk</p>
        </div>
      </div>

      {/* Promo images */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Promo Images</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-text-muted mb-3">Download and share on LinkedIn, Facebook, or in emails.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2].map(n => (
              <div key={n} className="rounded-lg overflow-hidden border border-border-light">
                <img src={`/referral-${n}.png`} alt={`Promo ${n}`} className="w-full" />
                <div className="p-2 flex justify-end">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => downloadImage(`/referral-${n}.png`, `lca-desk-promo-${n}.png`)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Social posts */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Social Media Posts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-text-muted">Copy these posts and add your referral link at the end.</p>
          {SOCIAL_POSTS.map((post, i) => (
            <div key={i} className="bg-bg-primary rounded-lg p-3 relative">
              <Badge variant="default" className="text-[11px] mb-2">{post.platform}</Badge>
              <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">{post.text}</p>
              <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7 px-2 text-xs gap-1"
                onClick={() => copyText(post.text, `social-${i}`)}>
                {copiedId === `social-${i}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copiedId === `social-${i}` ? "Copied" : "Copy"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Email templates */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Email Templates</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-text-muted">Replace [YOUR LINK] with your referral link and [Name] with the recipient.</p>
          {EMAIL_TEMPLATES.map((tmpl, i) => (
            <div key={i} className="bg-bg-primary rounded-lg p-3 relative">
              <p className="text-xs font-semibold text-text-primary mb-1">Subject: {tmpl.subject}</p>
              <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">{tmpl.body}</p>
              <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7 px-2 text-xs gap-1"
                onClick={() => copyText(`Subject: ${tmpl.subject}\n\n${tmpl.body}`, `email-${i}`)}>
                {copiedId === `email-${i}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copiedId === `email-${i}` ? "Copied" : "Copy"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
