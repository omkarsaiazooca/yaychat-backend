import axios, { AxiosResponse } from "axios";
import { createClient } from "redis";

interface StockResponse {
    values: { datetime: string; close: string }[];
    meta?: any;
    status?: string;
}
const redisClient = createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: "redis-11678.c289.us-west-1-2.ec2.cloud.redislabs.com",
        port: 11678,
    },
});
export class StockService {
    private readonly endpoint = "https://api.twelvedata.com/time_series";
    private readonly apiKey = process.env.TWELVE_DATA_API_KEY || "";

    async fetchStockPrice(symbol: string, interval = "1min"): Promise<number> {
        let normalizedSymbol = symbol.toUpperCase();

        // Map custom cases
        if (normalizedSymbol === "SNP500") normalizedSymbol = "INX";
        if (normalizedSymbol === "APPL") normalizedSymbol = "AAPL"; // typo fix

        const redisKey = `stockPriceData:${normalizedSymbol}:${interval}`;

        try {
            // 🔹 Connect if not already connected
            if (!redisClient.isOpen) await redisClient.connect();

            // 🔹 Try cache first
            const cachedData = await redisClient.get(redisKey);
            if (cachedData) {
                console.log(`Cache hit for ${normalizedSymbol}`);
                return Number(cachedData);
            }

            // 🔹 Fetch from TwelveData
            const response: AxiosResponse<StockResponse> = await axios.get(this.endpoint, {
                params: {
                    symbol: normalizedSymbol,
                    interval,
                    apikey: this.apiKey,
                    outputsize: 1, // only need latest
                },
            });

            if (response.data?.values?.length > 0) {
                const latestPrice = Number(response.data.values[0].close);
                console.log(`Fetched latest price for ${normalizedSymbol}: $${latestPrice}`);

                // 🔹 Save in Redis (24h expiration)
                await redisClient.setEx(redisKey, 86400, latestPrice.toString());

                return latestPrice;
            } else {
                console.warn(`No data returned for ${normalizedSymbol}`, response.data);
                return 0;
            }
        } catch (error: any) {
            console.error(`Error fetching price for ${symbol}:`, error.message);
            return 0;
        } finally {
            // ❌ Don’t quit Redis after every call, keep it connected for re-use
        }
    }
}
