import axios from "axios";

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY!;

export async function getStockPrice(symbol: string): Promise<number> {
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const resp = await axios.get(url);

    if (resp.data && resp.data["Global Quote"] && resp.data["Global Quote"]["05. price"]) {
      return parseFloat(resp.data["Global Quote"]["05. price"]);
    }

    throw new Error(`No stock price found for ${symbol}`);
  } catch (err) {
    console.error(`AlphaVantage fetch failed for ${symbol}:`, err);
    // fallback mock
    return 100 + Math.random() * 500;
  }
}
