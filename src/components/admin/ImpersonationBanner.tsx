"use client";

import { useSession } from "next-auth/react";
import { Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function ImpersonationBanner() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = useSession() as any;
  const [returning, setReturning] = useState(false);

  const impersonatedBy = session?.user?.impersonatedBy;
  if (!impersonatedBy) return null;

  const handleReturn = async () => {
    setReturning(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: impersonatedBy }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/dashboard/admin";
      }
    } catch {
      setReturning(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-warning text-white px-4 py-1.5 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <Eye className="h-4 w-4 shrink-0" />
      <span>Viewing as <strong>{session?.user?.name || session?.user?.email}</strong></span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white"
        onClick={handleReturn}
        loading={returning}
      >
        <ArrowLeft className="h-3 w-3 mr-1" /> Return to Admin
      </Button>
    </div>
  );
}
