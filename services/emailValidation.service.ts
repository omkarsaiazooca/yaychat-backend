import { EmailValidation } from "../data/emailValidation";
import EmailValidationSchema, {
  EmailValidationModel,
} from "../models/emailValidation";
import { ServiceBase } from "./base";

export class EmailValidationService extends ServiceBase<
  EmailValidation,
  EmailValidationModel
> {
  constructor() {
    super(EmailValidationSchema, "EmailValidation");
  }

  async upsertValidation(input: {
    email: string;
    provider: string;
    status?: string;
    subStatus?: string;
    didYouMean?: string | null;
    account?: string;
    domain?: string;
    checkedAt: Date;
    accountIndex?: number;
    raw?: any;
  }) {
    const email = String(input.email || "").toLowerCase().trim();
    const provider = String(input.provider || "ZeroBounce").trim();

    if (!email) return null;

    return this.upsertOneAndGet(
      { email, provider },
      {
        $setOnInsert: { email, provider, createdAt: new Date() },
        $set: {
          status: input.status,
          subStatus: input.subStatus,
          didYouMean: input.didYouMean || null,
          account: input.account,
          domain: input.domain,
          checkedAt: input.checkedAt,
          accountIndex: input.accountIndex,
          raw: input.raw || {},
        },
      },
      { setDefaultsOnInsert: true, new: true }
    );
  }
}
