export type NewsItem = {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  image?: string;
  source?: string;
  category: "Stock" | "Crypto";
  symbols?: string[];              // symbols/tickers mentioned
  publishedAt: string;             // ISO
  ago: string;                     // e.g. "3h ago"
};
