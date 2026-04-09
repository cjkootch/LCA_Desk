"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-8">
          <Image src="/logo-white.svg" alt="LCA Desk" width={180} height={60} priority />
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-8">
          <h1 className="text-2xl font-heading font-bold text-danger mb-2">
            Authentication Error
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Something went wrong during authentication. Please try again.
          </p>
          <Link href="/auth/login">
            <Button className="w-full">Back to Sign In</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
