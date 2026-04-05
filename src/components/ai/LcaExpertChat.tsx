"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
                <div className="whitespace-pre-wrap">{msg.content}</div>
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
