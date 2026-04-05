"use client";

import { forwardRef, useState, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  showStrength?: boolean;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 20, label: "Weak", color: "bg-danger" };
  if (score === 2) return { score: 40, label: "Fair", color: "bg-warning" };
  if (score === 3) return { score: 60, label: "Good", color: "bg-warning" };
  if (score === 4) return { score: 80, label: "Strong", color: "bg-accent" };
  return { score: 100, label: "Very strong", color: "bg-accent" };
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, showStrength = false, id, value, onChange, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const strength = useMemo(
      () => (showStrength ? getStrength(typeof value === "string" ? value : "") : null),
      [value, showStrength]
    );

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            value={value}
            onChange={onChange}
            className={cn(
              "w-full h-10 px-3 pr-10 rounded-lg bg-white border text-text-primary placeholder:text-text-muted text-sm transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
              error ? "border-danger" : "border-border",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {showStrength && strength && typeof value === "string" && value.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i <= Math.ceil(strength.score / 20) ? strength.color : "bg-border"
                  )}
                />
              ))}
            </div>
            <p className={cn(
              "text-xs",
              strength.score <= 40 ? "text-danger" : strength.score <= 60 ? "text-warning" : "text-success"
            )}>
              {strength.label}
            </p>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
export { PasswordInput };
