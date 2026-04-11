"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function TryPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    fetch("/api/demo/public-login")
      .then(r => r.json())
      .then(async ({ email, password }: { email?: string; password?: string }) => {
        if (!email) { setStatus("error"); return; }
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) { setStatus("error"); return; }
        window.location.href = "/demo/select";
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#0B1B18] flex flex-col items-center justify-center gap-4 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-lca.png" alt="LCA Desk" width={160} height={40} className="mb-2" />
        <p className="text-white/60 text-center max-w-md">
          Demo is currently unavailable.{" "}
          <a href="https://lcadesk.com/demo" className="text-[#71b59a] hover:underline">Request a live demo \u2192</a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1B18] flex flex-col items-center justify-center gap-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-white-lca.png" alt="LCA Desk" width={160} height={40} />
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#71b59a]" />
      <p className="text-white/50 text-sm">Preparing your demo...</p>
    </div>
  );
}
