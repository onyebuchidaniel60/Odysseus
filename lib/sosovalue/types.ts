export interface Constituent {
  currency_id: string;
  symbol: string;
  weight: number;
}

export interface RawConstituent {
  currency_id: string;
  symbol: string;
  weight: number;
}

export interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawKline {
  timestamp: string | number;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume?: string | number | null;
}

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  details?: unknown;
}
