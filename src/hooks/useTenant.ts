"use client";

import { useEffect, useState } from "react";
import { fetchUserContext } from "@/server/actions";

interface TenantInfo {
  id: string;
  name: string;
  slug: string | null;
  plan: string | null;
}

export function useTenant() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const ctx = await fetchUserContext();
        if (ctx?.tenant) {
          setTenant(ctx.tenant);
          setRole(ctx.role);
        }
      } catch {
        // Not authenticated
      }
      setLoading(false);
    };
    load();
  }, []);

  return { tenant, role, loading };
}
