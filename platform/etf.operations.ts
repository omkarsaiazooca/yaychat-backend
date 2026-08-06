import { Request, Response } from "express";
import { ETFPriceService } from "../services/etfPrice.service";
import { BaseAPIOperations } from "./base.operations";
import { getPriceByName } from "../controllers/priceAPI";
import { createClient } from "redis";

const etfSetvice: ETFPriceService = new ETFPriceService();

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});
export class ETFOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async getPriceOfETF(etfCode: string) {
    try {
      const etfprice = await etfSetvice.getETFPriceByType(etfCode);
    } catch (err) {
      console.log(err);
      return { status: 500, data: {} };
    }
  }

  async getLatestPriceOfETF(etfCode: string) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      // Create a unique Redis key based on the interval and symbol
      const redisKey = `price:${etfCode}`;
      let cachedResult = await redisClient.get(redisKey);
      if (cachedResult !== null) {
        return {
          status: 200,
          data: { etfCode, totalETFPrice: Number(JSON.parse(cachedResult)) },
        };
      }

      let stocks: string | any[] = [];
      if (etfCode === "EQSTK") {
        stocks = [
          { symbol: "AMZN", percentage: 15 },
          { symbol: "BCM", percentage: 15 },
          { symbol: "MSFT", percentage: 15 },
          { symbol: "TLSA", percentage: 15 },
          { symbol: "PEP", percentage: 10 },
          { symbol: "GOOGL", percentage: 10 },
          { symbol: "NVDA", percentage: 10 },
          { symbol: "AAPL", percentage: 10 },
        ];
      } else if (etfCode === "CRYC10") {
        stocks = [
          { symbol: "BTC", percentage: 25 },
          { symbol: "ETH", percentage: 20 },
          { symbol: "BNB", percentage: 15 },
          { symbol: "LTC", percentage: 10 },
          { symbol: "XRP", percentage: 7 },
          { symbol: "DOGE", percentage: 6 },
          { symbol: "SOL", percentage: 5 },
          { symbol: "ADA", percentage: 4 },
          { symbol: "DOT", percentage: 4 },
          { symbol: "MATIC", percentage: 4 },
        ];
      } else if (etfCode === "ALCRYP") {
        stocks = [
          { symbol: "BTC", percentage: 20 },
          { symbol: "ETH", percentage: 20 },
          { symbol: "BNB", percentage: 10 },
          { symbol: "LTC", percentage: 10 },
          { symbol: "XRP", percentage: 5 },
          { symbol: "ADA", percentage: 5 },
          { symbol: "DOT", percentage: 5 },
          { symbol: "MATIC", percentage: 5 },
          { symbol: "SOL", percentage: 5 },
          { symbol: "LINK", percentage: 5 },
          { symbol: "SHIB", percentage: 5 }, //UPDATE LEO TO SHIB
          { symbol: "DOGE", percentage: 5 },
        ];
      } else if (etfCode === "INDXXF") {
        stocks = [
          { symbol: "INEX", percentage: 14 },
          { symbol: "IN500", percentage: 14 },
          { symbol: "INXC", percentage: 14 },
          { symbol: "IUSD+", percentage: 14 },
          { symbol: "AAPL", percentage: 10 },
          { symbol: "META", percentage: 10 },
          { symbol: "TLSA", percentage: 10 },
          { symbol: "SNP500", percentage: 10 },
          { symbol: "BTC", percentage: 5 },
          { symbol: "ETH", percentage: 5 },
          { symbol: "BNB", percentage: 5 },
          { symbol: "LTC", percentage: 5 },
          { symbol: "XRP", percentage: 3 },
          { symbol: "ADA", percentage: 3 },
          { symbol: "DOT", percentage: 2 },
          { symbol: "SOL", percentage: 2 },
          { symbol: "USDT", percentage: 1 },
        ];
      } else if (etfCode === "TOB") {
        stocks = [
          { symbol: "BTC", percentage: 10 },
          { symbol: "ETH", percentage: 10 },
          { symbol: "INEX", percentage: 15 },
          { symbol: "IN500", percentage: 15 },
          { symbol: "META", percentage: 10 },
          { symbol: "AMZN", percentage: 10 },
          { symbol: "IBCM", percentage: 10 },
          { symbol: "LTC", percentage: 10 }, //UPDATE TONCOIN TO LTC
          { symbol: "DAI", percentage: 5 },
          { symbol: "SHIB", percentage: 5 },
        ];
      } else {
        return { status: 500, data: {} };
      }

      let totalETFPrice = 0;

      // Calculate price for each stock and add to total ETF price
      for (const element of stocks) {
        let res: any = await getPriceByName(element.symbol);

        // Assuming getPriceByName returns an object with a 'price' property
        if (res && res.price) {
          totalETFPrice += (res.price * element.percentage) / 100;
        } else {
          // Handle the case where getPriceByName does not return a valid price
          throw new Error(`Price not found for symbol: ${element.symbol}`);
        }
      }

      redisClient.set(redisKey, JSON.stringify(totalETFPrice));
      redisClient.expire(redisKey, 10800); // fetching latest price for 3 hours
      return { status: 200, data: { etfCode, totalETFPrice } };
    } catch (err: any) {
      console.error(err);
      return {
        status: 500,
        data: { error: err.message || "An error occurred" },
      };
    }
  }
}

export async function getETFPriceByCode(etfCode: string) {
  try {
    const etfprice = await etfSetvice.getETFPriceByType(etfCode);
  } catch (err) {
    console.log(err);
    return { status: 500, data: {} };
  }
}

export async function getLatestPriceOfETF3(etfCode: string) {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    // Create a unique Redis key based on the interval and symbol
    const redisKey = `price:${etfCode}`;
    let cachedResult = await redisClient.get(redisKey);
    if (cachedResult !== null) {
      return {
        status: 200,
        data: { etfCode, totalETFPrice: Number(JSON.parse(cachedResult)) },
      };
    }
    let stocks: string | any[] = [];
    if (etfCode === "EQSTK") {
      stocks = [
        { symbol: "AMZN", percentage: 15 },
        { symbol: "BCM", percentage: 15 },
        { symbol: "MSFT", percentage: 15 },
        { symbol: "TLSA", percentage: 15 },
        { symbol: "PEP", percentage: 10 },
        { symbol: "GOOGL", percentage: 10 },
        { symbol: "NVDA", percentage: 10 },
        { symbol: "AAPL", percentage: 10 },
      ];
    } else if (etfCode === "CRYC10") {
      stocks = [
        { symbol: "BTC", percentage: 25 },
        { symbol: "ETH", percentage: 20 },
        { symbol: "BNB", percentage: 15 },
        { symbol: "LTC", percentage: 10 },
        { symbol: "XRP", percentage: 7 },
        { symbol: "DOGE", percentage: 6 },
        { symbol: "SOL", percentage: 5 },
        { symbol: "ADA", percentage: 4 },
        { symbol: "DOT", percentage: 4 },
        { symbol: "MATIC", percentage: 4 },
      ];
    } else if (etfCode === "ALCRYP") {
      stocks = [
        { symbol: "BTC", percentage: 20 },
        { symbol: "ETH", percentage: 20 },
        { symbol: "BNB", percentage: 10 },
        { symbol: "LTC", percentage: 10 },
        { symbol: "XRP", percentage: 5 },
        { symbol: "ADA", percentage: 5 },
        { symbol: "DOT", percentage: 5 },
        { symbol: "MATIC", percentage: 5 },
        { symbol: "SOL", percentage: 5 },
        { symbol: "LINK", percentage: 5 },
        { symbol: "SHIB", percentage: 5 }, //UPDATE LEO TO SHIB
        { symbol: "DOGE", percentage: 5 },
      ];
    } else if (etfCode === "INDXXF") {
      stocks = [
        { symbol: "INEX", percentage: 14 },
        { symbol: "IN500", percentage: 14 },
        { symbol: "INXC", percentage: 14 },
        { symbol: "IUSD+", percentage: 14 },
        { symbol: "AAPL", percentage: 10 },
        { symbol: "META", percentage: 10 },
        { symbol: "TLSA", percentage: 10 },
        { symbol: "SNP500", percentage: 10 },
        { symbol: "BTC", percentage: 5 },
        { symbol: "ETH", percentage: 5 },
        { symbol: "BNB", percentage: 5 },
        { symbol: "LTC", percentage: 5 },
        { symbol: "XRP", percentage: 3 },
        { symbol: "ADA", percentage: 3 },
        { symbol: "DOT", percentage: 2 },
        { symbol: "SOL", percentage: 2 },
        { symbol: "USDT", percentage: 1 },
      ];
    } else if (etfCode === "TOB") {
      stocks = [
        { symbol: "BTC", percentage: 10 },
        { symbol: "ETH", percentage: 10 },
        { symbol: "INEX", percentage: 15 },
        { symbol: "IN500", percentage: 15 },
        { symbol: "META", percentage: 10 },
        { symbol: "AMZN", percentage: 10 },
        { symbol: "BCM", percentage: 10 },
        { symbol: "LTC", percentage: 10 }, //UPDATE TONCOIN TO LTC
        { symbol: "DAI", percentage: 5 },
        { symbol: "SHIB", percentage: 5 },
      ];
    } else {
      console.log("not err in else ");
      return {
        status: 500,
        data: { etfCode, totalETFPrice: 0 },
      };
    }

    let totalETFPrice = 0;

    // Calculate price for each stock and add to total ETF price
    for (const element of stocks) {
      let res: any = await getPriceByName(element.symbol);
      console.log(`res of ${element.symbol}`, res);
      // Assuming getPriceByName returns an object with a 'price' property
      if (res && res.data && res.status === 200) {
        totalETFPrice += (res.data * element.percentage) / 100;
      } else {
        // Handle the case where getPriceByName does not return a valid price
        //throw new Error(`Price not found for symbol: ${element.symbol}`);
        console.log("not err in for else", res);
        return {
          status: 500,
          data: { etfCode, totalETFPrice: 0 },
        };
      }
    }
    console.log(
      "returing the price of ",
      etfCode,
      "price value is ",
      totalETFPrice
    );
    redisClient.set(redisKey, JSON.stringify(totalETFPrice));
    redisClient.expire(redisKey, 10800); // fetching latest price for 3 hours
    return { status: 200, data: { etfCode, totalETFPrice } };
  } catch (err: any) {
    console.error(err);
    return {
      status: 500,
      data: { etfCode, totalETFPrice: 0 },
    };
  }
}

export async function getLatestPriceOfETF(etfCode: string) {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    const redisKey = `price:${etfCode}`;
    let cachedResult = await redisClient.get(redisKey);
    if (cachedResult !== null) {
      const parsedResult = JSON.parse(cachedResult);
      return {
        status: 200,
        data: {
          etfCode,
          totalETFPrice: Number(parsedResult.totalETFPrice),
          individualPrices: parsedResult.individualPrices,
        },
      };
    }

    let stocks: { symbol: string; percentage: number }[] = [];
    if (etfCode === "EQSTK") {
      stocks = [
        { symbol: "AMZN", percentage: 15 },
        { symbol: "BCM", percentage: 15 },
        { symbol: "MSFT", percentage: 15 },
        { symbol: "TLSA", percentage: 15 },
        { symbol: "PEP", percentage: 10 },
        { symbol: "GOOGL", percentage: 10 },
        { symbol: "NVDA", percentage: 10 },
        { symbol: "AAPL", percentage: 10 },
      ];
    } else if (etfCode === "CRYC10") {
      stocks = [
        { symbol: "BTC", percentage: 25 },
        { symbol: "ETH", percentage: 20 },
        { symbol: "BNB", percentage: 15 },
        { symbol: "LTC", percentage: 10 },
        { symbol: "XRP", percentage: 7 },
        { symbol: "DOGE", percentage: 6 },
        { symbol: "SOL", percentage: 5 },
        { symbol: "ADA", percentage: 4 },
        { symbol: "DOT", percentage: 4 },
        { symbol: "MATIC", percentage: 4 },
      ];
    } else if (etfCode === "ALCRYP") {
      stocks = [
        { symbol: "BTC", percentage: 20 },
        { symbol: "ETH", percentage: 20 },
        { symbol: "BNB", percentage: 10 },
        { symbol: "LTC", percentage: 10 },
        { symbol: "XRP", percentage: 5 },
        { symbol: "ADA", percentage: 5 },
        { symbol: "DOT", percentage: 5 },
        { symbol: "MATIC", percentage: 5 },
        { symbol: "SOL", percentage: 5 },
        { symbol: "LINK", percentage: 5 },
        { symbol: "SHIB", percentage: 5 }, //UPDATE LEO TO SHIB
        { symbol: "DOGE", percentage: 5 },
      ];
    } else if (etfCode === "INDXXF") {
      stocks = [
        { symbol: "INEX", percentage: 14 },
        { symbol: "IN500", percentage: 14 },
        { symbol: "INXC", percentage: 14 },
        { symbol: "IUSD+", percentage: 14 },
        { symbol: "AAPL", percentage: 10 },
        { symbol: "META", percentage: 10 },
        { symbol: "TLSA", percentage: 10 },
        { symbol: "SNP500", percentage: 10 },
        { symbol: "BTC", percentage: 5 },
        { symbol: "ETH", percentage: 5 },
        { symbol: "BNB", percentage: 5 },
        { symbol: "LTC", percentage: 5 },
        { symbol: "XRP", percentage: 3 },
        { symbol: "ADA", percentage: 3 },
        { symbol: "DOT", percentage: 2 },
        { symbol: "SOL", percentage: 2 },
        { symbol: "USDT", percentage: 1 },
      ];
    } else if (etfCode === "TOB") {
      stocks = [
        { symbol: "BTC", percentage: 10 },
        { symbol: "ETH", percentage: 10 },
        { symbol: "INEX", percentage: 15 },
        { symbol: "IN500", percentage: 15 },
        { symbol: "META", percentage: 10 },
        { symbol: "AMZN", percentage: 10 },
        { symbol: "BCM", percentage: 10 },
        { symbol: "LTC", percentage: 10 }, //UPDATE TONCOIN TO LTC
        { symbol: "DAI", percentage: 5 },
        { symbol: "SHIB", percentage: 5 },
      ];
    } else {
      console.log("not err in else ");
      let individualPrices: {
        symbol: string;
        price: number;
        weightedPrice: number;
      }[] = [];
      return {
        status: 500,
        data: { etfCode, totalETFPrice: 0,  individualPrices: individualPrices},
      };
    }

    let totalETFPrice = 0;
    let individualPrices: {
      symbol: string;
      price: number;
      weightedPrice: number;
    }[] = [];

    for (const element of stocks) {
      let res: any = await getPriceByName(element.symbol);
      if (res && res.data && res.status === 200) {
        const weightedPrice = (res.data * element.percentage) / 100;
        totalETFPrice += weightedPrice;
        individualPrices.push({
          symbol: element.symbol,
          price: res.data,
          weightedPrice: weightedPrice,
        });
      } else {
        console.log("Price not found for symbol: ", element.symbol);
        let individualPrices: {
          symbol: string;
          price: number;
          weightedPrice: number;
        }[] = [];
        return {
          status: 500,
          data: { etfCode, totalETFPrice: 0,  individualPrices: individualPrices},
        };
      }
    }

    console.log(
      "Returning the price of ",
      etfCode,
      "price value is ",
      totalETFPrice
    );
    const dataToCache = { etfCode, totalETFPrice, individualPrices };
    redisClient.set(redisKey, JSON.stringify(dataToCache));
    redisClient.expire(redisKey, 10800); // caching for 3 hours

    return { status: 200, data: { etfCode, totalETFPrice, individualPrices } };
  } catch (err: any) {
    console.error(err);
    let individualPrices: {
      symbol: string;
      price: number;
      weightedPrice: number;
    }[] = [];
    return {
      status: 500,
      data: { etfCode, totalETFPrice: 0,  individualPrices: individualPrices},
    };
  }
}
