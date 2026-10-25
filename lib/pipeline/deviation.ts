import type { Constituent, Kline } from "../sosovalue/types";

export interface DeviationSignal {
  symbol: string;
  weight: number;
  constituentReturn: number;
  indexReturn: number;
  weightDeviation: number;
  zScore: number;
  direction: "overextended" | "lagging";
}

const WINDOW_DAYS = 30;
const MAD_SCALE = 1.4826;

export class DeviationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviationError";
  }
}

interface ReturnPoint {
  timestamp: number;
  value: number;
}

function findKlines(
  constituent: Constituent,
  constituentKlines: Record<string, Kline[]>,
): Kline[] | undefined {
  return (
    constituentKlines[constituent.symbol] ??
    constituentKlines[constituent.currency_id]
  );
}

function computeDailyReturns(klines: Kline[], days: number): ReturnPoint[] {
  const completeKlines = klines.slice(0, -1);

  if (completeKlines.length < 2) {
    throw new DeviationError(
      "At least two complete klines are required to compute returns",
    );
  }

  const start = Math.max(1, completeKlines.length - days);
  const points: ReturnPoint[] = [];

  for (let index = start; index < completeKlines.length; index += 1) {
    const previousClose = completeKlines[index - 1].close;
    const currentClose = completeKlines[index].close;

    if (
      !Number.isFinite(previousClose) ||
      !Number.isFinite(currentClose) ||
      previousClose <= 0
    ) {
      throw new DeviationError(
        `Invalid close prices at timestamp ${completeKlines[index].timestamp}`,
      );
    }

    points.push({
      timestamp: completeKlines[index].timestamp,
      value: currentClose / previousClose - 1,
    });
  }

  return points;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function robustZScore(values: number[], latest: number): number {
  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));

  if (mad > 0) {
    return (latest - center) / (MAD_SCALE * mad);
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation > 0) {
    return (latest - center) / standardDeviation;
  }

  return 0;
}

export function computeDeviations(
  constituents: Constituent[],
  constituentKlines: Record<string, Kline[]>,
  syntheticIndexKlines: Kline[],
): DeviationSignal[] {
  const indexReturns = computeDailyReturns(syntheticIndexKlines, WINDOW_DAYS);

  if (indexReturns.length === 0) {
    throw new DeviationError("Synthetic index has no daily returns");
  }

  const signals = constituents.map((constituent) => {
    const klines = findKlines(constituent, constituentKlines);

    if (!klines) {
      throw new DeviationError(
        `Missing klines for constituent ${constituent.symbol}`,
      );
    }

    const constituentReturns = computeDailyReturns(klines, WINDOW_DAYS);
    const returnsByTimestamp = new Map(
      constituentReturns.map((point) => [point.timestamp, point.value]),
    );

    const alignedReturns = indexReturns.map((indexPoint) => {
      const value = returnsByTimestamp.get(indexPoint.timestamp);

      if (value === undefined) {
        throw new DeviationError(
          `Constituent ${constituent.symbol} is missing a kline at timestamp ${indexPoint.timestamp}`,
        );
      }

      return value;
    });

    const deviations = indexReturns.map(
      (indexPoint, index) =>
        constituent.weight * (alignedReturns[index] - indexPoint.value),
    );

    const latestIndex = indexReturns.length - 1;
    const latestDeviation = deviations[latestIndex];
    const direction: "overextended" | "lagging" =
      latestDeviation > 0 ? "overextended" : "lagging";

    return {
      symbol: constituent.symbol,
      weight: constituent.weight,
      constituentReturn: alignedReturns[latestIndex],
      indexReturn: indexReturns[latestIndex].value,
      weightDeviation: latestDeviation,
      zScore: robustZScore(deviations, latestDeviation),
      direction,
    };
  });

  signals.sort(
    (left, right) => Math.abs(right.zScore) - Math.abs(left.zScore),
  );

  return signals;
}
