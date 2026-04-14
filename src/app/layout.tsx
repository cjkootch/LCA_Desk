import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "LCA Desk — Local Content Compliance Platform",
  description:
    "AI-powered multi-jurisdiction local content compliance SaaS platform for petroleum sector reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-J4T660ZKK3"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-J4T660ZKK3', {
  cookie_domain: 'lcadesk.com',
  cookie_flags: 'SameSite=None;Secure'
});`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col antialiased bg-bg-primary text-text-primary font-body">
        <SessionProvider>
          <ImpersonationBanner />
          <DemoBanner />
          {children}
          <Toaster
            theme="light"
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
