"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
} from "lucide-react";
import {
  fetchChatConversations,
  fetchChatMessages,
  createChatConversation,
  saveChatMessage,
  deleteChatConversation,
} from "@/server/actions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: Date | null;
}

const SUGGESTED_QUESTIONS = [
  "Do I need to include sole-sourced contracts in my expenditure report?",
  "What are the minimum Guyanese employment percentages by category?",
  "When is the H1 Half-Yearly Report due?",
  "What happens if I submit a late filing?",
  "What is the ISCO-08 Employment Classification?",
  "What are the penalties for false submissions?",
];

// ─── Markdown renderer ──────────────────────────────────────────
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) result.push(remaining.slice(0, boldMatch.index));
      result.push(<strong key={`${keyPrefix}-b-${idx++}`}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    result.push(remaining);
    break;
  }
  return result;
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === "") { elements.push(<div key={`sp-${i}`} className="h-2" />); continue; }
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) { elements.push(<hr key={`hr-${i}`} className="my-3 border-border" />); continue; }
    if (/^\|[-\s|:]+\|$/.test(trimmed)) continue;

    // Headings — check h3 first (most specific), then h2, then h1
    if (trimmed.startsWith("### ") || trimmed.startsWith("###")) {
      const content = trimmed.replace(/^###\s*/, "");
      elements.push(<p key={`h3-${i}`} className="font-semibold text-text-primary mt-3 mb-1">{renderInline(content, `h3-${i}`)}</p>);
      continue;
    }
    if (trimmed.startsWith("## ") || trimmed.startsWith("##")) {
      const content = trimmed.replace(/^##\s*/, "");
      elements.push(<p key={`h2-${i}`} className="font-bold text-text-primary text-base mt-4 mb-1">{renderInline(content, `h2-${i}`)}</p>);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      const content = trimmed.replace(/^#\s+/, "");
      elements.push(<p key={`h1-${i}`} className="font-bold text-text-primary text-lg mt-4 mb-2">{renderInline(content, `h1-${i}`)}</p>);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) { elements.push(<div key={`li-${i}`} className="flex gap-2 pl-2"><span className="text-accent mt-0.5">•</span><span>{renderInline(bulletMatch[1], `li-${i}`)}</span></div>); continue; }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) { elements.push(<div key={`ol-${i}`} className="flex gap-2 pl-2"><span className="text-accent font-medium min-w-[1.2em]">{numMatch[1]}.</span><span>{renderInline(numMatch[2], `ol-${i}`)}</span></div>); continue; }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      elements.push(<div key={`tr-${i}`} className="flex gap-4 py-0.5">{cells.map((cell, ci) => (<span key={ci} className={ci === 0 ? "font-medium min-w-[120px]" : "text-text-secondary"}>{renderInline(cell, `tr-${i}-${ci}`)}</span>))}</div>);
      continue;
    }

    elements.push(<p key={`ln-${i}`} className="my-0.5">{renderInline(lines[i], `ln-${i}`)}</p>);
  }
  return <>{elements}</>;
}

// ─── Main Page ───────────────────────────────────────────────────
export default function ExpertPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    fetchChatConversations()
      .then((convs) => {
        setConversations(convs);
        setLoadingConvs(false);
      })
      .catch(() => setLoadingConvs(false));
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    fetchChatMessages(activeConvId).then((msgs) => {
      setMessages(
        msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    });
  }, [activeConvId]);

  const startNewChat = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    inputRef.current?.focus();
  }, []);

  const deleteChat = useCallback(async (convId: string) => {
    await deleteChatConversation(convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) {
      setActiveConvId(null);
      setMessages([]);
    }
  }, [activeConvId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Create conversation if needed
    let convId = activeConvId;
    if (!convId) {
      const conv = await createChatConversation(text.trim());
      convId = conv.id;
      setActiveConvId(convId);
      setConversations((prev) => [conv, ...prev]);
    }

    // Save user message
    await saveChatMessage(convId, "user", text.trim());

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: "assistant", content: accumulated }]);
      }

      // Save assistant message
      await saveChatMessage(convId, "assistant", accumulated);

      // Refresh conversation list to get updated title
      const convs = await fetchChatConversations();
      setConversations(convs);
    } catch {
      const errorMsg = "Sorry, I couldn't process that. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: errorMsg }]);
    }

    setStreaming(false);
    inputRef.current?.focus();
  }, [messages, streaming, activeConvId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div>
      <TopBar title="Ask the LCA Expert" description="AI-powered compliance assistant trained on the Local Content Act" />
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Chat sidebar */}
        <div className="w-64 border-r border-border bg-bg-surface flex flex-col">
          <div className="p-3 border-b border-border">
            <Button onClick={startNewChat} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                    activeConvId === conv.id
                      ? "bg-accent-light text-accent"
                      : "text-text-secondary hover:bg-bg-primary"
                  )}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 rounded-full bg-accent-light mb-4">
                  <Sparkles className="h-8 w-8 text-accent" />
                </div>
                <h2 className="text-xl font-heading font-bold text-text-primary mb-2">
                  Ask the LCA Expert
                </h2>
                <p className="text-text-secondary max-w-md mb-8">
                  Get instant answers to any Local Content Act compliance question.
                  Trained on the complete Act, all Secretariat guidelines, and Version 4.1.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-left p-3 rounded-lg border border-border bg-bg-card hover:bg-bg-primary hover:border-accent/30 transition-colors text-sm text-text-secondary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3 max-w-3xl",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
                      msg.role === "user"
                        ? "bg-accent text-white"
                        : "bg-accent-light text-accent"
                    )}
                  >
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[80%]",
                      msg.role === "user"
                        ? "bg-accent text-white"
                        : "bg-bg-card border border-border text-text-primary"
                    )}
                  >
                    <div>{renderMarkdown(msg.content)}</div>
                    {msg.role === "assistant" && streaming && i === messages.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border bg-bg-surface p-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask any LCA compliance question..."
                className="flex-1 resize-none rounded-lg border border-border bg-white px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                rows={1}
                disabled={streaming}
              />
              <Button type="submit" disabled={!input.trim() || streaming} className="self-end">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-text-muted text-center mt-2">
              Trained on the Local Content Act and Version 4.1 Submission Guideline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
