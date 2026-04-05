"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        result.push(remaining.slice(0, boldMatch.index));
      }
      result.push(<strong key={`${keyPrefix}-b-${idx++}`}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    // No more matches — push rest
    result.push(remaining);
    break;
  }

  return result;
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const trimmed = line.trim();

    // Skip empty lines — just add spacing
    if (trimmed === "") {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-border" />);
      continue;
    }

    // Skip table separator rows (|---|---|)
    if (/^\|[-\s|:]+\|$/.test(trimmed)) continue;

    // Headings
    const h3Match = trimmed.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push(<p key={`h3-${i}`} className="font-bold text-text-primary mt-3 mb-1">{renderInline(h3Match[1], `h3-${i}`)}</p>);
      continue;
    }
    const h2Match = trimmed.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push(<p key={`h2-${i}`} className="font-bold text-text-primary text-base mt-3 mb-1">{renderInline(h2Match[1], `h2-${i}`)}</p>);
      continue;
    }
    const h1Match = trimmed.match(/^#\s+(.+)/);
    if (h1Match) {
      elements.push(<p key={`h1-${i}`} className="font-bold text-text-primary text-lg mt-3 mb-1">{renderInline(h1Match[1], `h1-${i}`)}</p>);
      continue;
    }

    // Bullet points (- item or * item)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 pl-2">
          <span className="text-accent mt-0.5">•</span>
          <span>{renderInline(bulletMatch[1], `li-${i}`)}</span>
        </div>
      );
      continue;
    }

    // Numbered list (1. item)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`ol-${i}`} className="flex gap-2 pl-2">
          <span className="text-accent font-medium min-w-[1.2em]">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2], `ol-${i}`)}</span>
        </div>
      );
      continue;
    }

    // Table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      elements.push(
        <div key={`tr-${i}`} className="flex gap-4 py-0.5">
          {cells.map((cell, ci) => (
            <span key={ci} className={ci === 0 ? "font-medium min-w-[120px]" : "text-text-secondary"}>
              {renderInline(cell, `tr-${i}-${ci}`)}
            </span>
          ))}
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`ln-${i}`} className="my-0.5">{renderInline(line, `ln-${i}`)}</p>);
  }

  return <>{elements}</>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Do I need to include sole-sourced contracts in my expenditure report?",
  "What are the minimum Guyanese employment percentages by category?",
  "When is the H1 Half-Yearly Report due?",
  "What happens if I submit a late filing?",
  "What is the ISCO-08 Employment Classification?",
  "What are the penalties for false submissions?",
];

export function LcaExpertChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

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
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
      ]);
    }

    setStreaming(false);
    inputRef.current?.focus();
  }, [messages, streaming]);

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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Messages area */}
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
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-xl px-4 py-3 text-sm leading-relaxed max-w-[80%]",
                  msg.role === "user"
                    ? "bg-accent text-white"
                    : "bg-bg-card border border-border text-text-primary"
                )}
              >
                <div className="whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
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
          Trained on the Local Content Act and Version 4.1 Submission Guideline. Always verify critical compliance decisions with a qualified advisor.
        </p>
      </div>
    </div>
  );
}
