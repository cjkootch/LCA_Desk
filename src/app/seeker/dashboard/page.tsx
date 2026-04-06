"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Briefcase, FileText, User, LogOut } from "lucide-react";
import { fetchMyApplications } from "@/server/actions";
import Image from "next/image";
import Link from "next/link";

const STATUS_VARIANT: Record<string, "default" | "accent" | "warning" | "success" | "danger"> = {
  received: "default",
  reviewing: "accent",
  shortlisted: "warning",
  interviewed: "warning",
  selected: "success",
  rejected: "danger",
};

export default function SeekerDashboard() {
  const { profile, signOut } = useAuth();
  const [applications, setApplications] = useState<Awaited<ReturnType<typeof fetchMyApplications>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyApplications()
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Image src="/logo-full.png" alt="LCA Desk" width={120} height={35} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-heading font-bold mb-1">My Applications</h1>
      <p className="text-text-secondary mb-6">Track your job applications and their status.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          description="Browse open positions and apply to get started."
          actionLabel="Browse Jobs"
          onAction={() => window.location.href = "https://lcadesk.com/jobs"}
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{app.jobTitle}</p>
                  <p className="text-sm text-text-secondary">{app.companyName}</p>
                  <p className="text-xs text-text-muted mt-1">
                    Applied {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[app.status || "received"] || "default"}>
                  {(app.status || "received").replace(/_/g, " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="https://lcadesk.com/jobs" className="text-sm text-accent hover:text-accent-hover">
          Browse more jobs on lcadesk.com →
        </Link>
      </div>
    </div>
  );
}
