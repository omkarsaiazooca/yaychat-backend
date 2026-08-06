export type SelectionType = "crypto" | "stock" | "smart-mix";
export type Allocation = { symbol: string; weight: number }; // 0..100
export type SelectionResult =
  | { kind: "single"; symbol: string }
  | { kind: "mix"; allocations: Allocation[] };

const EXCLUDE_TITLES = new Set(["INEX", "IN500", "IUSD+", "INXC", "WIBS", "DACRAZY"]);

// title -> tradable symbol (normalize typos)
const TITLE_TO_SYMBOL: Record<string, string> = {
  // Stocks
  AMZN: "AMZN",
  APPL: "AAPL",
  TLSA: "TSLA",
  MSFT: "MSFT",
  NVDA: "NVDA",
  META: "META",
  GOOGL: "GOOGL",
  PEP: "PEP",
  SNP500: "SPX",
  BCM: "AVGO",

  // Crypto (USD)
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  SOL: "SOL/USD",
  DOGE: "DOGE/USD",
  SHIB: "SHIB/USD",
  DOT: "DOT/USD",
  CHZ: "CHZ/USD",
  VET: "VET/USD",
  AVAX: "AVAX/USD",
  THETA: "THETA/USD",
  NOT: "NOT/USD",
  FTM: "FTM/USD",
  RUNE: "RUNE/USD",
  NEAR: "NEAR/USD",
  AAVE: "AAVE/USD",
  INJ: "INJ/USD",
  PYTH: "PYTH/USD",
  ADA: "ADA/USD",
  XLM: "XLM/USD",
  SUI: "SUI/USD",
  MANA: "MANA/USD",
  BEAM: "BEAM/USD",
  LINK: "LINK/USD",
  LTC: "LTC/USD",
  MATIC: "MATIC/USD",
  TRX: "TRX/USD",
  TUSD: "TUSD/USD",
  USDC: "USDC/USD",
  USDT: "USDT/USD",
  XRP: "XRP/USD",
  BNB: "BNB/USD",
};

// Ultimate fallbacks (always tradeable in your stack)
const STOCK_FALLBACKS = ["MSFT", "AAPL", "GOOGL", "META", "PEP", "AMZN", "NVDA", "TSLA", "AVGO", "SPX"];
const CRYPTO_FALLBACKS = ["BTC/USD", "ETH/USD", "SOL/USD", "MATIC/USD", "LINK/USD", "XRP/USD", "ADA/USD"];

// ---------- helpers ----------
function dedupe<T>(arr: T[]) { return Array.from(new Set(arr)); }

function normalizeStockTitleToSymbol(title: string): string | undefined {
  const t = title.toUpperCase();
  if (TITLE_TO_SYMBOL[t]) return TITLE_TO_SYMBOL[t];
  // If the title already looks like a stock ticker (all caps letters), accept it.
  if (/^[A-Z.]{2,6}$/.test(t)) return t;
  return undefined;
}
function normalizeCryptoTitleToSymbol(title: string): string | undefined {
  const t = title.toUpperCase();
  if (TITLE_TO_SYMBOL[t]) return TITLE_TO_SYMBOL[t];
  // Default mapping if not present: assume USD pair
  if (/^[A-Z0-9-]{2,10}$/.test(t)) return `${t}/USD`;
  return undefined;
}

function buildUniverse(tokens: Array<any>) {
  const allowed = tokens.filter(t => !EXCLUDE_TITLES.has(String(t.title).toUpperCase()));

  const stockTitles = allowed.filter(t => t.isStock).map(t => String(t.title).toUpperCase());
  const cryptoTitles = allowed.filter(t => t.isCrypto && !t.isStock).map(t => String(t.title).toUpperCase());

  const mappedStocks = stockTitles
    .map(normalizeStockTitleToSymbol)
    .filter(Boolean) as string[];

  const mappedCrypto = cryptoTitles
    .map(normalizeCryptoTitleToSymbol)
    .filter(Boolean) as string[];

  let stocks = dedupe(mappedStocks);
  let crypto = dedupe(mappedCrypto);

  // Safety nets: if any universe is empty, inject fallbacks
  if (stocks.length === 0) stocks = [...STOCK_FALLBACKS];
  if (crypto.length === 0) crypto = [...CRYPTO_FALLBACKS];

  return { stocks, crypto };
}

// Deterministic pick per user
function stableIndex(seed: string, max: number) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % Math.max(1, max);
}
function pickOne(pool: string[], seed?: string) {
  // Never throw: if pool somehow empty, fall back to BTC/USD
  if (!pool || pool.length === 0) return "BTC/USD";
  return seed ? pool[stableIndex(seed, pool.length)] : pool[0];
}

// Band mapping for pool priority: 1–3 low, 4–6 medium, 7–9 high
type Band = "low" | "medium" | "high";
function bandFromScore(riskScore: number): Band {
  if (riskScore <= 3) return "low";
  if (riskScore <= 6) return "medium";
  return "high";
}

// Priority lists (used to order pool; anything not listed but allowed is appended)
const STOCK_PRIORITY: Record<Band, string[]> = {
  low: ["MSFT", "AAPL", "GOOGL", "META", "PEP", "SPX"],
  medium: ["AMZN", "NVDA", "TSLA", "AVGO", "SPX"],
  high: ["TSLA", "NVDA", "AMZN", "AVGO"],
};
const CRYPTO_PRIORITY: Record<Band, string[]> = {
  low: ["BTC/USD", "ETH/USD"],
  medium: ["SOL/USD", "MATIC/USD", "LINK/USD", "ADA/USD", "XRP/USD"],
  high: ["DOGE/USD", "SHIB/USD", "AVAX/USD", "INJ/USD", "SUI/USD", "NEAR/USD", "FTM/USD"],
};

function poolFromPriority(priority: string[], universe: string[], fallbacks: string[]) {
  if (!universe || universe.length === 0) return [...fallbacks];
  const u = new Set(universe);
  const primary = priority.filter(s => u.has(s));
  const rest = universe.filter(s => !primary.includes(s));
  const pooled = [...primary, ...rest];
  return pooled.length ? pooled : [...fallbacks];
}

// 9-step smart-mix curve (stocks%, crypto%)
const MIX_WEIGHTS: Record<number, { stock: number; crypto: number }> = {
  1: { stock: 80, crypto: 20 },
  2: { stock: 75, crypto: 25 },
  3: { stock: 70, crypto: 30 },
  4: { stock: 65, crypto: 35 },
  5: { stock: 60, crypto: 40 },
  6: { stock: 50, crypto: 50 },
  7: { stock: 40, crypto: 60 },
  8: { stock: 30, crypto: 70 },
  9: { stock: 20, crypto: 80 },
};

/**
 * Main numeric-risk selector (NEVER throws)
 */
export function pickByNumericRisk(opts: {
  type: SelectionType;
  riskScore: number;      // 1..9
  seed?: string;
  allTokens: Array<any>;
}): SelectionResult {
  const { type, riskScore, seed, allTokens } = opts;
  const score = Math.min(9, Math.max(1, Math.floor(Number(riskScore) || 1)));
  const band = bandFromScore(score);
  const uni = buildUniverse(allTokens);

  if (type === "stock") {
    const pool = poolFromPriority(STOCK_PRIORITY[band], uni.stocks, STOCK_FALLBACKS);
    return { kind: "single", symbol: pickOne(pool, seed) };
  }

  if (type === "crypto") {
    const pool = poolFromPriority(CRYPTO_PRIORITY[band], uni.crypto, CRYPTO_FALLBACKS);
    return { kind: "single", symbol: pickOne(pool, seed) };
  }

  // smart-mix
  const weights = MIX_WEIGHTS[score];
  const sPool = poolFromPriority(STOCK_PRIORITY[band], uni.stocks, STOCK_FALLBACKS);
  const cPool = poolFromPriority(CRYPTO_PRIORITY[band], uni.crypto, CRYPTO_FALLBACKS);

  // If one side is empty (super defensive), degrade to the other type as single
  if (!sPool.length && !cPool.length) {
    return { kind: "single", symbol: "BTC/USD" };
  }
  if (!sPool.length) {
    return { kind: "single", symbol: pickOne(cPool, `c:${seed ?? ""}`) };
  }
  if (!cPool.length) {
    return { kind: "single", symbol: pickOne(sPool, `s:${seed ?? ""}`) };
  }

  const sPick = pickOne(sPool, `s:${seed ?? ""}`);
  const cPick = pickOne(cPool, `c:${seed ?? ""}`);
  return {
    kind: "mix",
    allocations: [
      { symbol: sPick, weight: weights.stock },
      { symbol: cPick, weight: weights.crypto },
    ],
  };
}
