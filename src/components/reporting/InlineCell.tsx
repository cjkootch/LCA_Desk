"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InlineCellProps {
  value: string | number | null;
  field: string;
  recordId: string;
  isNumeric?: boolean;
  onSave: (id: string, field: string, value: string | number) => Promise<void>;
  locked?: boolean;
  className?: string;
  formatter?: (val: string | number | null) => string;
}

export function InlineCell({ value, field, recordId, isNumeric, onSave, locked, className, formatter }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    if (editValue === String(value ?? "")) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(recordId, field, isNumeric ? (parseFloat(editValue) || 0) : editValue);
      setEditing(false);
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setEditValue(String(value ?? "")); setEditing(false); }
    if (e.key === "Tab") { e.preventDefault(); handleSave(); }
  };

  if (locked || !onSave) {
    const display = formatter ? formatter(value) : (value || "—");
    return <span className={className}>{display}</span>;
  }

  if (editing) {
    return (
      <input ref={inputRef} type={isNumeric ? "number" : "text"} step={isNumeric ? "0.01" : undefined}
        value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave}
        disabled={saving}
        className={cn("w-full h-7 px-1.5 rounded border border-accent bg-white text-sm focus:outline-none focus:ring-1 focus:ring-accent", isNumeric && "text-right font-mono", className)}
      />
    );
  }

  const display = formatter ? formatter(value) : (value || "—");
  return (
    <span onClick={() => { setEditValue(String(value ?? "")); setEditing(true); }}
      className={cn("cursor-pointer hover:bg-accent-light rounded px-1 py-0.5 -mx-1 transition-colors", className)}
      title="Click to edit">
      {display}
    </span>
  );
}
