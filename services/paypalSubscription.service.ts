import { PayPalSubscription } from "../data/paypalSubscription";
import paypalSubscriptionSchema, { PaypalSubscriptionModel } from "../models/paypalSubscription";
import { ServiceBase } from "./base";

export class PaypalSubscriptionService extends ServiceBase<
  PayPalSubscription,
  PaypalSubscriptionModel
> {
  constructor() {
    super(paypalSubscriptionSchema, "PaypalSubscription");
  }
}
