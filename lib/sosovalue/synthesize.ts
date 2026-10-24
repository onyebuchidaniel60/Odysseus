import type { Constituent, Kline } from "./types";

const BASE_INDEX_VALUE = 1000;

export class SoSoSynthesisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SoSoSynthesisError";
  }
}

function assertKline(kline: Kline, symbol: string): void {
  if (
    !Number.isFinite(kline.timestamp) ||
    !Number.isFinite(kline.open) ||
    !Number.isFinite(kline.high) ||
    !Number.isFinite(kline.low) ||
    !Number.isFinite(kline.close) ||
    !Number.isFinite(kline.volume)
  ) {
    throw new SoSoSynthesisError(
      `Constituent ${symbol} has a non-numeric kline value`,
    );
  }

  if (
    kline.open <= 0 ||
    kline.high <= 0 ||
    kline.low <= 0 ||
    kline.close <= 0 ||
    kline.volume < 0
  ) {
    throw new SoSoSynthesisError(
      `Constituent ${symbol} has a non-positive kline value`,
    );
  }

  if (
    kline.high < kline.low ||
    kline.high < kline.open ||
    kline.high < kline.close ||
    kline.low > kline.open ||
    kline.low > kline.close
  ) {
    throw new SoSoSynthesisError(
      `Constituent ${symbol} has an inconsistent kline`,
    );
  }
}

export function synthesizeIndexKlines(
  constituents: Constituent[],
  constituentKlines: Record<string, Kline[]>,
): Kline[] {
  if (constituents.length === 0) {
    throw new SoSoSynthesisError("At least one constituent is required");
  }

  const weightSum = constituents.reduce(
    (sum, constituent) => sum + constituent.weight,
    0,
  );

  if (!Number.isFinite(weightSum) || weightSum <= 0) {
    throw new SoSoSynthesisError(
      "Constituent weights must sum to a positive number",
    );
  }

  const prepared = constituents.map((constituent) => {
    if (!Number.isFinite(constituent.weight) || constituent.weight < 0) {
      throw new SoSoSynthesisError(
        `Constituent ${constituent.symbol} has an invalid weight`,
      );
    }

    const klines =
      constituentKlines[constituent.symbol] ??
      constituentKlines[constituent.currency_id];

    if (!klines || klines.length === 0) {
      throw new SoSoSynthesisError(
        `Missing klines for constituent ${constituent.symbol}`,
      );
    }

    const byTimestamp = new Map<number, Kline>();

    for (const kline of klines) {
      assertKline(kline, constituent.symbol);

      if (byTimestamp.has(kline.timestamp)) {
        throw new SoSoSynthesisError(
          `Duplicate kline timestamp ${kline.timestamp} for ${constituent.symbol}`,
        );
      }

      byTimestamp.set(kline.timestamp, kline);
    }

    return {
      symbol: constituent.symbol,
      weight: constituent.weight / weightSum,
      klines: byTimestamp,
    };
  });

  const [first, ...rest] = prepared;
  const commonTimestamps = [...first.klines.keys()]
    .filter((timestamp) => rest.every((entry) => entry.klines.has(timestamp)))
    .sort((left, right) => left - right);

  if (commonTimestamps.length < 2) {
    throw new SoSoSynthesisError(
      "At least two common timestamps are required to synthesize index klines",
    );
  }

  const firstTimestamp = commonTimestamps[0];
  const firstVolume = prepared.reduce(
    (sum, entry) => sum + entry.weight * entry.klines.get(firstTimestamp)!.volume,
    0,
  );

  const output: Kline[] = [
    {
      timestamp: firstTimestamp,
      open: BASE_INDEX_VALUE,
      high: BASE_INDEX_VALUE,
      low: BASE_INDEX_VALUE,
      close: BASE_INDEX_VALUE,
      volume: firstVolume,
    },
  ];

  for (
    let index = 1;
    index < commonTimestamps.length;
    index += 1
  ) {
    const timestamp = commonTimestamps[index];
    const previousTimestamp = commonTimestamps[index - 1];
    const previousIndexClose = output[index - 1].close;

    let openReturn = 0;
    let highReturn = 0;
    let lowReturn = 0;
    let closeReturn = 0;
    let volume = 0;

    for (const entry of prepared) {
      const previous = entry.klines.get(previousTimestamp)!;
      const current = entry.klines.get(timestamp)!;

      if (previous.close <= 0) {
        throw new SoSoSynthesisError(
          `Constituent ${entry.symbol} has a non-positive close at ${previousTimestamp}`,
        );
      }

      openReturn += entry.weight * (current.open / previous.close - 1);
      highReturn += entry.weight * (current.high / previous.close - 1);
      lowReturn += entry.weight * (current.low / previous.close - 1);
      closeReturn += entry.weight * (current.close / previous.close - 1);
      volume += entry.weight * current.volume;
    }

    const open = previousIndexClose * (1 + openReturn);
    const high = previousIndexClose * (1 + highReturn);
    const low = previousIndexClose * (1 + lowReturn);
    const close = previousIndexClose * (1 + closeReturn);

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0 ||
      volume < 0
    ) {
      throw new SoSoSynthesisError(
        `Synthesized index kline at ${timestamp} is invalid`,
      );
    }

    if (
      high < low ||
      high < open ||
      high < close ||
      low > open ||
      low > close
    ) {
      throw new SoSoSynthesisError(
        `Synthesized index kline at ${timestamp} has inconsistent OHLC values`,
      );
    }

    output.push({ timestamp, open, high, low, close, volume });
  }

  return output;
}
