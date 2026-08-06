import { NonPaypalSubscription } from "../data/nonPaypalSubscription";
import nonPaypalSubscriptionSchema, {
  NonPaypalSubscriptionModel,
} from "../models/nonPaypalSubscription";
import { ServiceBase } from "./base";

export class NonPaypalSubscriptionService extends ServiceBase<
  NonPaypalSubscription,
  NonPaypalSubscriptionModel
> {
  constructor() {
    super(nonPaypalSubscriptionSchema, "NonPaypalSubscription");
  }
}
