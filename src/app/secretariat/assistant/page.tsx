"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send, Bot, User, Shield, Plus, MessageSquare, Trash2,
} from "lucide-react";
import {
  fetchChatConversations, fetchChatMessages,
  createChatConversation, saveChatMessage, deleteChatConversation,
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
  "Which companies are below the 75% managerial employment minimum?",
  "What is the overall sector LC rate and how does it trend?",
  "Draft amendment request language for a company with incomplete employment data",
  "What enforcement actions are available for late or non-filing companies?",
  "Compare the compliance posture of the top 5 filers by expenditure",
  "Which submissions should I prioritize reviewing and why?",
  "What does Section 23 say about penalties for false submissions?",
  "How many companies have submitted via the platform vs email?",
];

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

    if (trimmed.startsWith("### ")) {
      elements.push(<p key={`h3-${i}`} className="font-semibold text-text-primary mt-3 mb-1">{renderInline(trimmed.replace(/^###\s*/, ""), `h3-${i}`)}</p>);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(<p key={`h2-${i}`} className="font-bold text-text-primary text-base mt-4 mb-1">{renderInline(trimmed.replace(/^##\s*/, ""), `h2-${i}`)}</p>);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(<p key={`h1-${i}`} className="font-bold text-text-primary text-lg mt-4 mb-2">{renderInline(trimmed.replace(/^#\s+/, ""), `h1-${i}`)}</p>);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) { elements.push(<div key={`li-${i}`} className="flex gap-2 pl-2"><span className="text-gold mt-0.5">•</span><span>{renderInline(bulletMatch[1], `li-${i}`)}</span></div>); continue; }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) { elements.push(<div key={`ol-${i}`} className="flex gap-2 pl-2"><span className="text-gold font-medium min-w-[1.2em]">{numMatch[1]}.</span><span>{renderInline(numMatch[2], `ol-${i}`)}</span></div>); continue; }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      elements.push(<div key={`tr-${i}`} className="flex gap-4 py-0.5">{cells.map((cell, ci) => (<span key={ci} className={ci === 0 ? "font-medium min-w-[120px]" : "text-text-secondary"}>{renderInline(cell, `tr-${i}-${ci}`)}</span>))}</div>);
      continue;
    }

    elements.push(<p key={`ln-${i}`} className="my-0.5">{renderInline(lines[i], `ln-${i}`)}</p>);
  }
  return <>{elements}</>;
}

export default function SecretariatAssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchChatConversations()
      .then(convs => { setConversations(convs); setLoadingConvs(false); })
      .catch(() => setLoadingConvs(false));
  }, []);

  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    fetchChatMessages(activeConvId).then(msgs => {
      setMessages(msgs.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    });
  }, [activeConvId]);

  const startNewChat = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  const deleteChat = useCallback(async (convId: string) => {
    await deleteChatConversation(convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvId === convId) { setActiveConvId(null); setMessages([]); }
  }, [activeConvId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    let convId = activeConvId;
    try {
      if (!convId) {
        const conv = await createChatConversation(text.trim());
        convId = conv.id;
        setActiveConvId(convId);
        setConversations(prev => [conv, ...prev]);
      }
      await saveChatMessage(convId, "user", text.trim());
    } catch { /* persist failure — chat still works */ }

    try {
      const response = await fetch("/api/ai/secretariat-chat", {
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

      try {
        if (convId) {
          await saveChatMessage(convId, "assistant", accumulated);
          const convs = await fetchChatConversations();
          setConversations(convs);
        }
      } catch { /* persist failure */ }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    }

    setStreaming(false);
    inputRef.current?.focus();
  }, [messages, streaming, activeConvId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="p-0">
      <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
        {/* Conversation sidebar */}
        <div className={cn(
          "w-64 border-r border-border bg-bg-surface flex flex-col shrink-0",
          "max-lg:fixed max-lg:top-14 max-lg:left-60 max-lg:z-30 max-lg:h-[calc(100vh-3.5rem)] max-lg:shadow-lg",
          !sidebarOpen && "max-lg:hidden"
        )}>
          <div className="p-3 border-b border-border">
            <Button onClick={startNewChat} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-1" /> New Analysis
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs ? (
              <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gold" /></div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No conversations yet</p>
            ) : (
              conversations.map(conv => (
                <div key={conv.id}
                  className={cn("group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                    activeConvId === conv.id ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-primary"
                  )}
                  onClick={() => { setActiveConvId(conv.id); setSidebarOpen(false); }}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button onClick={e => { e.stopPropagation(); deleteChat(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-opacity">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface shrink-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1 text-text-muted hover:text-text-primary">
              <MessageSquare className="h-4 w-4" />
            </button>
            <Shield className="h-5 w-5 text-gold" />
            <div>
              <h1 className="text-sm font-semibold text-text-primary">Compliance Analyst</h1>
              <p className="text-[10px] text-text-muted">AI-powered regulatory analysis with sector-wide compliance data</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 rounded-full bg-gold/10 mb-4">
                  <Shield className="h-8 w-8 text-gold" />
                </div>
                <h2 className="text-xl font-heading font-bold text-text-primary mb-2">
                  Compliance Analyst
                </h2>
                <p className="text-text-secondary max-w-md mb-8 text-sm">
                  Analyze submissions, identify compliance gaps, draft enforcement actions, and get regulatory guidance — powered by sector-wide filing data.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)}
                      className="text-left p-3 rounded-lg border border-border bg-bg-card hover:bg-bg-primary hover:border-gold/30 transition-colors text-sm text-text-secondary">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3 max-w-3xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
                  <div className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
                    msg.role === "user" ? "bg-[#1e293b] text-white" : "bg-gold/10 text-gold"
                  )}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={cn("rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[80%]",
                    msg.role === "user" ? "bg-[#1e293b] text-white" : "bg-bg-card border border-border text-text-primary"
                  )}>
                    <div>{renderMarkdown(msg.content)}</div>
                    {msg.role === "assistant" && streaming && i === messages.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-gold animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border bg-bg-surface p-4 shrink-0">
            <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="max-w-3xl mx-auto flex gap-3">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about compliance trends, review priorities, enforcement options..."
                className="flex-1 resize-none rounded-lg border border-border bg-white px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-gold focus:border-gold"
                rows={1} disabled={streaming}
              />
              <Button type="submit" disabled={!input.trim() || streaming} className="self-end">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-text-muted text-center mt-2">
              Analysis is based on the Local Content Act and live submission data. Always verify before taking enforcement action.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
