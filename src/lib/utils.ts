import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currencyCode: string = "GYD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode === "GYD" ? "USD" : currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount).replace("$", currencyCode === "GYD" ? "GY$" : "$");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "submitted":
    case "acknowledged":
      return "text-success";
    case "in_progress":
    case "review":
      return "text-accent";
    case "not_started":
      return "text-text-muted";
    default:
      return "text-text-secondary";
  }
}

export function getComplianceColor(rate: number, minimum: number): string {
  if (rate >= minimum) return "text-success";
  if (rate >= minimum * 0.8) return "text-warning";
  return "text-danger";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}
