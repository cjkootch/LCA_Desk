"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

/**
 * Auto-logs in as the demo secretariat user and redirects to /secretariat/dashboard.
 * Only works when NEXT_PUBLIC_DEMO_PASSWORD is set.
 */
export default function TrySecretariatPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/demo/public-login?role=secretariat");
        if (!res.ok) {
          setError("Demo is not available right now. Please contact us to schedule a live demo.");
          return;
        }
        const { email, password } = await res.json() as { email: string; password: string };
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) {
          setError("Could not log in to demo account. Please try again.");
          return;
        }
        router.replace("/secretariat/dashboard");
      } catch {
        setError("Something went wrong. Please try again.");
      }
    };
    run();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4">
      <Image src="/logo-full.svg" alt="LCA Desk" width={160} height={48} priority className="mb-8" />
      {error ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-text-secondary max-w-sm">{error}</p>
          <a href="/contact" className="text-accent hover:underline text-sm font-medium">
            Contact us →
          </a>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" />
          <p className="text-sm text-text-muted">Loading the Secretariat demo...</p>
        </div>
      )}
      <div className="mt-10 text-center space-y-2 text-sm text-text-muted">
        <p>
          Are you a filer?{" "}
          <a href="/try" className="text-accent hover:underline font-medium">
            Try the Filer demo →
          </a>
        </p>
        <p>
          Looking for a job?{" "}
          <a href="/try/seeker" className="text-accent hover:underline font-medium">
            Try the Job Seeker demo →
          </a>
        </p>
      </div>
    </div>
  );
}
