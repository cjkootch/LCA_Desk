"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
import { ComplianceCalendar } from "@/components/dashboard/ComplianceCalendar";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { calculateDeadlines, enrichDeadline } from "@/lib/compliance/deadlines";
import { fetchEntities } from "@/server/actions";
import type { DeadlineWithStatus } from "@/types/jurisdiction.types";
import type { Entity } from "@/types/database.types";

export default function DashboardPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const data = await fetchEntities();
      // Map Drizzle rows to Entity type
      setEntities(
        data.map((e) => ({
          id: e.id,
          tenant_id: e.tenantId,
          jurisdiction_id: e.jurisdictionId || "",
          legal_name: e.legalName,
          trading_name: e.tradingName,
          registration_number: e.registrationNumber,
          lcs_certificate_id: e.lcsCertificateId,
          lcs_certificate_expiry: e.lcsCertificateExpiry,
          petroleum_agreement_ref: e.petroleumAgreementRef,
          company_type: e.companyType as Entity["company_type"],
          guyanese_ownership_pct: e.guyanaeseOwnershipPct
            ? Number(e.guyanaeseOwnershipPct)
            : null,
          registered_address: e.registeredAddress,
          contact_name: e.contactName,
          contact_email: e.contactEmail,
          contact_phone: e.contactPhone,
          active: e.active ?? true,
          created_at: e.createdAt?.toISOString() || "",
          updated_at: e.updatedAt?.toISOString() || "",
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  const currentYear = new Date().getFullYear();
  const deadlines: DeadlineWithStatus[] = entities.flatMap((entity) => {
    const rawDeadlines = calculateDeadlines("GY", currentYear);
    return rawDeadlines.map((d) =>
      enrichDeadline(d, false, entity.id, entity.legal_name)
    );
  });

  const upcomingDeadlines = deadlines
    .filter((d) => d.status !== "completed" && d.days_remaining > -30)
    .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
    .slice(0, 10);

  const overdueCount = deadlines.filter((d) => d.status === "overdue").length;
  const dueSoonCount = deadlines.filter((d) => d.status === "due_soon").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title="Portfolio Overview"
        description="Manage your local content compliance across all entities"
        action={{
          label: "Add Entity",
          onClick: () => router.push("/dashboard/entities/new"),
        }}
      />
      <div className="p-8">
        <StatsBar
          totalEntities={entities.length}
          reportsDueThisMonth={dueSoonCount}
          overdueReports={overdueCount}
          avgLocalContentRate={0}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-lg font-heading font-semibold mb-4">Entities</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entities.map((entity) => (
                  <PortfolioCard key={entity.id} entity={entity} />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <ComplianceCalendar deadlines={upcomingDeadlines} />
              <AlertsPanel alerts={[]} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
