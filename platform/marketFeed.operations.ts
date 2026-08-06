import { keys } from "../config/keys";
import { TDResponse, TDTimeSeries } from "../data/marketFeed";

const TD_BASE = "https://api.twelvedata.com";

function getApiKey(): string {
  const key = keys.TwelveDataApiKey?.key;
  if (!key) throw new Error("TWELVE_DATA_API_KEY is not set");
  return key;
}

/**
 * Fetch 24h time series (default 5min bars, 288 points) for mixed symbols.
 * @param symbols e.g. ["AAPL","MSFT","BTC/USD","ETH/USD"]
 * @param interval default "5min"
 * @param outputsize default 288 (24h at 5min)
 * @param timezone optional e.g. "UTC"
 */
export async function tdFetch24hTimeSeries(params: {
  symbols: string[];
  interval?: string;
  outputsize?: number;
  timezone?: string;
}): Promise<Record<string, TDTimeSeries>> {
  const {
    symbols,
    interval = "5min",
    outputsize = 288,
    timezone
  } = params;

  if (!symbols.length) return {};

  const url = new URL(`${TD_BASE}/time_series`);
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", getApiKey());
  if (timezone) url.searchParams.set("timezone", timezone);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Twelve Data error ${res.status}`);
  }

  const json = (await res.json()) as TDResponse;

  // Normalize to symbol -> series map
  const map: Record<string, TDTimeSeries> = {};

  if (json && typeof json === "object" && !("data" in json)) {
    // Likely map form
    for (const [k, v] of Object.entries(json)) {
      if ((v as any)?.status === "error") continue;
      map[k] = v as TDTimeSeries;
    }
    return map;
  }

  if ("data" in json && Array.isArray(json.data)) {
    for (const series of json.data) {
      const sym = series?.meta?.symbol;
      if (!sym) continue;
      map[sym] = series;
    }
    return map;
  }

  throw new Error("Unexpected Twelve Data response shape");
}
