import { ServiceBase } from "./base";
import subscriptionEmailsSchema, {
  SubscriptionEmailsModel,
} from "../models/subscriptionEmails";
import { SubscriptionEmails } from "../data/subscriptionEmails";

export class SubscriptionEmailsService extends ServiceBase<
  SubscriptionEmails,
  SubscriptionEmailsModel
> {
  constructor() {
    super(subscriptionEmailsSchema, "SubscriptionEmails");
  }
}
