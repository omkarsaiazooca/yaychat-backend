import { Request, Response } from "express";
import { BaseAPIOperations } from "./base.operations";
import { OrderService } from "../services/order.service";
import { TransactionService } from "../services/transaction.service";
const orderService: OrderService = new OrderService();
const txservice: TransactionService = new TransactionService();

export class PriceOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  async volumes(coin: string) {
    try {
      let results = await orderService.findSelect(
        {
          "breakdown.inCurrenyName": coin,
          status: "Completed",
        },
        {
          breakdown: 1,
        }
      );
      let totalVolume = 0;
      results.forEach((x) => {
        totalVolume += x.breakdown.inAmount;
      });
      return totalVolume;
    } catch (err) {
      console.log(err);
      return 0;
    }
  }

  async FTTDeposits() {
    try {
      let results = await txservice.findSelect(
        {
          "currencyRef": "FTT",
          status: "Completed",
          "transactionType" : "DEPOSIT_CRYPTO",
        },
        {

        }
      );
      let totalVolume = 0;
      results.forEach((x) => {
        totalVolume += x.amount;
      });
      return totalVolume;
    } catch (err) {
      console.log(err);
      return 0;
    }
  }
}
