"use client";
import { useEffect } from "react";
import { signIn } from "next-auth/react";

export default function TryPage() {
  useEffect(() => {
    fetch("/api/demo/public-login")
      .then(r => r.json())
      .then(async ({ email, password }: { email?: string; password?: string }) => {
        if (!email) { window.location.href = "/auth/login"; return; }
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) { window.location.href = "/auth/login"; return; }
        window.location.href = "/demo/select";
      })
      .catch(() => { window.location.href = "/auth/login"; });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg-primary">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      <p className="text-text-muted text-sm">Loading demo...</p>
    </div>
  );
}
