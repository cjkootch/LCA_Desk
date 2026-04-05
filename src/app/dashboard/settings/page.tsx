"use client";

import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { profile } = useAuth();
  const { tenant } = useTenant();

  return (
    <div>
      <TopBar title="Settings" />
      <div className="p-8 max-w-4xl">
        <PageHeader title="Account Settings" description="Manage your account and organization settings." />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Name</p>
                  <p className="font-medium">{profile?.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted">Email</p>
                  <p className="font-medium">{profile?.email || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Company Name</p>
                  <p className="font-medium">{tenant?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted">Plan</p>
                  <Badge variant="accent">{tenant?.plan || "starter"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
