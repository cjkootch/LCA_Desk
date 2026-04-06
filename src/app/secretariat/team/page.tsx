"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Users, Plus, Shield, Mail } from "lucide-react";
import { fetchSecretariatDashboard, addSecretariatMember } from "@/server/actions";
import { toast } from "sonner";

export default function SecretariatTeamPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("reviewer");
  const [inviting, setInviting] = useState(false);
  const [officeId, setOfficeId] = useState("");

  useEffect(() => {
    fetchSecretariatDashboard().then(data => {
      setMembers(data.members);
      if (data.officeId) setOfficeId(data.officeId);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !officeId) { toast.error("Email required"); return; }
    setInviting(true);
    try {
      await addSecretariatMember(officeId, inviteEmail.trim(), inviteRole);
      toast.success(`${inviteEmail} added as ${inviteRole}`);
      setInviteEmail("");
      const fresh = await fetchSecretariatDashboard();
      setMembers(fresh.members);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    }
    setInviting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-gold" />
        <div>
          <h1 className="text-xl font-heading font-bold text-text-primary">Team Management</h1>
          <p className="text-sm text-text-secondary">Manage who can review and acknowledge submissions</p>
        </div>
      </div>

      {/* Add member */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Add Team Member</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Email address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="flex-1" />
            <Select value={inviteRole} onChange={e => setInviteRole(e.target.value)} options={[
              { value: "viewer", label: "Viewer" },
              { value: "reviewer", label: "Reviewer" },
              { value: "admin", label: "Admin" },
            ]} className="w-32" />
            <Button onClick={handleInvite} loading={inviting}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            User must have an LCA Desk account. Viewers can see submissions. Reviewers can acknowledge. Admins can manage the team.
          </p>
        </CardContent>
      </Card>

      {/* Current members */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Current Members ({members.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((m: { id: string; userName: string | null; userEmail: string; role: string }) => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-bg-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-text-muted">{(m.userName || m.userEmail).charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{m.userName || m.userEmail}</p>
                    <p className="text-xs text-text-muted">{m.userEmail}</p>
                  </div>
                </div>
                <Badge variant={m.role === "admin" ? "accent" : m.role === "reviewer" ? "default" : "default"} className="text-[10px]">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
