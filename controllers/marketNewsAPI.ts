// === ADD INSIDE class BasicController ===
import { Request, Response } from "express";
import { createClient } from "redis";
import { keys } from "../config/keys";
import axios from "axios";

const redisClient = createClient({
    password: keys.RedisKey.key || process.env.REDIS_PASSWORD,
    socket: {
        host: "redis-11678.c289.us-west-1-2.ec2.cloud.redislabs.com",
        port: 11678,
    },
});

export class MarketNewController {
    constructor() { }

    private static DEFAULT_STOCKS = ["AAPL", "MSFT", "NVDA", "TSLA"];
    private static DEFAULT_HOURS = 24;
    private static CACHE_TTL_SECONDS = 12 * 60 * 60; // 12h

    private timeAgo(from: Date, to = new Date()): string {
        const ms = to.getTime() - from.getTime();
        const mins = Math.max(0, Math.floor(ms / 60000));
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    private async finnhubCompanyNews(symbols: string[], since: Date, until: Date) {
        const out: any[] = [];
        if (!symbols.length) return out;

        const token = process.env.FINNHUB_API_KEY;
        if (!token) throw new Error("FINNHUB_API_KEY not set");

        const fromStr = since.toISOString().slice(0, 10);
        const toStr = until.toISOString().slice(0, 10);

        // call per-symbol (be mindful of rate limits on free plans)
        await Promise.allSettled(symbols.map(async (sym) => {
            const url = new URL("https://finnhub.io/api/v1/company-news");
            url.searchParams.set("symbol", sym);
            url.searchParams.set("from", fromStr);
            url.searchParams.set("to", toStr);
            url.searchParams.set("token", token);

            const r = await axios.get(url.toString());
            const list = Array.isArray(r.data) ? r.data : [];
            for (const it of list) {
                const ts = ((it?.datetime ?? 0) * 1000);
                const pub = new Date(ts);
                if (pub < since || pub > until) continue;
                out.push({
                    id: `finnhub-stock-${sym}-${it?.id ?? ts}`,
                    title: it?.headline ?? "",
                    subtitle: it?.summary ?? "",
                    url: it?.url ?? "",
                    image: it?.image || undefined,
                    source: it?.source || "Finnhub",
                    category: "Stock",
                    symbols: [sym],
                    publishedAt: pub.toISOString(),
                    ago: this.timeAgo(pub),
                });
            }
        }));

        return out;
    }

    private async finnhubCryptoNews(since: Date, until: Date) {
        const token = process.env.FINNHUB_API_KEY;
        if (!token) throw new Error("FINNHUB_API_KEY not set");

        const url = new URL("https://finnhub.io/api/v1/news");
        url.searchParams.set("category", "crypto");
        url.searchParams.set("token", token);

        const r = await axios.get(url.toString());
        const list = Array.isArray(r.data) ? r.data : [];
        const out: any[] = [];

        for (const it of list) {
            const ts = ((it?.datetime ?? 0) * 1000);
            const pub = new Date(ts);
            if (pub < since || pub > until) continue;
            out.push({
                id: `finnhub-crypto-${it?.id ?? ts}`,
                title: it?.headline ?? "",
                subtitle: it?.summary ?? "",
                url: it?.url ?? "",
                image: it?.image || undefined,
                source: it?.source || "Finnhub",
                category: "Crypto",
                symbols: [],
                publishedAt: pub.toISOString(),
                ago: this.timeAgo(pub),
            });
        }

        return out;
    }

    /**
     * GET /api/v1/aiengine/marketNews
     * Query:
     *  - stocks=CSV          (default AAPL,MSFT,NVDA,TSLA)
     *  - hours=number        (default 24)
     *  - limit=1..100        (default 20)
     *  - page=number         (default 1)
     *
     * Uses Redis cache for 12h.
     */
    async getMarketNews(req: Request, res: Response) {
        try {
            const { stocks, hours, limit, page } = req.query as Record<string, string | undefined>;
            const stockSymbols =
                stocks?.split(",").map(s => s.trim()).filter(Boolean) ?? MarketNewController.DEFAULT_STOCKS;
            const hoursNum = hours ? Math.max(1, Number(hours)) : MarketNewController.DEFAULT_HOURS;

            // cache key includes stocks list + hours window
            const cacheKey = `marketNews:finnhub:last${hoursNum}h:${stockSymbols.join(",")}`;

            // ensure Redis connection
            if (!redisClient.isOpen) {
                await redisClient.connect();
            }

            // try cache
            const cached = await redisClient.get(cacheKey);
            let data: any[];
            let fetchedAt = Date.now();

            if (cached) {
                const parsed = JSON.parse(cached);
                data = parsed.items ?? [];
                fetchedAt = parsed.fetchedAt ?? fetchedAt;
            } else {
                // build fresh
                const until = new Date();
                const since = new Date(until.getTime() - hoursNum * 60 * 60 * 1000);

                const [stockNews, cryptoNews] = await Promise.all([
                    this.finnhubCompanyNews(stockSymbols, since, until),
                    this.finnhubCryptoNews(since, until),
                ]);

                const all = [...stockNews, ...cryptoNews];

                // sort desc
                all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

                // dedupe by url
                const seen = new Set<string>();
                const deduped: any[] = [];
                for (const n of all) {
                    const key = n.url || n.id;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    deduped.push(n);
                }

                data = deduped;

                // store in Redis for 12h
                await redisClient.set(
                    cacheKey,
                    JSON.stringify({ fetchedAt: Date.now(), items: data }),
                );
                await redisClient.expire(cacheKey, MarketNewController.CACHE_TTL_SECONDS);
            }

            // pagination
            const pageSize = Math.max(1, Math.min(100, Number(limit ?? 20)));
            const pageIndex = Math.max(1, Number(page ?? 1));
            const start = (pageIndex - 1) * pageSize;
            const end = start + pageSize;

            const combined = data.slice(start, end);
            const cryptoOnly = combined.filter(i => i.category === "Crypto");
            const stocksOnly = combined.filter(i => i.category === "Stock");

            res.status(200).json({
                ok: true,
                meta: {
                    limit: pageSize,
                    page: pageIndex,
                    totals: {
                        combined: data.length,
                        crypto: data.filter(i => i.category === "Crypto").length,
                        stocks: data.filter(i => i.category === "Stock").length,
                    },
                    hasMore: {
                        combined: end < data.length,
                        crypto: end < data.length,
                        stocks: end < data.length,
                    },
                    window: { hours: hoursNum },
                    cache: {
                        fetchedAt,
                        expiresInSeconds: await redisClient.ttl(cacheKey),
                    }
                },
                combined,
                crypto: cryptoOnly,
                stocks: stocksOnly,
            });
        } catch (err: any) {
            console.error("marketNews error:", err?.message || err);
            res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
        }
    }
}
