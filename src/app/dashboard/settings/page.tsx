"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  Users,
  Bell,
  Trash2,
  Plus,
  Save,
} from "lucide-react";
import {
  fetchUserContext,
  updateProfile,
  updatePassword,
  updateTenant,
  fetchTeamMembers,
  inviteTeamMember,
  removeTeamMember,
} from "@/server/actions";

// ─── Types ───────────────────────────────────────────────────────
type Tab = "profile" | "company" | "team" | "notifications";

interface TeamMember {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserContext = any;

// ─── Tab config ──────────────────────────────────────────────────
const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "company", label: "Company", icon: Building2 },
  { key: "team", label: "Team", icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell },
];

// ─── Main Page ───────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserContext()
      .then((data) => setCtx(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <TopBar title="Settings" />
        <div className="p-8 max-w-4xl">
          <p className="text-text-muted text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Settings" />
      <div className="p-8 max-w-4xl">
        <PageHeader
          title="Account Settings"
          description="Manage your account, organization, and team settings."
        />

        {/* Tab navigation */}
        <div className="flex gap-1 mb-8">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === key
                  ? "bg-accent text-white"
                  : "bg-bg-primary text-text-secondary hover:text-text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "profile" && <ProfileTab ctx={ctx} />}
        {activeTab === "company" && <CompanyTab ctx={ctx} />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <NotificationsTab />
            <RestartTour />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────
function ProfileTab({ ctx }: { ctx: UserContext | null }) {
  const [name, setName] = useState(ctx?.user?.name ?? "");
  const [email, setEmail] = useState(ctx?.user?.email ?? "");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await updateProfile({ name, email });
      toast.success("Profile updated successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveProfile} loading={saving}>
              <Save className="h-4 w-4" />
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-md">
            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <PasswordInput
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              showStrength
            />
            <PasswordInput
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSavePassword} loading={savingPassword}>
              <Save className="h-4 w-4" />
              Save Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Company Tab ─────────────────────────────────────────────────
function CompanyTab({ ctx }: { ctx: UserContext | null }) {
  const [companyName, setCompanyName] = useState(ctx?.tenant?.name ?? "");
  const [saving, setSaving] = useState(false);

  const jurisdiction = ctx?.tenant?.jurisdiction ?? "Not set";
  const plan = ctx?.tenant?.plan ?? "starter";

  async function handleSave() {
    if (!companyName.trim()) {
      toast.error("Company name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateTenant({ name: companyName });
      toast.success("Company details updated.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update company.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
            />
            <div>
              <p className="text-sm font-medium text-text-secondary mb-1">Jurisdiction</p>
              <p className="text-sm text-text-primary bg-bg-primary rounded-lg px-3 py-2 border border-border">
                {jurisdiction}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary mb-1">Plan</p>
              <div className="flex items-center gap-2">
                <Badge variant="accent" className="capitalize">
                  {plan}
                </Badge>
                <a href="/dashboard/settings/billing" className="text-xs text-accent hover:text-accent-hover font-medium">
                  Manage plan →
                </a>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4" />
              Save Company
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Team Tab ────────────────────────────────────────────────────
function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchTeamMembers();
      setMembers(data as TeamMember[]);
    } catch {
      toast.error("Failed to load team members.");
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address.");
      return;
    }
    setInviting(true);
    try {
      await inviteTeamMember({ email: inviteEmail, role: inviteRole });
      toast.success("Team member invited successfully.");
      setInviteEmail("");
      setInviteRole("member");
      loadMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    try {
      await removeTeamMember(memberId);
      toast.success("Team member removed.");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  const roleOptions = [
    { value: "admin", label: "Admin" },
    { value: "member", label: "Member" },
    { value: "viewer", label: "Viewer" },
  ];

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "gold" as const;
      case "admin":
        return "accent" as const;
      case "member":
        return "default" as const;
      case "viewer":
        return "warning" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <p className="text-sm text-text-muted">Loading team members...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-text-muted">No team members found.</p>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {member.user.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-text-muted">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={roleBadgeVariant(member.role)} className="capitalize">
                      {member.role}
                    </Badge>
                    {member.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(member.id)}
                        loading={removingId === member.id}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Member</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                label="Email Address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                label="Role"
                options={roleOptions}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleInvite} loading={inviting}>
                <Plus className="h-4 w-4" />
                Invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notifications Tab ───────────────────────────────────────────
const notificationOptions = [
  {
    id: "deadline_reminders",
    label: "Deadline reminders",
    description: "Get notified 14 days before upcoming deadlines",
  },
  {
    id: "filing_completion",
    label: "Filing completion alerts",
    description: "Receive alerts when filings are completed",
  },
  {
    id: "certificate_expiry",
    label: "Certificate expiry warnings",
    description: "Warnings when certificates are about to expire",
  },
  {
    id: "weekly_digest",
    label: "Weekly compliance digest",
    description: "A weekly summary of your compliance status",
  },
];

function RestartTour() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Product Tour</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary mb-3">
          Replay the guided tour to learn about LCA Desk features.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            localStorage.removeItem("lca-desk-tour-completed");
            window.location.href = "/dashboard";
          }}
        >
          Restart Product Tour
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    deadline_reminders: true,
    filing_completion: true,
    certificate_expiry: false,
    weekly_digest: false,
  });

  function toggle(id: string) {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {notificationOptions.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{opt.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{opt.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[opt.id]}
                onClick={() => toggle(opt.id)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  prefs[opt.id] ? "bg-accent" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
                    prefs[opt.id] ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Re-export RestartTourButton usage in notifications tab would go here
// but we add it directly to the notifications tab above
