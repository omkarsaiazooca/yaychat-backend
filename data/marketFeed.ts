export type MarketFeedItem = {
  id: string;                // `${symbol}-${updatedAt}`
  symbol: string;            // e.g. "AAPL" or "BTC/USD"
  category: "Stock" | "Crypto";
  lastPrice: number;
  change: number;            // close - open over the 24h window
  changePct: number;         // (change / open) * 100
  updatedAt: string;         // ISO timestamp of latest candle
};

export type TDSeriesPoint = {
  datetime: string;
  close: string;
};

export type TDTimeSeries = {
  meta?: { symbol?: string };
  values?: TDSeriesPoint[];
  status?: string;
};

export type TDResponse =
  | { [symbol: string]: TDTimeSeries }     // multi-symbol map
  | { data?: TDTimeSeries[] }              // array form
  | { status?: string; message?: string }; // error
