import { PaypalPayment } from "../data/paypalPayments";
import paypalSchemaSchema, {
  PaypalPaymentModel,
} from "../models/paypalPayment";
import { ServiceBase } from "./base";

export class PaypalService extends ServiceBase<
  PaypalPayment,
  PaypalPaymentModel
> {
  constructor() {
    super(paypalSchemaSchema, "PaypalPayments");
  }
}
