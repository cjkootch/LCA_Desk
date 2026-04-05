"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tenant, TenantMember } from "@/types/database.types";

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<TenantMember | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchTenant = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: members } = await supabase
        .from("tenant_members")
        .select("*, tenants(*)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (members) {
        setMembership({
          id: members.id,
          tenant_id: members.tenant_id,
          user_id: members.user_id,
          role: members.role,
          created_at: members.created_at,
        });
        setTenant(members.tenants as unknown as Tenant);
      }

      setLoading(false);
    };

    fetchTenant();
  }, [supabase]);

  return { tenant, membership, loading };
}
