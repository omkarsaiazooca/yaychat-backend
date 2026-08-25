import { IModel } from "./base";

/**
 * YaysApp — Rewards ledger, wallet, and referrals.
 *
 * IndexxPoints are the one balance YaysApp itself owns and is the source of truth
 * for. Crypto balances (BTCY, INEX, …) stay owned by the Indexx wallet service
 * and are only *read* into the wallet view — this module never mints or moves
 * them. Keeping that boundary explicit is what makes the ledger auditable: a
 * IndexxPoints balance is always the sum of this collection's entries, and nothing
 * else can change it.
 */

/** Every way points can enter or leave an account. */
export type PointsReason =
  | "daily_checkin"
  | "referral_signup"
  | "referral_milestone"
  | "chat_activity"
  | "community_activity"
  | "campaign"
  | "manual_adjustment"
  | "conversion_debit"
  | "reversal";

export type LedgerStatus = "pending" | "completed" | "reversed";

/**
 * One immutable ledger entry. Balances are derived by summing these, and the
 * denormalised `balanceAfter` lets the history screen show a running total
 * without a second pass.
 */
export interface PointsLedgerEntry extends IModel {
  userLower: string;
  /** Positive credits, negative debits — signed so the sum *is* the balance. */
  amount: number;
  reason: PointsReason;
  /** Human-readable label for the rewards history row. */
  activity: string;
  status: LedgerStatus;
  /**
   * Caller-supplied key that makes crediting safe to retry. Two writes with
   * the same key credit once. Unique per user.
   */
  idempotencyKey: string;
  /** Balance immediately after this entry was applied. */
  balanceAfter: number;
  note?: string;
  /** Free-form context: referred user's email, campaign id, message id, … */
  meta?: Record<string, any>;
  /** Set when a later entry reverses this one. */
  reversedByEntryId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Per-user rollup. Denormalised from the ledger so the Earn tab is one read,
 * and guarded by the same conditional update that appends the entry.
 */
export interface PointsAccount extends IModel {
  userLower: string;
  balance: number;
  lifetimeEarned: number;
  /** Consecutive days with a check-in. Resets when a day is skipped. */
  streakDays: number;
  /** UTC date (YYYY-MM-DD) of the last check-in; the streak/limit key. */
  lastCheckInDate?: string | null;
  /** Points earned during `earnedTodayDate`; enforces the daily cap. */
  earnedToday: number;
  earnedTodayDate?: string | null;
  /** Stable, shareable invite code. Generated once, never reissued. */
  referralCode: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ReferralStatus = "pending" | "qualified" | "rewarded" | "rejected";

/**
 * One referrer → referee edge. Created when a new account signs up with a
 * code, and settled once the referee clears the qualification bar (verified
 * contact + first real activity), which is what stops self-referral farming.
 */
export interface Referral extends IModel {
  /** Account that owns the code. */
  referrerLower: string;
  /** Account that signed up with it. One referral row per referee, ever. */
  refereeLower: string;
  code: string;
  status: ReferralStatus;
  /** Points paid to the referrer when the referral qualified. */
  rewardAmount: number;
  qualifiedAt?: Date | null;
  rewardedAt?: Date | null;
  rejectedReason?: string | null;
  /** Where the install came from, when a deep link carried attribution. */
  source?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** A crypto or fiat holding shown in the wallet, read from Indexx. */
export interface WalletAssetView {
  symbol: string;
  name: string;
  balance: number;
  fiatValue: number;
  /**
   * True when the row is informational only — the balance is real but YaysApp
   * cannot yet move it, so the UI must not offer send/convert.
   */
  preview: boolean;
}

export interface WalletTransactionView {
  id: string;
  type: "send" | "receive" | "reward" | "conversion";
  asset: string;
  amount: number;
  counterparty: string;
  createdAt: string;
  status: "pending" | "completed" | "failed";
  memo?: string;
}
