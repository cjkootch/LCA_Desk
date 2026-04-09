"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Building2, ArrowRight } from "lucide-react";
import { fetchEntities } from "@/server/actions";

type EntityRow = Awaited<ReturnType<typeof fetchEntities>>[number];

export default function EntitiesPage() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchEntities()
      .then((data) => {
        setEntities(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

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
      <div className="p-4 sm:p-6">
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
                      <p className="font-medium">{entity.legalName}</p>
                      {entity.tradingName && (
                        <p className="text-xs text-text-muted">t/a {entity.tradingName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entity.companyType === "contractor"
                          ? "accent"
                          : entity.companyType === "subcontractor"
                          ? "warning"
                          : "gold"
                      }
                    >
                      {entity.companyType || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{entity.lcsCertificateId || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {entity.guyanaeseOwnershipPct !== null ? `${entity.guyanaeseOwnershipPct}%` : "—"}
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
