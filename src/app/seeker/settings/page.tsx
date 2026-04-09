"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeekerTopBar } from "@/components/seeker/SeekerTopBar";
import { Bell, Lock } from "lucide-react";
import { fetchMyProfile, updateMyProfile, updatePassword } from "@/server/actions";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { CancelAccount } from "@/components/settings/CancelAccount";
import { toast } from "sonner";

export default function SeekerSettingsPage() {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchMyProfile()
      .then((p) => {
        if (p) setAlertsEnabled(p.alertsEnabled ?? true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveAlerts = async () => {
    setSaving(true);
    try {
      await updateMyProfile({ alertsEnabled });
      toast.success("Alert preferences updated");
    } catch {
      toast.error("Failed to update");
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <>
        <SeekerTopBar title="Settings" />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </>
    );
  }

  return (
    <>
      <SeekerTopBar title="Settings" description="Manage your account and preferences" />

      <div className="p-4 sm:p-8 max-w-3xl space-y-6">
        {/* Profile Picture & Socials */}
        <ProfileSettings />

        {/* Alert Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Job Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-text-primary">Email Notifications</p>
                <p className="text-xs text-text-muted">Get notified when new jobs match your profile</p>
              </div>
              <div
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  alertsEnabled ? "bg-accent" : "bg-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    alertsEnabled ? "translate-x-5" : ""
                  }`}
                />
              </div>
            </label>
            <Button size="sm" onClick={handleSaveAlerts} loading={saving}>
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Change Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-text-muted">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button size="sm" onClick={handleChangePassword} loading={changingPassword}>
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Cancel / Delete */}
        <CancelAccount hasPaidPlan={false} userType="seeker" />
      </div>
    </>
  );
}
