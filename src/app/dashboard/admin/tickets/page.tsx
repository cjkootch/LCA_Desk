"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  MessageSquare, Send, ChevronDown, ChevronUp, User,
  ArrowLeft,
} from "lucide-react";
import {
  checkSuperAdmin, fetchAllTickets, fetchTicketWithReplies,
  adminReplyToTicket, adminUpdateTicketStatus,
} from "@/server/actions";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "warning" | "accent" | "success" }> = {
  open: { label: "Open", variant: "warning" },
  in_progress: { label: "In Progress", variant: "accent" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "default" },
};

export default function AdminTicketsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tickets, setTickets] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedData, setExpandedData] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkSuperAdmin().then(isAdmin => {
      if (!isAdmin) { router.replace("/dashboard"); return; }
      setAuthorized(true);
      fetchAllTickets().then(setTickets).catch(() => {}).finally(() => setLoading(false));
    }).catch(() => router.replace("/dashboard"));
  }, [router]);

  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const data = await fetchTicketWithReplies(id);
      setExpandedData(data);
    } catch { toast.error("Failed to load ticket"); }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !expandedId) return;
    setReplying(true);
    try {
      await adminReplyToTicket(expandedId, replyText.trim());
      const data = await fetchTicketWithReplies(expandedId);
      setExpandedData(data);
      setReplyText("");
      // Update status in list
      setTickets(prev => prev.map(t => t.id === expandedId ? { ...t, status: "in_progress" } : t));
      toast.success("Reply sent");
    } catch { toast.error("Failed to reply"); }
    setReplying(false);
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    try {
      await adminUpdateTicketStatus(ticketId, status);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
      toast.success(`Ticket ${status}`);
    } catch { toast.error("Failed to update"); }
  };

  if (loading || !authorized) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  }

  const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;

  return (
    <div>
      <TopBar title="Support Tickets" description={`${openCount} open · ${tickets.length} total`} />
      <div className="p-4 sm:p-8 max-w-4xl">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>

        {tickets.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-text-muted">No tickets yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => {
              const statusCfg = STATUS_CONFIG[ticket.status || "open"];
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
                            <span className="text-xs text-text-muted capitalize">{ticket.priority} · {ticket.category}</span>
                          </div>
                          <h3 className="text-sm font-medium text-text-primary">{ticket.subject}</h3>
                          <p className="text-xs text-text-muted mt-0.5">
                            {ticket.userName || ticket.userEmail} · {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            value={ticket.status || "open"}
                            onChange={(e) => { e.stopPropagation(); handleStatusChange(ticket.id, e.target.value); }}
                            options={[
                              { value: "open", label: "Open" },
                              { value: "in_progress", label: "In Progress" },
                              { value: "resolved", label: "Resolved" },
                              { value: "closed", label: "Closed" },
                            ]}
                            className="w-28 text-xs"
                          />
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && expandedData && (
                      <div className="border-t border-border-light px-4 pb-4 pt-3 space-y-3">
                        <div className="bg-bg-primary rounded-lg p-3">
                          <p className="text-sm text-text-secondary whitespace-pre-wrap">{expandedData.ticket.description}</p>
                        </div>

                        {expandedData.replies?.length > 0 && (
                          <div className="space-y-2">
                            {expandedData.replies.map((r: { id: string; message: string; isAdmin: boolean; userName: string; createdAt: Date }) => (
                              <div key={r.id} className={cn("rounded-lg p-3", r.isAdmin ? "bg-accent-light border border-accent/20" : "bg-bg-primary")}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium">{r.userName || "User"}</span>
                                  {r.isAdmin && <Badge variant="accent" className="text-xs">Admin</Badge>}
                                  <span className="text-xs text-text-muted">
                                    {r.createdAt ? new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                                  </span>
                                </div>
                                <p className="text-sm text-text-secondary whitespace-pre-wrap">{r.message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <textarea
                            className="flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                            rows={2}
                            placeholder="Type your reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <Button onClick={handleReply} loading={replying} className="self-end">
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
