"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { UpgradeModal } from "@/components/shared/UpgradeModal";

interface UpgradePromptState {
  open: boolean;
  reason: string;
  currentLimit?: number;
  usedCount?: number;
}

interface UpgradePromptContextValue {
  showUpgradePrompt: (reason: string, currentLimit?: number, usedCount?: number) => void;
}

const UpgradePromptContext = createContext<UpgradePromptContextValue | null>(null);

export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpgradePromptState>({ open: false, reason: "" });

  const showUpgradePrompt = useCallback((reason: string, currentLimit?: number, usedCount?: number) => {
    setState({ open: true, reason, currentLimit, usedCount });
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return (
    <UpgradePromptContext.Provider value={{ showUpgradePrompt }}>
      {children}
      {state.open && (
        <UpgradeModal
          reason={state.reason}
          currentLimit={state.currentLimit}
          usedCount={state.usedCount}
          onClose={dismiss}
        />
      )}
    </UpgradePromptContext.Provider>
  );
}

export function useUpgradePrompt(): UpgradePromptContextValue {
  const ctx = useContext(UpgradePromptContext);
  if (!ctx) {
    // Outside provider — return safe no-op so components don't crash
    return { showUpgradePrompt: () => {} };
  }
  return ctx;
}
