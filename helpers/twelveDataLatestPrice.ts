import { createClient } from "redis";
import axios from "axios";
import moment from "moment";

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});

export async function getLatestStockPrice(symbol: string) {
  // Establish a connection
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  const endpoint = "https://api.twelvedata.com/price";
  // Create a unique Redis key based on the interval and symbol
  const redisKey = `price:${symbol}`;
  let cachedResult = await redisClient.get(redisKey);
  if (cachedResult !== null) {
    return Number(JSON.parse(cachedResult));
  }
  try {
    if (symbol === "APPL") {
      symbol = "AAPL";
    }

    console.log("symbol", symbol);
    const response = await axios.get(endpoint, {
      params: {
        apikey: process.env.TWELVE_DATA_API_KEY,
        symbol: symbol,
      },
    });
    if (response.data && response.data.price) {
      const latestPrice = Number(response.data.price); // Assumes the first item is the latest data point
      console.log(`The latest price for ${symbol} is $${latestPrice}`);
      redisClient.set(redisKey, JSON.stringify(latestPrice));
      redisClient.expire(redisKey, 10800); // fetching latest price for 3 hours
      return latestPrice;
    } else {
      console.log(`Failed to fetch data for ${symbol}`);
      return 0;
    }
  } catch (error: any) {
    console.error(`Error fetching stock price: ${error.message}`);
    return 0;
  }
}

// Define the interface for stock data
export interface StockData {
  price: number;
  priceChangePercentage: number;
  lowPrice: number;
  highPrice: number;
}

export async function getLatestStockData(symbol: string): Promise<StockData> {
  // Establish a connection to Redis
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  const endpoint = "https://api.twelvedata.com/quote";
  const redisKey = `stockData:${symbol}`;

  // Check if data is cached
  let cachedResult = await redisClient.get(redisKey);
  if (cachedResult !== null) {
    return JSON.parse(cachedResult);
  }

  try {
    // Handle special cases for symbol names
    if (symbol === "APPL") {
      symbol = "AAPL";
    }

    console.log("Fetching data for symbol:", symbol);
    const response = await axios.get(endpoint, {
      params: {
        apikey: process.env.TWELVE_DATA_API_KEY,
        symbol: symbol,
      },
    });

    console.log("response", response.data)
    if (response.data && response.status === 200) {
      const stockData = {
        price: Number(response.data.open),
        priceChangePercentage: Number(response.data.percent_change),
        lowPrice: Number(response.data.low),
        highPrice: Number(response.data.high),
      };

      console.log(`Fetched data for ${symbol}:`, stockData);

      // Cache the result
      await redisClient.set(redisKey, JSON.stringify(stockData));
      await redisClient.expire(redisKey, 86400); // Cache for 3 hours

      return stockData;
    } else {
      console.log(`Failed to fetch data for ${symbol}`);
      let res = {
        price: 0,
        priceChangePercentage: 0,
        lowPrice: 0,
        highPrice: 0,
      };
      return res;
    }
  } catch (error: any) {
    console.error(`Error fetching stock data: ${error.message}`);
    let res = {
      price: 0,
      priceChangePercentage: 0,
      lowPrice: 0,
      highPrice: 0,
    };
    return res;
  }
}

export async function adjustForWeekends(date: any) {
  if (moment(date).day() === 6) {
    // Saturday
    return moment(date).subtract(1, "days").format("YYYY-MM-DD HH:mm:ss");
  } else if (moment(date).day() === 0) {
    // Sunday
    return moment(date).subtract(2, "days").format("YYYY-MM-DD HH:mm:ss");
  } else {
    return date;
  }
}

export async function getPreviousDayPrice(symbol: string): Promise<{ status: number; data: number }> {
    // Establish a connection to Redis
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

  const endpoint = "https://api.twelvedata.com/time_series";
  const redisKey = `previousDayPrice:${symbol}`;

  // Check if data is cached
  let cachedResult = await redisClient.get(redisKey);
  if (cachedResult !== null) {
    return { status: 200, data: Number(cachedResult) };
  }

  try {
    const today = moment();
    const previousDay = await adjustForNonWorkingDays(today.clone().subtract(1, 'days'));
    const previousDayString = previousDay.format('YYYY-MM-DD');

    const response = await axios.get(endpoint, {
      params: {
        apikey: process.env.TWELVE_DATA_API_KEY,
        symbol: symbol,
        interval: '1day',
      },
    });

    console.log("response:response", response)
    if (response.data && response.data.values && response.data.values.length > 0) {
      const previousDayPrice = Number(response.data.values[0].close);
      await redisClient.set(redisKey, JSON.stringify(previousDayPrice));
      await redisClient.expire(redisKey, 86400); // Cache for 1 day
      return { status: 200, data: previousDayPrice };
    } else {
      console.log(`No data found for ${symbol} on ${previousDayString}`);
      return { status: 404, data: 0 };
    }
  } catch (error: any) {
    console.error(`Error fetching previous day price for ${symbol}: ${error.message}`);
    return { status: 500, data: 0 };
  }
}

export async function getUSHolidaysForYear(year: number): Promise<any> {
  // Establish a connection
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  const redisKey = `USHolidays:${year}`;
  let holidays = await redisClient.get(redisKey);

  if (holidays) {
    return JSON.parse(holidays);
  } else {
    try {
      const response = await axios.get(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/US`
      );
      holidays = response.data.map((holiday: any) => holiday.date);
      await redisClient.set(redisKey, JSON.stringify(holidays));
      return holidays;
    } catch (error) {
      console.error("Error fetching US holidays:", error);
      return [];
    }
  }
}

export function isWeekend(date: any): boolean {
  const day = moment(date).day();
  return day === 6 || day === 0; // Saturday or Sunday
}

export async function isHoliday(date: any): Promise<boolean> {
  const year = moment(date).year();
  const holidays = await getUSHolidaysForYear(year);
  const formattedDate = moment(date).format("YYYY-MM-DD");
  return holidays.includes(formattedDate);
}

export async function adjustForNonWorkingDays(
  date: any
): Promise<moment.Moment> {
  while (isWeekend(date) || (await isHoliday(date))) {
    date = moment(date).subtract(1, "days");
  }
  return date;
}

export async function fetchStockData(symbol: string) {
  // Establish a connection
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  if (symbol === "APPL") {
    symbol = "AAPL";
  } else if (symbol === "TLSA") {
    symbol = "TSLA";
  }
  const quoteCacheKey = `stockData:quote:${symbol}`;
  const statisticsCacheKey = `stockData:statistics:${symbol}`;

  const cachedQuoteData = await redisClient.get(quoteCacheKey);
  const cachedStatisticsData = await redisClient.get(statisticsCacheKey);

  let quoteData, statisticsData;

  if (cachedQuoteData) {
    quoteData = JSON.parse(cachedQuoteData);
  } else {
    const response = await axios.get(`https://api.twelvedata.com/quote`, {
      params: {
        symbol: symbol,
        apikey: process.env.TWELVE_DATA_API_KEY,
      },
    });
    quoteData = {
      name: response.data.name,
      price: response.data.close,
      volume: response.data.volume,
      percentChange: response.data.percent_change,
      percentChange24H: response.data.rolling_1d_change,
      percentChange7D: response.data.rolling_7d_change,
      high: response.data.high,
      low: response.data.low,
      highPrice52Week: response.data.fifty_two_week.high,
    };
    console.log("response 0", response);

    await redisClient.set(quoteCacheKey, JSON.stringify(quoteData));
    await redisClient.expire(quoteCacheKey, 10800); // fetching latest price for 3 hours
  }

  if (cachedStatisticsData) {
    statisticsData = JSON.parse(cachedStatisticsData);
  } else {
    // const response = await axios.get(`https://api.twelvedata.com/statistics`, {
    //   params: {
    //     symbol: symbol,
    //     apikey: process.env.TWELVE_DATA_API_KEY,
    //   },
    // });
    console.log("response");
    statisticsData = {
      marketCap: 0,
    };
    await redisClient.set(statisticsCacheKey, JSON.stringify(statisticsData));
    await redisClient.expire(statisticsCacheKey, 10800); // fetching latest price for 3 hours
  }

  return {
    ...quoteData,
    ...statisticsData,
  };
}


export async function fetchStockDataWithHistory(symbol: string) {
    // Establish a connection
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  if (symbol === "APPL") {
    symbol = "AAPL";
  } else if (symbol === "TLSA") {
    symbol = "TSLA";
  }

  const quoteCacheKey = `stockData:quote:${symbol}`;
  const historicalCacheKey = `stockData:historical:${symbol}`;

  const cachedQuoteData = await redisClient.get(quoteCacheKey);
  const cachedHistoricalData = await redisClient.get(historicalCacheKey);

  let quoteData, historicalData;

  if (cachedQuoteData) {
    quoteData = JSON.parse(cachedQuoteData);
  } else {
    const response = await axios.get(`https://api.twelvedata.com/quote`, {
      params: {
        symbol: symbol,
        apikey: process.env.TWELVE_DATA_API_KEY,
      },
    });
    quoteData = {
      name: response.data.name,
      price: response.data.close,
      volume: response.data.volume,
      percentChange: response.data.percent_change,
      high: response.data.high,
      low: response.data.low,
      highPrice52Week: response.data.fifty_two_week.high,
    };

    await redisClient.set(quoteCacheKey, JSON.stringify(quoteData));
    await redisClient.expire(quoteCacheKey, 10800); // Cache for 3 hours
  }

  if (cachedHistoricalData) {
    historicalData = JSON.parse(cachedHistoricalData);
  } else {
    const response = await axios.get(`https://api.twelvedata.com/time_series`, {
      params: {
        symbol: symbol,
        interval: '1day',
        outputsize: 100,
        apikey: process.env.TWELVE_DATA_API_KEY,
      },
    });
    historicalData = response.data.values;

    await redisClient.set(historicalCacheKey, JSON.stringify(historicalData));
    await redisClient.expire(historicalCacheKey, 10800); // Cache for 3 hours
  }

  // Get prices from 7 days, 1 month, and 3 months ago
  const sevenDaysAgoPrice = parseFloat(historicalData[7]?.close);
  const oneMonthAgoPrice = parseFloat(historicalData[30]?.close);
  const threeMonthsAgoPrice = parseFloat(historicalData[90]?.close);

  return {
    ...quoteData,
    sevenDaysAgoPrice,
    oneMonthAgoPrice,
    threeMonthsAgoPrice,
  };
}
