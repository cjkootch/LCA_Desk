"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkSuperAdmin } from "@/server/actions";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkSuperAdmin().then((isAdmin) => {
      if (!isAdmin) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      setLoading(false);
    }).catch(() => {
      router.replace("/dashboard");
    });
  }, [router]);

  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Admin" />
      <div className="p-8 max-w-4xl">
        <PageHeader title="Super Admin" description="Platform administration panel." />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jurisdictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-primary">
                  <div className="flex items-center gap-3">
                    <span>🇬🇾</span>
                    <span className="font-medium">Guyana</span>
                  </div>
                  <Badge variant="success">Active — Phase 1</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-primary">
                  <div className="flex items-center gap-3">
                    <span>🇸🇷</span>
                    <span className="font-medium">Suriname</span>
                  </div>
                  <Badge variant="default">Inactive — Phase 2</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-primary">
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
