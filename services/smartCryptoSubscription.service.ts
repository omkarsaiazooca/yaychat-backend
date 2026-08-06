import { ServiceBase } from "./base";
import smartCryptoSubscriptionSchema, {
  SmartCryptoSubscriptionModel,
} from "../models/smartCryptoSubscription";
import { SmartCryptoSubscription } from "../data/smartCryptoSubscription";

export class SmartCryptoSubscriptionService extends ServiceBase<
  SmartCryptoSubscription,
  SmartCryptoSubscriptionModel
> {
  constructor() {
    super(smartCryptoSubscriptionSchema, "SmartCryptoSubscriptions");
  }

  async listWithFilters(
    filters: any,
    limit: number,
    skip: number,
    sort: any
  ): Promise<SmartCryptoSubscription[]> {
    return this.findPaginatedSkip(limit, skip, sort, filters, undefined);
  }

  async countWithFilters(filters: any): Promise<number> {
    return this.findCount(filters);
  }
}
