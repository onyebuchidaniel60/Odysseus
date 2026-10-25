import { synthesizeIndexKlines } from "../sosovalue/synthesize";
import type { Constituent, Kline } from "../sosovalue/types";

export interface ValidationResult {
  passed: boolean;
  reason?: string;
  trackingError?: number;
}

const REQUIRED_CONSTITUENT_COUNT = 7;
const MIN_KLINE_HISTORY = 30;
const WEIGHT_SUM_MIN = 0.99;
const WEIGHT_SUM_MAX = 1.01;
const TRACKING_WINDOW_DAYS = 30;
const TRACKING_ERROR_TOLERANCE = 0.005;

function findKlines(
  constituent: Constituent,
  constituentKlines: Record<string, Kline[]>,
): Kline[] | undefined {
  return (
    constituentKlines[constituent.symbol] ??
    constituentKlines[constituent.currency_id]
  );
}

function timestampsMatch(left: Kline[], right: Kline[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (kline, index) => kline.timestamp === right[index].timestamp,
  );
}

export function validateData(
  constituents: Constituent[],
  constituentKlines: Record<string, Kline[]>,
  tokenKlines: Kline[],
): ValidationResult {
  if (constituents.length !== REQUIRED_CONSTITUENT_COUNT) {
    return { passed: false, reason: "invalid_constituent_count" };
  }

  const weightSum = constituents.reduce(
    (sum, constituent) => sum + constituent.weight,
    0,
  );

  if (
    !Number.isFinite(weightSum) ||
    weightSum < WEIGHT_SUM_MIN ||
    weightSum > WEIGHT_SUM_MAX
  ) {
    return { passed: false, reason: "invalid_weight_sum" };
  }

  const completeConstituentKlines: Kline[][] = [];

  for (const constituent of constituents) {
    const klines = findKlines(constituent, constituentKlines);

    if (!klines || klines.length < MIN_KLINE_HISTORY) {
      return { passed: false, reason: "insufficient_kline_history" };
    }

    completeConstituentKlines.push(klines.slice(0, -1));
  }

  if (tokenKlines.length < MIN_KLINE_HISTORY) {
    return { passed: false, reason: "insufficient_kline_history" };
  }

  const completeTokenKlines = tokenKlines.slice(0, -1);
  const windowBars = Math.min(
    TRACKING_WINDOW_DAYS + 1,
    completeTokenKlines.length,
    ...completeConstituentKlines.map((klines) => klines.length),
  );

  if (windowBars < 2) {
    return { passed: false, reason: "insufficient_kline_history" };
  }

  const tokenWindow = completeTokenKlines.slice(-windowBars);

  for (let index = 0; index < constituents.length; index += 1) {
    const constituentWindow = completeConstituentKlines[index].slice(
      -windowBars,
    );

    if (!timestampsMatch(constituentWindow, tokenWindow)) {
      return { passed: false, reason: "misaligned_klines" };
    }
  }

  const windowedConstituentKlines: Record<string, Kline[]> = {};

  for (let index = 0; index < constituents.length; index += 1) {
    windowedConstituentKlines[constituents[index].symbol] =
      completeConstituentKlines[index].slice(-windowBars);
  }

  let syntheticKlines: Kline[];

  try {
    syntheticKlines = synthesizeIndexKlines(
      constituents,
      windowedConstituentKlines,
    );
  } catch {
    return { passed: false, reason: "misaligned_klines" };
  }

  if (!timestampsMatch(syntheticKlines, tokenWindow)) {
    return { passed: false, reason: "misaligned_klines" };
  }

  const syntheticReturn =
    syntheticKlines[syntheticKlines.length - 1].close /
      syntheticKlines[0].close -
    1;
  const tokenReturn =
    tokenWindow[tokenWindow.length - 1].close / tokenWindow[0].close - 1;
  const trackingError = Math.abs(tokenReturn - syntheticReturn);

  if (!Number.isFinite(trackingError)) {
    return { passed: false, reason: "misaligned_klines" };
  }

  if (trackingError > TRACKING_ERROR_TOLERANCE) {
    return {
      passed: false,
      reason: "tracking_error_too_high",
      trackingError,
    };
  }

  return { passed: true, trackingError };
}
