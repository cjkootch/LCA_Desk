"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X, Send, Sparkles, Minimize2, Maximize2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FloatingChatWidgetProps {
  endpoint?: string;
  title?: string;
  subtitle?: string;
  quickQuestions?: string[];
  accentColor?: string;
  icon?: React.ElementType;
  pageContext?: string;
}

function renderInline(text: string, key: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;
  while (remaining.length > 0) {
    const m = remaining.match(/\*\*(.+?)\*\*/);
    if (m && m.index !== undefined) {
      if (m.index > 0) result.push(remaining.slice(0, m.index));
      result.push(<strong key={`${key}-${idx++}`}>{m[1]}</strong>);
      remaining = remaining.slice(m.index + m[0].length);
      continue;
    }
    result.push(remaining);
    break;
  }
  return result;
}

function renderMarkdown(text: string): React.ReactNode {
  return text.split("\n").map((line, i) => {
    const t = line.trim();
    if (t === "") return <div key={i} className="h-1.5" />;
    if (t.startsWith("### ")) return <p key={i} className="font-semibold text-text-primary mt-2 mb-0.5 text-xs">{renderInline(t.slice(4), `h3-${i}`)}</p>;
    if (t.startsWith("## ")) return <p key={i} className="font-bold text-text-primary mt-2 mb-0.5 text-xs">{renderInline(t.slice(3), `h2-${i}`)}</p>;
    if (t.match(/^[-*]\s+/)) return <div key={i} className="flex gap-1.5 ml-1"><span className="text-accent text-xs">•</span><span className="text-xs">{renderInline(t.replace(/^[-*]\s+/, ""), `li-${i}`)}</span></div>;
    if (t.match(/^\d+\.\s+/)) { const m = t.match(/^(\d+)\.\s+(.*)/); return <div key={i} className="flex gap-1.5 ml-1"><span className="text-accent text-xs font-medium">{m?.[1]}.</span><span className="text-xs">{renderInline(m?.[2] || "", `ol-${i}`)}</span></div>; }
    return <p key={i} className="text-xs">{renderInline(t, `p-${i}`)}</p>;
  });
}

const DEFAULT_QUICK_QUESTIONS = [
  "What are my filing deadlines?",
  "What's my current LC rate?",
  "Which employment categories am I below minimum?",
];

export function FloatingChatWidget({
  endpoint = "/api/ai/chat",
  title = "LCA Expert",
  subtitle = "AI-powered compliance assistant",
  quickQuestions = DEFAULT_QUICK_QUESTIONS,
  accentColor = "bg-accent",
  icon: IconComponent = Sparkles,
  pageContext,
}: FloatingChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    // Prepend page context if available
    const contextPrefix = pageContext
      ? `[The user is currently viewing: ${pageContext}]\n\n`
      : "";

    const userMsg: Message = { role: "user", content: text.trim() };
    const apiMessages = [...messages, { role: "user" as const, content: contextPrefix + text.trim() }];
    const displayMessages = [...messages, userMsg];
    setMessages(displayMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!res.ok) throw new Error();
      const reader = res.body?.getReader();
      if (!reader) throw new Error();

      const decoder = new TextDecoder();
      let accumulated = "";
      setMessages([...displayMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...displayMessages, { role: "assistant", content: accumulated }]);
      }
    } catch {
      setMessages([...displayMessages, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    }
    setStreaming(false);
  }, [messages, streaming, endpoint, pageContext]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className={cn("fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group", accentColor)}
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
        title={`Ask ${title}`}>
        <IconComponent className="h-6 w-6 group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <div className={cn(
      "fixed z-50 bg-bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200",
      expanded ? "bottom-4 right-4 w-[480px] h-[600px]" : "bottom-6 right-6 w-[380px] h-[500px]"
    )}>
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 border-b border-border text-white shrink-0", accentColor)}>
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4" />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-white/70">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <IconComponent className="h-8 w-8 text-accent mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium text-text-primary mb-1">Ask anything</p>
            <p className="text-sm text-text-muted mb-4">{subtitle}</p>
            <div className="space-y-1.5">
              {quickQuestions.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-accent/30 hover:bg-bg-primary transition-colors text-text-secondary">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "")}>
              <div className={cn(
                "rounded-xl px-3 py-2 max-w-[85%] text-xs leading-relaxed",
                msg.role === "user" ? cn(accentColor, "text-white") : "bg-bg-primary border border-border text-text-primary"
              )}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                {msg.role === "assistant" && streaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-3 bg-accent animate-pulse ml-0.5" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask a question..."
            className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            rows={1} disabled={streaming}
          />
          <Button type="submit" size="sm" disabled={!input.trim() || streaming} className="self-end h-8 w-8 p-0">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
