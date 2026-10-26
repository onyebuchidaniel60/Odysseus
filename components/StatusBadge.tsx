"use client";

import { cn } from "./format";

type BadgeSize = "sm" | "md" | "lg";

interface StatusBadgeProps {
  decision?: string | null;
  validationStatus?: string | null;
  size?: BadgeSize;
  className?: string;
}

const toneClasses = {
  accent: "border-accent/30 bg-accent/10 text-accent",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  muted: "border-white/10 bg-white/[0.03] text-muted",
} as const;

const dotClasses = {
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  muted: "bg-muted",
} as const;

const sizeClasses = {
  sm: "gap-1.5 px-2 py-0.5 text-[10px]",
  md: "gap-2 px-2.5 py-1 text-[11px]",
  lg: "gap-2.5 px-3.5 py-1.5 text-sm",
} as const;

function resolveBadge(
  decision?: string | null,
  validationStatus?: string | null,
) {
  const raw = decision?.trim() || validationStatus?.trim();

  if (!raw) {
    return { label: "UNKNOWN", tone: "muted" as const };
  }

  const normalized = raw.toUpperCase().replace(/\s+/g, "_");

  switch (normalized) {
    case "SHORT":
      return { label: "SHORT", tone: "accent" as const };
    case "LONG":
      return { label: "LONG", tone: "success" as const };
    case "NO_TRADE":
      return { label: "NO TRADE", tone: "warning" as const };
    case "PASS":
    case "PASSED":
      return { label: "PASS", tone: "success" as const };
    case "FAIL":
    case "FAILED":
      return { label: "FAIL", tone: "danger" as const };
    case "APPROVED":
      return { label: "APPROVED", tone: "success" as const };
    case "REJECTED":
      return { label: "REJECTED", tone: "danger" as const };
    case "PENDING":
      return { label: "PENDING", tone: "muted" as const };
    default:
      return { label: raw.replace(/_/g, " "), tone: "muted" as const };
  }
}

export function StatusBadge({
  decision,
  validationStatus,
  size = "md",
  className,
}: StatusBadgeProps) {
  const badge = resolveBadge(decision, validationStatus);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-mono font-semibold uppercase tracking-[0.16em]",
        toneClasses[badge.tone],
        sizeClasses[size],
        className,
      )}
      title={decision ?? validationStatus ?? undefined}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          dotClasses[badge.tone],
        )}
      />
      {badge.label}
    </span>
  );
}
