import axios from "axios";
import { CurrencyService } from "../services/currency.service";

const currencyService: CurrencyService = new CurrencyService();

export async function getLatestFTTPrice() {
  let price = await currencyService.findOne({ code: "FTT" });
  console.log(price.buyPriceUpdatedOn.getTime(), "to");
  console.log(new Date().getTime(), "now");
  console.log(
    (new Date().getTime() - price.buyPriceUpdatedOn.getTime()) / 1000,
    "diff"
  );
  let diffTime =
    (new Date().getTime() - price.buyPriceUpdatedOn.getTime()) / 1000;
  if (diffTime > 86400) {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ftx-token&vs_currencies=usd"
    );
    await currencyService.updatePart(
      { code: "FTT" },
      {
        buyPrice: response.data["ftx-token"].usd,
        buyPriceUpdatedOn: new Date(),
      }
    );

    return response.data["ftx-token"].usd;
  } else {
    return price.buyPrice;
  }
}

export async function getLatestFTTPriceInBTC() {
  const response = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=ftx-token&vs_currencies=btc"
  );
  return response.data["ftx-token"].btc;
}

export async function getLatestFTTPriceInETH() {
  const response = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=ftx-token&vs_currencies=eth"
  );
  return response.data["ftx-token"].eth;
}
