import { SuppressedEmail } from "../data/suppressedEmail";
import SuppressedEmailSchema, {
  SuppressedEmailModel,
} from "../models/suppressedEmail";
import { ServiceBase } from "./base";

export class SuppressedEmailService extends ServiceBase<
  SuppressedEmail,
  SuppressedEmailModel
> {
  constructor() {
    super(SuppressedEmailSchema, "SuppressedEmails");
  }

  findByEmail(email: string) {
    return this.findOne({ email: email.toLowerCase() });
  }

  upsertByEmail(email: string, update: Partial<SuppressedEmail>) {
    return this.upsertOneAndGet(
      { email: email.toLowerCase() },
      update,
      { setDefaultsOnInsert: true, new: true }
    );
  }
}
