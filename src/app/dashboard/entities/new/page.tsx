"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { EntityForm } from "@/components/entity/EntityForm";
import { addEntity } from "@/server/actions";
import { toast } from "sonner";

export default function NewEntityPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      await addEntity(data as Parameters<typeof addEntity>[0]);
      toast.success("Entity created successfully");
      router.push("/dashboard/entities");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create entity");
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
