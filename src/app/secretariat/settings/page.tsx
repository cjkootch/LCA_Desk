"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield, Bell, Mail, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function SecretariatSettingsPage() {
  const { profile } = useAuth();

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">Manage your account and notification preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted font-medium">Name</label>
                <p className="text-sm font-medium text-text-primary mt-1">{profile?.full_name || "—"}</p>
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium">Email</label>
                <p className="text-sm text-text-primary mt-1">{profile?.email || "—"}</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium">Role</label>
              <div className="mt-1">
                <Badge variant="accent">Secretariat Admin</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Notification Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "New submission received", desc: "When a company submits a report through LCA Desk", default: true },
              { label: "Amendment response received", desc: "When a company responds to an amendment request", default: true },
              { label: "LCS application submitted", desc: "When a new LCS certificate application is filed", default: true },
              { label: "Filing deadline approaching", desc: "Reminder when filing deadlines are approaching for the sector", default: false },
              { label: "Weekly sector digest", desc: "Summary of submissions, compliance metrics, and market activity", default: true },
            ].map(n => (
              <div key={n.label} className="flex items-start justify-between py-2 border-b border-border-light last:border-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">{n.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{n.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input type="checkbox" defaultChecked={n.default} className="sr-only peer" />
                  <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submission email */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gold" />
              <CardTitle className="text-sm">Office Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-text-muted font-medium">Submission Email</label>
              <Input defaultValue="localcontent@nre.gov.gy" className="mt-1" disabled />
              <p className="text-[10px] text-text-muted mt-1">Contact the platform administrator to change this.</p>
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium">Office Name</label>
              <Input defaultValue="Local Content Secretariat" className="mt-1" disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
