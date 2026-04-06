"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import {
  LifeBuoy, Plus, MessageSquare, Clock, CheckCircle, AlertCircle,
  Send, ImagePlus, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import {
  createSupportTicket, fetchMyTickets, fetchTicketWithReplies, addTicketReply,
} from "@/server/actions";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "accent" | "warning" | "success" }> = {
  open: { label: "Open", variant: "warning" },
  in_progress: { label: "In Progress", variant: "accent" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "default" },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: "default" | "accent" | "warning" | "danger" }> = {
  low: { label: "Low", variant: "default" },
  normal: { label: "Normal", variant: "accent" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "danger" },
};

const CATEGORIES = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "billing", label: "Billing" },
  { value: "filing", label: "Filing Help" },
];

export default function SupportPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedData, setExpandedData] = useState<any>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  // Create form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMyTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    setCreating(true);
    try {
      const ticket = await createSupportTicket({
        subject, description, category, priority,
        screenshotUrls: screenshotPreviews.length > 0 ? screenshotPreviews : undefined,
        pageUrl: window.location.href,
      });
      setTickets(prev => [ticket, ...prev]);
      toast.success("Support ticket created! We'll get back to you soon.");
      setCreateOpen(false);
      setSubject(""); setDescription(""); setCategory("general");
      setPriority("normal"); setScreenshotPreviews([]);
    } catch {
      toast.error("Failed to create ticket");
    }
    setCreating(false);
  };

  const handleExpand = async (ticketId: string) => {
    if (expandedId === ticketId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ticketId);
    setExpandedLoading(true);
    try {
      const data = await fetchTicketWithReplies(ticketId);
      setExpandedData(data);
    } catch {
      toast.error("Failed to load ticket details");
    }
    setExpandedLoading(false);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !expandedId) return;
    setReplying(true);
    try {
      await addTicketReply(expandedId, replyText.trim());
      const data = await fetchTicketWithReplies(expandedId);
      setExpandedData(data);
      setReplyText("");
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    }
    setReplying(false);
  };

  const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;

  return (
    <div>
      <TopBar title="Support" action={{ label: "New Ticket", onClick: () => setCreateOpen(true) }} />
      <div className="p-4 sm:p-8 max-w-4xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4">
            <p className="text-xs text-text-muted">Total Tickets</p>
            <p className="text-2xl font-bold text-text-primary">{tickets.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Open</p>
            <p className="text-2xl font-bold text-warning">{openCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted">Resolved</p>
            <p className="text-2xl font-bold text-success">{tickets.filter(t => t.status === "resolved").length}</p>
          </Card>
        </div>

        {/* Tickets list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="No support tickets"
            description="Need help? Create a ticket and we'll get back to you."
            actionLabel="Create Ticket"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const statusCfg = STATUS_CONFIG[ticket.status || "open"];
              const priorityCfg = PRIORITY_CONFIG[ticket.priority || "normal"];
              const isExpanded = expandedId === ticket.id;

              return (
                <Card key={ticket.id}>
                  <CardContent className="p-0">
                    <div
                      className="p-4 cursor-pointer hover:bg-bg-primary/30 transition-colors"
                      onClick={() => handleExpand(ticket.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                            <Badge variant={priorityCfg.variant} className="text-[10px]">{priorityCfg.label}</Badge>
                            <span className="text-[10px] text-text-muted capitalize">{ticket.category}</span>
                          </div>
                          <h3 className="text-sm font-medium text-text-primary">{ticket.subject}</h3>
                          <p className="text-xs text-text-muted mt-1 line-clamp-1">{ticket.description}</p>
                          <p className="text-[11px] text-text-muted mt-1">
                            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                            }) : ""}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border-light px-4 pb-4 pt-3 space-y-4">
                        {expandedLoading ? (
                          <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
                          </div>
                        ) : expandedData ? (
                          <>
                            {/* Original description */}
                            <div className="bg-bg-primary rounded-lg p-3">
                              <p className="text-sm text-text-secondary whitespace-pre-wrap">{expandedData.ticket.description}</p>
                            </div>

                            {/* Screenshots */}
                            {expandedData.ticket.screenshotUrls && (() => {
                              try {
                                const urls = JSON.parse(expandedData.ticket.screenshotUrls) as string[];
                                return urls.length > 0 ? (
                                  <div>
                                    <p className="text-xs text-text-muted mb-2">Attachments:</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {urls.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                          className="border border-border rounded-lg overflow-hidden hover:border-accent transition-colors">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={url} alt={`Screenshot ${i + 1}`} className="h-20 w-auto object-cover" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : null;
                              } catch { return null; }
                            })()}

                            {/* Replies */}
                            {expandedData.replies.length > 0 && (
                              <div className="space-y-3">
                                {expandedData.replies.map((reply: { id: string; message: string; isAdmin: boolean; userName: string; createdAt: Date }) => (
                                  <div
                                    key={reply.id}
                                    className={`rounded-lg p-3 ${reply.isAdmin ? "bg-accent-light border border-accent/20" : "bg-bg-primary"}`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-medium text-text-primary">
                                        {reply.userName || "User"}
                                      </span>
                                      {reply.isAdmin && <Badge variant="accent" className="text-[9px]">Support</Badge>}
                                      <span className="text-[10px] text-text-muted">
                                        {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString("en-US", {
                                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                        }) : ""}
                                      </span>
                                    </div>
                                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{reply.message}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply input */}
                            {ticket.status !== "closed" && (
                              <div className="flex gap-2">
                                <textarea
                                  className="flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                                  rows={2}
                                  placeholder="Add a reply..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                />
                                <Button onClick={handleReply} loading={replying} className="self-end">
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-accent" />
                Create Support Ticket
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-text-primary">Subject *</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-primary">Category</label>
                  <Select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    options={CATEGORIES}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary">Priority</label>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    options={[
                      { value: "low", label: "Low" },
                      { value: "normal", label: "Normal" },
                      { value: "high", label: "High" },
                      { value: "urgent", label: "Urgent" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Description *</label>
                <textarea
                  className="w-full h-32 px-3 py-2 rounded-lg bg-white border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail. What were you trying to do? What happened instead? Include any error messages."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-text-muted" />
                  Screenshots (optional)
                </label>
                <div
                  className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-accent/40 transition-colors"
                  onClick={() => document.getElementById("screenshot-upload")?.click()}
                >
                  <ImagePlus className="h-6 w-6 text-text-muted mx-auto mb-1" />
                  <p className="text-xs text-text-muted">Click to upload or drag & drop</p>
                  <p className="text-[10px] text-text-muted">PNG, JPG up to 5MB each</p>
                </div>
                <input
                  id="screenshot-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    Array.from(files).forEach(file => {
                      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is too large (max 5MB)`); return; }
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          setScreenshotPreviews(prev => [...prev, reader.result as string]);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = "";
                  }}
                />
                {screenshotPreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {screenshotPreviews.map((src, i) => (
                      <div key={i} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Screenshot ${i + 1}`} className="h-16 w-auto rounded-lg border border-border object-cover" />
                        <button
                          type="button"
                          onClick={() => setScreenshotPreviews(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-danger text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} loading={creating}>
                  <Send className="h-4 w-4 mr-2" /> Submit Ticket
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
