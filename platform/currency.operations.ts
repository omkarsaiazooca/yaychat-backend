import { Request, Response } from "express";
import { Currency } from "../data/currency";
import { CurrencyService } from "../services/currency.service";
import { BaseAPIOperations } from "./base.operations";

const currencyService: CurrencyService = new CurrencyService();
export class CurrencyOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async getCurrencyPriceByType(req: any, res: any, orderType: string = "") {
    try {
      const currencyType = "Crypto";
      let currencyOut = req.body.currencyOut;
      if (orderType.localeCompare("Buy") == 0) {
        console.log(currencyOut);
        currencyOut = req.body.currencyOut;
      } else if (orderType.localeCompare("MonthlyINEXBuy") == 0) {
        console.log(currencyOut);
        currencyOut = req.body.currencyOut;
      } else {
        currencyOut = req.body.currencyIn;
      }
      const currencyRes = await currencyService.findOne({
        currencyType: currencyType,
        code: currencyOut,
      });
      if (currencyRes) {
        return { status: 200, data: currencyRes };
      } else {
        return { status: 500, data: {} as Currency };
      }
    } catch (err) {
      console.log(err);
      return { status: 500, data: {} as Currency };
    }
  }
}

export async function getCurrencyPriceByType(currencyOut: string) {
  try {
    const currencyType = "Crypto";
    const currencyRes = await currencyService.findOne({
      currencyType: currencyType,
      code: currencyOut,
    });
    if (currencyRes) {
      return { status: 200, data: currencyRes };
    } else {
      return { status: 500, data: {} as Currency };
    }
  } catch (err) {
    console.log(err);
    return { status: 500, data: {} as Currency };
  }
}
