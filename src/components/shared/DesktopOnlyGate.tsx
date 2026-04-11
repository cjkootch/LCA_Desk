"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";

export function DesktopOnlyGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6 text-center">
        <div className="p-4 rounded-2xl bg-bg-card border border-border mb-6">
          <Monitor className="h-10 w-10 text-text-muted mx-auto" />
        </div>
        <h2 className="text-xl font-heading font-bold text-text-primary mb-2">Desktop Required</h2>
        <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
          This tool is designed for desktop use. Please open it on a laptop or desktop computer to continue.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
