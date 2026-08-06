import { ServiceBase } from "./base";
import bitcoinyaySubscriptionSchema, {
  BitcoinyaySubscriptionModel,
} from "../models/bitcoinyaySubscription";
import { BitcoinyaySubscription } from "../data/bitcoinyaySubscription";

export class BitcoinyaySubscriptionService extends ServiceBase<
  BitcoinyaySubscription,
  BitcoinyaySubscriptionModel
> {
  constructor() {
    super(bitcoinyaySubscriptionSchema, "BitcoinyaySubscriptions");
  }

  async listWithFilters(
    filters: any,
    limit: number,
    skip: number,
    sort: any
  ): Promise<BitcoinyaySubscription[]> {
    return this.findPaginatedSkip(limit, skip, sort, filters, undefined);
  }

  async countWithFilters(filters: any): Promise<number> {
    return this.findCount(filters);
  }
}
