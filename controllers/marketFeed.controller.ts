import { Request, Response } from "express";
import { MarketFeedItem, TDSeriesPoint } from "../data/marketFeed";
import { tdFetch24hTimeSeries } from "../platform/marketFeed.operations";

const DEFAULT_STOCKS = ["AAPL", "TSLA", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "SNP500"];
const DEFAULT_CRYPTO = ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "ADA/USD", "DOGE/USD", "MATIC/USD", "DOT/USD", "LTC/USD", "LINK/USD", "AVAX/USD", "XLM/USD"];

function isCryptoSymbol(sym: string) {
  // Simple heuristic: crypto pairs usually include "/"
  return sym.includes("/");
}

function toNumber(n?: string) {
  const x = Number(n);
  return Number.isFinite(x) ? x : NaN;
}

function computeChange(values: TDSeriesPoint[]) {
  // Ensure oldest->newest
  const sorted = [...values].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const open = toNumber(first?.close);
  const close = toNumber(last?.close);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return null;

  const change = close - open;
  const changePct = open !== 0 ? (change / open) * 100 : 0;
  return { open, close, change, changePct, updatedAt: last.datetime };
}

/**
 * GET /api/market/mixed24h
 * Query params:
 *  - stocks=CSV (default AAPL,TSLA,MSFT,NVDA,GOOGL,AMZN,META,SNP500)
 *  - crypto=CSV (default BTC/USD,ETH/USD,SOL/USD,XRP/USD,ADA/USD,DOGE/USD,MATIC/USD,DOT/USD,LTC/USD,LINK/USD,AVAX/USD,XLM/USD)
 *  - interval=5min|1min|15min ... (default 5min)
 *  - outputsize=number (default 288 → 24h @5min)
 *  - timezone=IANA tz (optional)
 *  - limit=number (default 15)    → page size
 *  - page=number (default 1)      → page index (1-based)
 *
 * Response:
 * {
 *   ok: true,
 *   meta: {
 *     limit, page,
 *     totals: { combined, crypto, stocks },
 *     hasMore: { combined, crypto, stocks }
 *   },
 *   combined: [...paged items...],
 *   crypto:   [...paged crypto items...],
 *   stocks:   [...paged stock items...]
 * }
 */
export async function getMixed24hFeed(req: Request, res: Response) {
  try {
    const {
      stocks,
      crypto,
      interval = "5min",
      outputsize,
      timezone,
      limit,
      page,
    } = req.query as Record<string, string | undefined>;

    const stockList =
      stocks?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_STOCKS;

    const cryptoList =
      crypto?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_CRYPTO;

    const symbols = [...stockList, ...cryptoList];
    const outsize = outputsize ? Number(outputsize) : 288;

    // pagination params
    const pageSize = Math.max(1, Math.min(100, Number(limit ?? 15))); // cap to 100 just in case
    const pageIndex = Math.max(1, Number(page ?? 1));

    const seriesMap = await tdFetch24hTimeSeries({
      symbols,
      interval,
      outputsize: outsize,
      timezone,
    });

    const all: MarketFeedItem[] = [];

    for (const sym of Object.keys(seriesMap)) {
      const series = seriesMap[sym];
      const values = series?.values ?? [];
      if (!values.length) continue;

      const stats = computeChange(values);
      if (!stats) continue;

      const { close, change, changePct, updatedAt } = stats;

      all.push({
        id: `${sym}-${updatedAt}`,
        symbol: sym,
        category: isCryptoSymbol(sym) ? "Crypto" : "Stock",
        lastPrice: close,
        change,
        changePct,
        updatedAt: new Date(updatedAt).toISOString(),
      });
    }

    // newest first
    all.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const cryptoOnly = all.filter((x) => x.category === "Crypto");
    const stocksOnly = all.filter((x) => x.category === "Stock");

    // paginate helper
    const slicePage = <T,>(arr: T[]) => {
      const start = (pageIndex - 1) * pageSize;
      const end = start + pageSize;
      const data = arr.slice(start, end);
      const hasMore = end < arr.length;
      return { data, hasMore };
    };

    const combinedPage = slicePage(all);
    const cryptoPage = slicePage(cryptoOnly);
    const stocksPage = slicePage(stocksOnly);

    res.json({
      ok: true,
      meta: {
        limit: pageSize,
        page: pageIndex,
        totals: {
          combined: all.length,
          crypto: cryptoOnly.length,
          stocks: stocksOnly.length,
        },
        hasMore: {
          combined: combinedPage.hasMore,
          crypto: cryptoPage.hasMore,
          stocks: stocksPage.hasMore,
        },
      },
      combined: combinedPage.data,
      crypto: cryptoPage.data,
      stocks: stocksPage.data,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown error",
    });
  }
}
