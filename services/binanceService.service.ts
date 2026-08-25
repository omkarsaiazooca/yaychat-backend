import Binance from "node-binance-api";

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_KEY!,
  APISECRET: process.env.BINANCE_SECRET!,
  useServerTime: true,
});

export const buyCrypto = async (symbol: string, amountUSD: number) => {
  try {
    // Step 1: Get current price
    const prices = await binance.prices(symbol);
    const price = parseFloat(prices[symbol]);

    if (!price) throw new Error(`Price not found for ${symbol}`);

    // Step 2: Calculate quantity
    const quantity = (amountUSD / price).toFixed(6);

    // Step 3: Place a market order
    const order = await binance.marketBuy(symbol, parseFloat(quantity));

    return { success: true, order };
  } catch (error) {
    console.error(`[BINANCE] Order failed:`, error);
    return { success: false, error };
  }
};

export const sellCrypto = async (symbol: string, quantity: number) => {
  try {
    const order = await binance.marketSell(symbol, quantity);
    return { success: true, order };
  } catch (error) {
    console.error(`[BINANCE] Sell failed:`, error);
    return { success: false, error };
  }
};

export const getBalance = async () => {
  try {
    const account = await binance.balance();
    return account;
  } catch (error) {
    console.error(`[BINANCE] Balance fetch failed:`, error);
    return null;
  }
};
