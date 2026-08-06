import { StripePayment } from "../data/stripePayment";
import stripePaymentSchema, { StripePaymentModel } from "../models/stripePayment";
import { ServiceBase } from "./base";

export class StripePaymentService extends ServiceBase<StripePayment, StripePaymentModel> {
    constructor() {
        super(stripePaymentSchema, "StripePayments");
    }

}