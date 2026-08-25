import { ServiceBase } from "./base";
import aiUsageDailySchema, { AiUsageDailyModel } from "../models/aiAssistantUsage";
import { AiUsageDaily } from "../data/aiAssistant";

/** UTC calendar day key — quotas reset on this boundary. */
export const usageDay = (at: Date = new Date()): string =>
  at.toISOString().slice(0, 10);

export class AiAssistantUsageService extends ServiceBase<
  AiUsageDaily,
  AiUsageDailyModel
> {
  constructor() {
    super(aiUsageDailySchema, "AiAssistantUsage");
  }

  /** Today's counters for a user, creating the row on first use. */
  async today(userLower: string, plan: string): Promise<AiUsageDaily> {
    const day = usageDay();
    return this.upsertOneAndGet(
      { userLower, day },
      { $setOnInsert: { userLower, day, plan } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  /** Atomically add one request's tokens and cost to today's row. */
  async record(
    userLower: string,
    plan: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number
  ): Promise<AiUsageDaily> {
    const day = usageDay();
    return this.upsertOneAndGet(
      { userLower, day },
      {
        $inc: { requests: 1, tokensIn, tokensOut, costUsd },
        $setOnInsert: { userLower, day, plan },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
}
