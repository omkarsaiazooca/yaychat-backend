import { BTCYBuyHistory } from "../data/btcyBuyHistory";
import BTCYBuyHistorySchema, {
  BTCYBuyHistoryModel,
} from "../models/btcyBuyHistory";
import { ServiceBase } from "./base";

export class BTCYBuyHistoryService extends ServiceBase<
  BTCYBuyHistory,
  BTCYBuyHistoryModel
> {
  constructor() {
    super(BTCYBuyHistorySchema, "BTCYBuyHistory");
  }

  async recordBuy(input: {
    email: string;
    orderId: string;
    orderMongoId?: string;
    amount: number;
    priceAtBuy: number;
    boughtAt: Date;
  }) {
    const email = String(input.email || "").toLowerCase();
    const orderId = String(input.orderId || "").trim();

    if (!email || !orderId) return null;

    return this.upsertOneAndGet(
      { orderId },
      {
        $setOnInsert: {
          email,
          orderId,
          orderMongoId: input.orderMongoId,
          amount: Number(input.amount),
          priceAtBuy: Number(input.priceAtBuy),
          boughtAt: input.boughtAt,
          coinSymbol: "BTCY",
          createdDate: new Date(),
        },
      },
      { setDefaultsOnInsert: true, new: true }
    );
  }

  async hasAnyBuy(email: string): Promise<boolean> {
    const e = String(email || "").toLowerCase();
    if (!e) return false;
    const record = await this.findOne({ email: e });
    return !!record;
  }

  async getDistinctEmails(): Promise<string[]> {
    const rows = await this.findAggregate<{ _id: string }>([
      { $match: { email: { $exists: true, $ne: "" } } },
      { $group: { _id: "$email" } },
      { $sort: { _id: 1 } },
    ]);
    return (rows || [])
      .map((row) => String(row?._id || "").toLowerCase())
      .filter((email) => !!email);
  }
}
