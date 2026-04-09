"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Megaphone, Plus, Edit2, Trash2, Send, Clock, Eye,
  AlertTriangle, Info, CheckCircle, Calendar,
} from "lucide-react";
import {
  fetchAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} from "@/server/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "filer", label: "Filers" },
  { value: "supplier", label: "Suppliers" },
  { value: "seeker", label: "Job Seekers" },
  { value: "secretariat", label: "Secretariat" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal", icon: Info, color: "text-accent" },
  { value: "important", label: "Important", icon: AlertTriangle, color: "text-warning" },
  { value: "urgent", label: "Urgent", icon: AlertTriangle, color: "text-danger" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Announcement = any;

function statusBadge(status: string) {
  switch (status) {
    case "published": return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Live</Badge>;
    case "scheduled": return <Badge variant="accent"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
    case "draft": return <Badge variant="default"><Edit2 className="h-3 w-3 mr-1" />Draft</Badge>;
    case "expired": return <Badge variant="warning">Expired</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

function priorityIcon(priority: string) {
  const opt = PRIORITY_OPTIONS.find(p => p.value === priority);
  if (!opt) return null;
  const Icon = opt.icon;
  return <Icon className={cn("h-4 w-4", opt.color)} />;
}

function formatTargetRoles(targetRoles: string) {
  if (targetRoles === "all") return "All Users";
  try {
    const roles = JSON.parse(targetRoles) as string[];
    return roles.map(r => r.charAt(0).toUpperCase() + r.slice(1) + "s").join(", ");
  } catch {
    return targetRoles;
  }
}

function toLocalDatetime(d: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [targetAll, setTargetAll] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchAnnouncements()
      .then(setItems)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setTitle(""); setBody(""); setPriority("normal");
    setTargetAll(true); setSelectedRoles([]);
    setPublishAt(""); setExpiresAt("");
    setShowEditor(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title); setBody(a.body); setPriority(a.priority);
    if (a.targetRoles === "all") {
      setTargetAll(true); setSelectedRoles([]);
    } else {
      setTargetAll(false);
      try { setSelectedRoles(JSON.parse(a.targetRoles)); } catch { setSelectedRoles([]); }
    }
    setPublishAt(toLocalDatetime(a.publishAt));
    setExpiresAt(toLocalDatetime(a.expiresAt));
    setShowEditor(true);
  };

  const handleSave = async (publishNow = false) => {
    if (!title.trim() || !body.trim()) { toast.error("Title and body are required"); return; }
    setSaving(true);
    try {
      const targetRoles = targetAll ? "all" : JSON.stringify(selectedRoles);
      const pa = publishNow ? null : (publishAt || null);
      const ea = expiresAt || null;

      if (editing) {
        await updateAnnouncement(editing.id, {
          title, body, priority, targetRoles,
          publishAt: pa, expiresAt: ea,
          status: publishNow ? "published" : undefined,
        });
        toast.success("Announcement updated");
      } else {
        await createAnnouncement({
          title, body, priority, targetRoles,
          publishAt: pa, expiresAt: ea,
        });
        toast.success(publishNow || !pa ? "Announcement published" : "Announcement scheduled");
      }
      setShowEditor(false);
      load();
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteAnnouncement(id);
      toast.success("Announcement deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
    setDeleting(null);
  };

  const handlePublish = async (id: string) => {
    try {
      await updateAnnouncement(id, { status: "published" });
      toast.success("Published");
      load();
    } catch { toast.error("Failed"); }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  const published = items.filter((a: Announcement) => a.status === "published");
  const scheduled = items.filter((a: Announcement) => a.status === "scheduled");
  const drafts = items.filter((a: Announcement) => a.status === "draft");
  const expired = items.filter((a: Announcement) => a.status === "expired" || (a.expiresAt && new Date(a.expiresAt) < new Date() && a.status !== "draft"));

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-gold" />
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Announcements</h1>
            <p className="text-sm text-text-secondary">Create and manage announcements for platform users</p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> New Announcement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Live", count: published.length, color: "text-success" },
          { label: "Scheduled", count: scheduled.length, color: "text-accent" },
          { label: "Drafts", count: drafts.length, color: "text-text-muted" },
          { label: "Expired", count: expired.length, color: "text-warning" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-xs text-text-muted">{s.label}</span>
              <span className={cn("text-lg font-bold", s.color)}>{s.count}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Announcement list */}
      <div className="space-y-3">
        {items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">No announcements yet. Create one to notify platform users.</p>
            </CardContent>
          </Card>
        )}
        {items.map((a: Announcement) => {
          const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
          return (
            <Card key={a.id} className={cn(isExpired && a.status !== "draft" && "opacity-60")}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {priorityIcon(a.priority)}
                      <h3 className="text-sm font-semibold text-text-primary truncate">{a.title}</h3>
                      {statusBadge(isExpired && a.status !== "draft" ? "expired" : a.status)}
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 mb-2">{a.body}</p>
                    <div className="flex items-center gap-4 text-[10px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {formatTargetRoles(a.targetRoles)}
                      </span>
                      {a.publishAt && a.status === "scheduled" && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Publishes {new Date(a.publishAt).toLocaleDateString()} {new Date(a.publishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {a.expiresAt && (
                        <span>Expires {new Date(a.expiresAt).toLocaleDateString()}</span>
                      )}
                      {a.authorName && <span>By {a.authorName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(a.status === "draft" || a.status === "scheduled") && (
                      <Button variant="ghost" size="sm" onClick={() => handlePublish(a.id)} title="Publish now">
                        <Send className="h-3.5 w-3.5 text-success" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}
                      loading={deleting === a.id}>
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={showEditor} onOpenChange={open => { if (!open) setShowEditor(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-gold" />
              {editing ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-text-muted">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Filing deadline extended" className="mt-1" />
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted">Body</label>
              <textarea className="w-full mt-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none h-24"
                value={body} onChange={e => setBody(e.target.value)} placeholder="Write the announcement content..." />
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-medium text-text-muted mb-1.5 block">Priority</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => setPriority(p.value)}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                      priority === p.value ? "border-accent bg-accent/5 text-accent" : "border-border hover:border-accent/30 text-text-secondary"
                    )}>
                    <p.icon className={cn("h-3.5 w-3.5", p.color)} /> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target audience */}
            <div>
              <label className="text-xs font-medium text-text-muted mb-1.5 block">Who should see this?</label>
              <div className="space-y-2">
                <button onClick={() => { setTargetAll(true); setSelectedRoles([]); }}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm border-2 transition-all",
                    targetAll ? "border-accent bg-accent/5 text-accent font-medium" : "border-border hover:border-accent/30"
                  )}>
                  All Users
                </button>
                <button onClick={() => setTargetAll(false)}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm border-2 transition-all",
                    !targetAll ? "border-accent bg-accent/5 text-accent font-medium" : "border-border hover:border-accent/30"
                  )}>
                  Specific Roles
                </button>
                {!targetAll && (
                  <div className="flex flex-wrap gap-2 ml-1">
                    {ROLE_OPTIONS.map(r => (
                      <button key={r.value} onClick={() => toggleRole(r.value)}
                        className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all",
                          selectedRoles.includes(r.value)
                            ? "border-accent bg-accent text-white"
                            : "border-border text-text-secondary hover:border-accent/30"
                        )}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-muted">Publish Date (optional)</label>
                <Input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)} className="mt-1" />
                <p className="text-[10px] text-text-muted mt-0.5">Leave empty to publish immediately</p>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted">Expiration Date (optional)</label>
                <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="mt-1" />
                <p className="text-[10px] text-text-muted mt-0.5">Leave empty for no expiration</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
              {!editing && (
                <Button variant="outline" onClick={() => handleSave(false)} loading={saving}>
                  <Clock className="h-4 w-4 mr-1" />
                  {publishAt ? "Schedule" : "Save Draft"}
                </Button>
              )}
              <Button onClick={() => handleSave(true)} loading={saving}>
                <Send className="h-4 w-4 mr-1" />
                {editing ? "Save" : "Publish Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
