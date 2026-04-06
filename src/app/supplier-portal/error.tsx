"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function SecretariatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6">
        <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
        <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button onClick={reset} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    </div>
  );
}
