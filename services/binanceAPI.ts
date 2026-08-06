import axios from "axios";
import { PriceTicker } from "../data/priceTicker";

export class BinanceAPI {
  constructor() { }
  async get24HrPriceTicker(env: string, symbol: string) {
    try {
      let helperData = await this.helpers(env);
      let querySymbol = `${symbol}USDT`;
      const { data, status } = await axios.get<PriceTicker>(`${helperData.url}/api/v3/ticker/24hr?symbol=${querySymbol}`, {
        headers: {
          Accept: "application/json",
        },
      });
      console.log(JSON.stringify(data, null, 4));
      // 👇️ "response status is: 200"
      console.log("response status is: ", status);
      return data;

    } catch (e) { }
  }

  async helpers(env: string) {
    if (env.localeCompare("TESTNET") == 0) {
      return {
        url: "https://api.binance.com",
      };
    } else {
      return {
        url: "https://testnet.binance.vision",
      };
    }
  }

}
