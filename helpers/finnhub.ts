import { keys } from "../config/keys";
import { NewsItem } from "../data/marketNews";

const BASE = "https://finnhub.io/api/v1";

function key() {
  const k = keys.FinnhubApiKey.key;
  if (!k) throw new Error("FINNHUB_API_KEY not set");
  return k;
}

function toISO(d: Date) {
  return d.toISOString();
}
function toDateStr(d: Date) {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function timeAgo(from: Date, to = new Date()): string {
  const ms = to.getTime() - from.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type FinnhubCompanyNews = {
  category?: string;
  datetime?: number; // seconds
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
};

type FinnhubGeneralNews = {
  category?: string; // "general" | "crypto" ...
  datetime?: number; // seconds
  headline?: string;
  id?: number;
  image?: string;
  source?: string;
  summary?: string;
  url?: string;
};

export async function finnhubCompanyNews(symbols: string[], from: Date, to: Date): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  if (symbols.length === 0) return results;

  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);

  // Call per symbol (Finnhub company-news is per symbol)
  // Consider throttling if you have many symbols / free plan.
  const tasks = symbols.map(async (sym) => {
    const url = new URL(`${BASE}/company-news`);
    url.searchParams.set("symbol", sym);
    url.searchParams.set("from", fromStr);
    url.searchParams.set("to", toStr);
    url.searchParams.set("token", key());

    const r = await fetch(url.toString());
    if (!r.ok) return;
    const list = (await r.json()) as FinnhubCompanyNews[];
    for (const it of list || []) {
      const ts = (it.datetime ?? 0) * 1000;
      const pub = new Date(ts);
      // Keep strictly last 24h
      if (pub < from || pub > to) continue;
      results.push({
        id: `finnhub-company-${sym}-${it.id ?? ts}`,
        title: it.headline ?? "",
        subtitle: it.summary ?? "",
        url: it.url ?? "",
        image: it.image || undefined,
        source: it.source || "Finnhub",
        category: "Stock",
        symbols: [sym],
        publishedAt: toISO(pub),
        ago: timeAgo(pub),
      });
    }
  });

  await Promise.allSettled(tasks);
  return results;
}

export async function finnhubCryptoNews(from: Date, to: Date): Promise<NewsItem[]> {
  const url = new URL(`${BASE}/news`);
  url.searchParams.set("category", "crypto");
  url.searchParams.set("token", key());

  const r = await fetch(url.toString());
  if (!r.ok) return [];

  const list = (await r.json()) as FinnhubGeneralNews[];
  const out: NewsItem[] = [];

  for (const it of list || []) {
    const ts = (it.datetime ?? 0) * 1000;
    const pub = new Date(ts);
    if (pub < from || pub > to) continue;

    out.push({
      id: `finnhub-crypto-${it.id ?? ts}`,
      title: it.headline ?? "",
      subtitle: it.summary ?? "",
      url: it.url ?? "",
      image: it.image || undefined,
      source: it.source || "Finnhub",
      category: "Crypto",
      symbols: [], // Finnhub crypto news isn't per-coin
      publishedAt: pub.toISOString(),
      ago: timeAgo(pub),
    });
  }

  return out;
}
