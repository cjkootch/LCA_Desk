"use client";

import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminPage() {
  return (
    <div>
      <TopBar title="Admin" />
      <div className="p-8 max-w-4xl">
        <PageHeader title="Super Admin" description="Platform administration panel." />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Jurisdictions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-surface">
                  <div className="flex items-center gap-3">
                    <span>🇬🇾</span>
                    <span className="font-medium">Guyana</span>
                  </div>
                  <Badge variant="success">Active — Phase 1</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-surface">
                  <div className="flex items-center gap-3">
                    <span>🇸🇷</span>
                    <span className="font-medium">Suriname</span>
                  </div>
                  <Badge variant="default">Inactive — Phase 2</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-surface">
                  <div className="flex items-center gap-3">
                    <span>🇳🇦</span>
                    <span className="font-medium">Namibia</span>
                  </div>
                  <Badge variant="default">Inactive — Phase 3</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
