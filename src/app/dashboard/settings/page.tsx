"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { CancelAccount } from "@/components/settings/CancelAccount";
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
  Plug,
  CheckCircle,
  ExternalLink,
  Sliders,
} from "lucide-react";
import {
  fetchUserContext,
  updateProfile,
  updatePassword,
  updateTenant,
  fetchTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  fetchQboStatus,
  disconnectQbo,
  fetchFeaturePreferences,
  updateFeaturePreferences,
  fetchUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/server/actions";
import type { FeaturePreferences } from "@/server/actions";

// ─── Types ───────────────────────────────────────────────────────
type Tab = "profile" | "company" | "team" | "integrations" | "notifications" | "features";

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
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "features", label: "Features", icon: Sliders },
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
        <div className="p-4 sm:p-8 max-w-4xl">
          <p className="text-text-muted text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Settings" />
      <div className="p-4 sm:p-8 max-w-4xl">
        <PageHeader
          title="Account Settings"
          description="Manage your account, organization, and team settings."
        />

        {/* Tab navigation */}
        <div className="relative mb-8">
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0",
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
          {/* Fade hint on right edge — mobile only */}
          <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-bg-primary to-transparent pointer-events-none sm:hidden" />
        </div>

        {/* Tab content */}
        {activeTab === "profile" && <ProfileTab ctx={ctx} />}
        {activeTab === "company" && <CompanyTab ctx={ctx} />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "integrations" && <IntegrationsTab plan={ctx?.tenant?.plan as string || "lite"} />}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <NotificationsTab />
            <RestartTour />
          </div>
        )}
        {activeTab === "features" && <FeaturesTab />}
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
      <ProfileSettings />
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

      <CancelAccount hasPaidPlan={true} userType="filer" />
    </div>
  );
}

// ─── Company Tab ─────────────────────────────────────────────────
function CompanyTab({ ctx }: { ctx: UserContext | null }) {
  const [companyName, setCompanyName] = useState(ctx?.tenant?.name ?? "");
  const [saving, setSaving] = useState(false);

  const jurisdiction = ctx?.tenant?.jurisdiction ?? "Not set";
  const plan = ctx?.tenant?.plan ?? "lite";

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

// ─── Integrations Tab ────────────────────────────────────────────
function IntegrationsTab({ plan }: { plan: string }) {
  const isEnterprise = plan === "enterprise";
  const isPro = plan === "pro" || plan === "enterprise";
  const [qbo, setQbo] = useState<{
    connected: boolean;
    companyName: string | null;
    connectedAt: Date | null;
  }>({ connected: false, companyName: null, connectedAt: null });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchQboStatus()
      .then(setQbo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectQbo();
      setQbo({ connected: false, companyName: null, connectedAt: null });
      toast.success("QuickBooks disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
    setDisconnecting(false);
  };

  return (
    <div className="space-y-6">
      {/* QuickBooks Online */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/qbo-icon.svg" alt="QuickBooks" className="h-10 w-10 rounded-lg" />
              <div>
                <CardTitle className="text-base">QuickBooks Online</CardTitle>
                <p className="text-sm text-text-muted mt-0.5">Import expenditure and payroll data</p>
              </div>
            </div>
            {qbo.connected && (
              <Badge variant="success">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
            </div>
          ) : qbo.connected ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-bg-primary p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-text-muted">Connected Company</p>
                    <p className="font-medium text-text-primary">{qbo.companyName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Connected Since</p>
                    <p className="font-medium text-text-primary">
                      {qbo.connectedAt
                        ? new Date(qbo.connectedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Data import coming soon. Your connection is active.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  loading={disconnecting}
                  className="text-danger border-danger/30 hover:bg-danger-light"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-text-secondary mb-4">
                Connect your QuickBooks Online account to automatically import expenditure
                and payroll data into your LCA reports. Eliminates manual data re-entry.
              </p>
              {isPro ? (
                <a href="/api/integrations/qbo/connect">
                  <Button size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Connect QuickBooks
                  </Button>
                </a>
              ) : (
                <div className="rounded-lg border border-accent/20 bg-accent-light p-3 flex items-center justify-between">
                  <p className="text-sm text-text-secondary">Available on <span className="font-semibold text-accent">Pro</span> and <span className="font-semibold text-accent">Enterprise</span> plans.</p>
                  <a href="/dashboard/settings/billing">
                    <Button size="sm" variant="outline">Upgrade</Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future integrations placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src="/xero-logo.png" alt="Xero" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <CardTitle className="text-base text-text-muted">Xero</CardTitle>
              <p className="text-sm text-text-muted mt-0.5">Coming soon</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Xero integration for accounting data import will be available in a future update.
          </p>
        </CardContent>
      </Card>

      {/* Zapier */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src="/zapier-logo.svg" alt="Zapier" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <CardTitle className="text-base">Zapier</CardTitle>
              <p className="text-sm text-text-muted mt-0.5">Connect LCA Desk to 5,000+ apps</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary mb-4">
            Automate workflows between LCA Desk and your existing tools — Slack notifications on submission, Google Sheets exports, email alerts, and more.
          </p>
          <Badge variant="default">Coming Soon</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

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
    application_updates: true,
    opportunity_alerts: true,
    certificate_expiry: true,
    weekly_digest: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchUserNotificationPreferences()
      .then((p) => { if (p) setPrefs(prev => ({ ...prev, ...p })); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  async function toggle(id: string) {
    const newPrefs = { ...prefs, [id]: !prefs[id] };
    setPrefs(newPrefs);
    try {
      await updateUserNotificationPreferences({ [id]: newPrefs[id] });
      toast.success("Notification preference updated");
    } catch { toast.error("Failed to update"); }
  }

  const options = [
    { id: "deadline_reminders", label: "Deadline Reminders", description: "Email alerts when filing deadlines are approaching (30, 14, 7, 3, 1 days)" },
    { id: "filing_completion", label: "Filing Completion", description: "Confirmation when reports are submitted and locked" },
    { id: "application_updates", label: "Application Updates", description: "Notifications when job applications are received or status changes" },
    { id: "opportunity_alerts", label: "Opportunity Alerts", description: "Alerts when new opportunities match your profile" },
    { id: "certificate_expiry", label: "Certificate Expiry", description: "Warnings when LCS certificates are about to expire" },
    { id: "weekly_digest", label: "Weekly Digest", description: "Weekly summary of activity, deadlines, and opportunities" },
  ];

  if (!loaded) return <p className="text-text-muted text-sm">Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification Preferences</CardTitle>
        <p className="text-xs text-text-muted mt-1">Controls both in-app notifications and email alerts.</p>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {options.map((opt) => (
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

// ─── Features Tab ───────────────────────────────────────────────
function FeaturesTab() {
  const [prefs, setPrefs] = useState<FeaturePreferences>({
    smartMatching: true,
    opportunityAlerts: true,
    analytics: true,
    bidTracking: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFeaturePreferences()
      .then((p) => { setPrefs(p); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  async function handleToggle(key: keyof FeaturePreferences) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      await updateFeaturePreferences({ [key]: newPrefs[key] });
      toast.success("Feature preference updated");
    } catch { toast.error("Failed to update"); }
    setSaving(false);
  }

  const features: Array<{ key: keyof FeaturePreferences; label: string; description: string }> = [
    {
      key: "smartMatching",
      label: "Smart Matching",
      description: "Show recommended opportunities based on your company profile and service categories.",
    },
    {
      key: "opportunityAlerts",
      label: "Opportunity Alerts",
      description: "Receive email notifications when new opportunities match your profile.",
    },
    {
      key: "analytics",
      label: "Market Intelligence",
      description: "Access procurement analytics, contractor activity trends, and category breakdowns.",
    },
    {
      key: "bidTracking",
      label: "Bid Tracking",
      description: "Track which opportunities you've responded to and manage your bidding pipeline.",
    },
  ];

  if (!loaded) return <p className="text-text-muted text-sm">Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feature Preferences</CardTitle>
        <p className="text-xs text-text-muted mt-1">Toggle features on or off based on your workflow needs.</p>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {features.map((feat) => (
            <div key={feat.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-text-primary">{feat.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{feat.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[feat.key]}
                onClick={() => handleToggle(feat.key)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  prefs[feat.key] ? "bg-accent" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform",
                    prefs[feat.key] ? "translate-x-5" : "translate-x-0"
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
