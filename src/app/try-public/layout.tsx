import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Try LCA Desk — Live Demo",
  description: "Explore the compliance platform built for petroleum sector contractors and job seekers. See the filing workflow, AI-powered narrative drafting, and talent pool. No signup required.",
  openGraph: {
    title: "LCA Desk — Try the Live Demo",
    description: "See how contractors file Half-Yearly Reports and how job seekers find petroleum sector opportunities. Full interactive demo — no signup, no credit card.",
    url: "https://app.lcadesk.com/try-public",
    siteName: "LCA Desk",
    type: "website",
    images: [{
      url: "https://app.lcadesk.com/og-demo.png",
      width: 1200,
      height: 630,
      alt: "LCA Desk Demo — Compliance platform for petroleum sector",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LCA Desk — Try the Live Demo",
    description: "Interactive demo of the compliance platform for petroleum sector contractors and job seekers.",
    images: ["https://app.lcadesk.com/og-demo.png"],
  },
};

export default function TryPublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
