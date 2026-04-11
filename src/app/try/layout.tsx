import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Try LCA Desk — Live Demo",
  description: "Explore the compliance platform built for petroleum sector regulators and contractors. See the Secretariat review dashboard, filing workflow, and AI-powered narrative drafting. No signup required.",
  openGraph: {
    title: "LCA Desk — Try the Live Demo",
    description: "See how regulators review local content filings and how contractors file Half-Yearly Reports. Full interactive demo — no signup, no credit card.",
    url: "https://app.lcadesk.com/try",
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
    description: "Interactive demo of the compliance platform for petroleum sector regulators and contractors.",
    images: ["https://app.lcadesk.com/og-demo.png"],
  },
};

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
