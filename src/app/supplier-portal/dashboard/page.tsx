"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Building2, LogOut, ArrowRight, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { fetchMySupplierProfile, upgradeSupplierToFiler } from "@/server/actions";
import { toast } from "sonner";
import Image from "next/image";

export default function SupplierDashboard() {
  const { profile, signOut } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchMySupplierProfile()
      .then(setSupplierProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    const companyName = supplierProfile?.legalName || profile?.full_name || "My Company";
    setUpgrading(true);
    try {
      await upgradeSupplierToFiler(companyName);
      toast.success("Upgraded to filing client — redirecting...");
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upgrade failed");
    }
    setUpgrading(false);
  };

  const isExpired = supplierProfile?.lcsExpirationDate && new Date(supplierProfile.lcsExpirationDate) < new Date();
  const isExpiringSoon = supplierProfile?.lcsExpirationDate && !isExpired &&
    new Date(supplierProfile.lcsExpirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Image src="/logo-full.png" alt="LCA Desk" width={120} height={35} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{profile?.full_name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-heading font-bold mb-1">Supplier Portal</h1>
      <p className="text-text-secondary mb-6">Manage your supplier profile and LCS certification status.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* LCS Certificate Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                <CardTitle className="text-base">LCS Certificate Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {supplierProfile?.lcsCertId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {isExpired ? (
                      <XCircle className="h-5 w-5 text-danger" />
                    ) : isExpiringSoon ? (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-success" />
                    )}
                    <div>
                      <p className="font-mono text-lg">{supplierProfile.lcsCertId}</p>
                      <Badge variant={isExpired ? "danger" : supplierProfile.lcsVerified ? "success" : "warning"}>
                        {isExpired ? "Expired" : supplierProfile.lcsVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                  </div>
                  {supplierProfile.lcsExpirationDate && (
                    <p className="text-sm text-text-muted">
                      {isExpired ? "Expired" : "Expires"}: {supplierProfile.lcsExpirationDate}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No LCS certificate on file.</p>
              )}
            </CardContent>
          </Card>

          {/* Company Profile */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent" />
                <CardTitle className="text-base">Company Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Legal Name</p>
                  <p className="font-medium">{supplierProfile?.legalName || "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted">Trading Name</p>
                  <p className="font-medium">{supplierProfile?.tradingName || "—"}</p>
                </div>
                <div>
                  <p className="text-text-muted">Service Categories</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(supplierProfile?.serviceCategories || []).map((cat: string, i: number) => (
                      <Badge key={i} variant="default" className="text-xs">{cat}</Badge>
                    ))}
                    {(!supplierProfile?.serviceCategories || supplierProfile.serviceCategories.length === 0) && (
                      <span className="text-text-muted">None set</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade to Filing Client */}
          <Card className="border-accent/20 bg-accent-light">
            <CardContent className="p-6">
              <h3 className="font-semibold text-text-primary mb-2">Need to file LCA reports?</h3>
              <p className="text-sm text-text-secondary mb-4">
                If you have a filing obligation under the Local Content Act, upgrade to a filing account
                to access the full compliance dashboard, AI narrative drafting, and report exports.
              </p>
              <Button onClick={handleUpgrade} loading={upgrading}>
                Start Filing <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
