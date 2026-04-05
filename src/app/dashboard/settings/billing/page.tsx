"use client";

import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  return (
    <div>
      <TopBar title="Billing" />
      <div className="p-8 max-w-4xl">
        <PageHeader
          title="Billing & Subscription"
          description="Manage your subscription plan and payment methods."
          breadcrumbs={[
            { label: "Settings", href: "/dashboard/settings" },
            { label: "Billing" },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary text-sm">
              Billing management will be available soon. Contact support for enterprise pricing.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
