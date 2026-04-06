"use client";

import { useSession } from "next-auth/react";

export function DemoBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email;

  if (!email?.endsWith("@lcadesk.com") || !email?.startsWith("demo-")) return null;

  const label = email.includes("filer-lite") ? "Filer (Lite)" :
    email.includes("filer-pro") ? "Filer (Pro)" :
    email.includes("filer-trial") ? "Filer (Trial)" :
    email.includes("filer-expired") ? "Filer (Expired Trial)" :
    email.includes("seeker") ? "Job Seeker" :
    email.includes("supplier") ? "Supplier" :
    email.includes("admin") ? "Super Admin" : "Demo";

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gold text-white text-center py-1 text-[11px] font-medium tracking-wide">
      DEMO MODE — {label} &middot; <a href="/demo" className="underline">Switch User</a>
    </div>
  );
}
