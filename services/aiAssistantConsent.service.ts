import { ServiceBase } from "./base";
import aiConsentSchema, { AiConsentModel } from "../models/aiAssistantConsent";
import { AiConsent } from "../data/aiAssistant";

export class AiAssistantConsentService extends ServiceBase<
  AiConsent,
  AiConsentModel
> {
  constructor() {
    super(aiConsentSchema, "AiAssistantConsent");
  }

  /** Current consent for a user, creating the deny-by-default row if absent. */
  async forUser(userLower: string): Promise<AiConsent> {
    return this.upsertOneAndGet(
      { userLower },
      { $setOnInsert: { userLower } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async update(
    userLower: string,
    patch: Partial<
      Pick<
        AiConsent,
        | "shareChatContent"
        | "shareCommunityContent"
        | "saveHistory"
        | "personalization"
      >
    >
  ): Promise<AiConsent> {
    const grantsSharing =
      patch.shareChatContent === true || patch.shareCommunityContent === true;
    return this.upsertOneAndGet(
      { userLower },
      {
        $set: {
          ...patch,
          ...(grantsSharing ? { acceptedAt: new Date() } : {}),
        },
        $setOnInsert: { userLower },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
}
