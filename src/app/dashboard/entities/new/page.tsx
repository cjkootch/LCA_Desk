"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { EntityForm } from "@/components/entity/EntityForm";
import { toast } from "sonner";

export default function NewEntityPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);

    // Get user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id, tenants(jurisdiction_id)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      toast.error("No tenant found");
      setLoading(false);
      return;
    }

    const tenants = membership.tenants as unknown as { jurisdiction_id: string };

    const { error } = await supabase.from("entities").insert({
      ...data,
      tenant_id: membership.tenant_id,
      jurisdiction_id: tenants.jurisdiction_id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Entity created successfully");
      router.push("/dashboard/entities");
    }
    setLoading(false);
  };

  return (
    <div>
      <TopBar title="Add Entity" />
      <div className="p-8 max-w-4xl">
        <PageHeader
          title="Add New Entity"
          description="Register a new company or entity for local content compliance tracking."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Entities", href: "/dashboard/entities" },
            { label: "New Entity" },
          ]}
        />
        <Card>
          <EntityForm onSubmit={handleSubmit} loading={loading} />
        </Card>
      </div>
    </div>
  );
}
