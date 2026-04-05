"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Building2, Plus, ArrowRight } from "lucide-react";
import type { Entity } from "@/types/database.types";

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("entities")
        .select("*")
        .order("created_at", { ascending: false });
      setEntities(data || []);
      setLoading(false);
    };
    fetch();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title="Entities"
        action={{ label: "Add Entity", onClick: () => router.push("/dashboard/entities/new") }}
      />
      <div className="p-8">
        <PageHeader
          title="Entity Management"
          description="Manage companies and entities under your local content compliance portfolio."
        />

        {entities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No entities yet"
            description="Add your first company or entity to start tracking local content compliance."
            actionLabel="Add Entity"
            onAction={() => router.push("/dashboard/entities/new")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Legal Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>LCS Certificate</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{entity.legal_name}</p>
                      {entity.trading_name && (
                        <p className="text-xs text-text-muted">t/a {entity.trading_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entity.company_type === "contractor"
                          ? "accent"
                          : entity.company_type === "subcontractor"
                          ? "warning"
                          : "gold"
                      }
                    >
                      {entity.company_type || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{entity.lcs_certificate_id || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {entity.guyanese_ownership_pct !== null
                      ? `${entity.guyanese_ownership_pct}%`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entity.active ? "success" : "default"}>
                      {entity.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/entities/${entity.id}`}>
                      <Button variant="ghost" size="sm">
                        View <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
