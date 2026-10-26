import type { NumericValue } from "./types";

export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function toNumber(value: NumericValue | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(
  value: NumericValue | null | undefined,
  digits = 2,
  signed = false,
): string {
  const parsed = toNumber(value);

  if (parsed === null) {
    return "—";
  }

  const formatted = parsed.toFixed(digits);
  return signed && parsed > 0 ? `+${formatted}` : formatted;
}

export function formatPercent(
  value: NumericValue | null | undefined,
  options: { digits?: number; signed?: boolean } = {},
): string {
  const parsed = toNumber(value);

  if (parsed === null) {
    return "—";
  }

  const { digits = 2, signed = false } = options;
  const formatted = (parsed * 100).toFixed(digits);
  return `${signed && parsed > 0 ? "+" : ""}${formatted}%`;
}

export function formatUsd(value: NumericValue | null | undefined): string {
  const parsed = toNumber(value);

  if (parsed === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

export function formatDateTime(
  value: string | null | undefined,
  short = false,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    short
      ? {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      : {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short",
        },
  ).format(date);
}

export function humanizeKey(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

export function formatConfidence(value: NumericValue | null | undefined): string {
  return formatPercent(value, { digits: 0 });
}

export function formatCheckValue(
  name: string,
  value: NumericValue | null | undefined,
): string {
  switch (name) {
    case "data_confidence":
    case "ai_confidence":
      return formatPercent(value, { digits: 1 });
    case "spread":
    case "stop_loss":
      return formatPercent(value, { digits: 2 });
    case "depth":
    case "position_size":
      return formatUsd(value);
    default:
      return typeof value === "number"
        ? formatNumber(value)
        : String(value ?? "—");
  }
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
