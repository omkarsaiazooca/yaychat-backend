import { ServiceBase } from "./base";
import { UserService } from "./user.service";
import pointsAccountSchema, { PointsAccountModel } from "../models/yaysPointsAccount";
import pointsLedgerSchema, { PointsLedgerEntryModel } from "../models/yaysPointsLedger";
import {
  LedgerStatus,
  PointsAccount,
  PointsLedgerEntry,
  PointsReason,
} from "../data/yaysWallet";

/** Points a member can earn in one UTC day, across every activity. */
export const DAILY_POINTS_CAP = 200;

/** Ambiguous characters are omitted so a code read aloud or off a screen is unambiguous. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

const isDuplicateKeyError = (error: any): boolean =>
  error?.code === 11000 || error?.code === 11001;

/** UTC day key. Streaks and the daily cap both roll over at 00:00 UTC. */
export const utcDayKey = (at: Date = new Date()): string =>
  at.toISOString().slice(0, 10);

const previousDayKey = (dayKey: string): string => {
  const previous = new Date(`${dayKey}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return utcDayKey(previous);
};

export class PointsAccountService extends ServiceBase<PointsAccount, PointsAccountModel> {
  private users = new UserService();

  constructor() {
    super(pointsAccountSchema, "YaysPointsAccount");
  }

  private randomCode(): string {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  /**
   * The account's invite code.
   *
   * Deliberately the *Indexx* `user.referralCode` when the account has one,
   * rather than a second YaysApp-only code. The ecosystem already counts
   * referrals by that code — it is what unlocks the BTCY Mining Station — so
   * minting a separate one would mean a friend invited through YaysApp did not
   * count towards mining, which is exactly the kind of split a user would read
   * as the reward being withheld. Falls back to a locally generated code only
   * for accounts with no Indexx record yet.
   */
  private async indexxReferralCode(userLower: string): Promise<string | null> {
    try {
      const user: any = await this.users.findOneSelect(
        { email: userLower },
        { referralCode: 1 }
      );
      const code = String(user?.referralCode || "").trim().toUpperCase();
      return code || null;
    } catch (error) {
      console.error("[yays/points] could not read Indexx referral code", error);
      return null;
    }
  }

  /**
   * Fetch the account, creating it on first touch.
   *
   * Created lazily rather than at signup so accounts that predate this module
   * get one the first time they open the Earn tab. Code collisions are resolved
   * by retrying against the unique index — checking first would race with a
   * concurrent create for a different user.
   */
  async ensure(userLower: string): Promise<PointsAccount> {
    const existing = await this.findOne({ userLower });
    if (existing) {
      return existing;
    }

    const shared = await this.indexxReferralCode(userLower);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        return await this.create({
          userLower,
          balance: 0,
          lifetimeEarned: 0,
          streakDays: 0,
          lastCheckInDate: null,
          earnedToday: 0,
          earnedTodayDate: null,
          // Only the first attempt can use the shared code; if that collided,
          // a generated one is the only way forward.
          referralCode: (attempt === 0 && shared) || this.randomCode(),
        } as PointsAccount);
      } catch (error: any) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        // Either another request created the account (done), or the code
        // collided (retry with a new one).
        const raced = await this.findOne({ userLower });
        if (raced) {
          return raced;
        }
      }
    }
    throw new Error("Could not allocate a referral code for this account.");
  }

  async byCode(code: string): Promise<PointsAccount | null> {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) {
      return null;
    }
    return (await this.findOne({ referralCode: normalized })) || null;
  }
}

export class PointsLedgerService extends ServiceBase<PointsLedgerEntry, PointsLedgerEntryModel> {
  constructor() {
    super(pointsLedgerSchema, "YaysPointsLedger");
  }

  async history(userLower: string, limit: number, skip: number): Promise<PointsLedgerEntry[]> {
    return this.findPaginatedSkip(limit, skip, { createdAt: -1 }, { userLower }, {});
  }

  async entry(userLower: string, id: string): Promise<PointsLedgerEntry | null> {
    return (await this.findOne({ _id: id, userLower })) || null;
  }

  async byKey(userLower: string, idempotencyKey: string): Promise<PointsLedgerEntry | null> {
    return (await this.findOne({ userLower, idempotencyKey })) || null;
  }
}

export interface CreditInput {
  userLower: string;
  amount: number;
  reason: PointsReason;
  activity: string;
  idempotencyKey: string;
  status?: LedgerStatus;
  note?: string;
  meta?: Record<string, any>;
  /** Set false for referral/campaign payouts that should bypass the daily cap. */
  countsTowardDailyCap?: boolean;
}

export interface CreditResult {
  entry: PointsLedgerEntry;
  account: PointsAccount;
  /** True when this key had already been credited and nothing new was written. */
  duplicate: boolean;
  /** Set when the credit was trimmed or refused by the daily cap. */
  cappedTo?: number;
}

/**
 * The single writer for IndexxPoints.
 *
 * Everything that pays a member — check-ins, referrals, campaigns, admin
 * adjustments — goes through `credit` so that the ledger stays the complete
 * history of the balance. Callers supply an idempotency key; a retry with the
 * same key returns the original entry instead of paying again.
 */
export class YaysPointsService {
  private accounts = new PointsAccountService();
  private ledger = new PointsLedgerService();

  accountService(): PointsAccountService {
    return this.accounts;
  }

  ledgerService(): PointsLedgerService {
    return this.ledger;
  }

  async summary(userLower: string): Promise<PointsAccount> {
    const account = await this.accounts.ensure(userLower);
    return this.withRolledOverDay(account);
  }

  /**
   * Zero `earnedToday` when the stored day has passed.
   *
   * Done on read rather than by a scheduled job so the cap is correct even if
   * nothing ran overnight. The write is conditional on the stale date, so two
   * concurrent readers cannot both reset a day's earnings.
   */
  private async withRolledOverDay(account: PointsAccount): Promise<PointsAccount> {
    const today = utcDayKey();
    if (account.earnedTodayDate === today) {
      return account;
    }
    await this.accounts.updatePart(
      { userLower: account.userLower, earnedTodayDate: account.earnedTodayDate ?? null },
      { $set: { earnedToday: 0, earnedTodayDate: today } }
    );
    return { ...account, earnedToday: 0, earnedTodayDate: today };
  }

  /** Points this account may still earn today under the daily cap. */
  async remainingDailyAllowance(userLower: string): Promise<number> {
    const account = await this.summary(userLower);
    return Math.max(0, DAILY_POINTS_CAP - (account.earnedToday || 0));
  }

  async credit(input: CreditInput): Promise<CreditResult> {
    const { userLower, reason, activity, idempotencyKey } = input;
    const countsTowardCap = input.countsTowardDailyCap !== false;

    const existing = await this.ledger.byKey(userLower, idempotencyKey);
    if (existing) {
      return {
        entry: existing,
        account: await this.summary(userLower),
        duplicate: true,
      };
    }

    let account = await this.summary(userLower);
    let amount = Math.round(input.amount);
    let cappedTo: number | undefined;

    if (amount > 0 && countsTowardCap) {
      const allowance = Math.max(0, DAILY_POINTS_CAP - (account.earnedToday || 0));
      if (amount > allowance) {
        cappedTo = allowance;
        amount = allowance;
      }
    }

    if (amount === 0) {
      // Nothing to pay — record the attempt so the caller's key is consumed and
      // a retry does not slip through once the cap resets tomorrow.
      const entry = await this.ledger.create({
        userLower,
        amount: 0,
        reason,
        activity,
        status: "completed",
        idempotencyKey,
        balanceAfter: account.balance,
        note: input.note ?? "Daily earning limit reached.",
        meta: input.meta ?? {},
      } as PointsLedgerEntry);
      return { entry, account, duplicate: false, cappedTo };
    }

    if (amount < 0 && account.balance + amount < 0) {
      throw new InsufficientPointsError(account.balance, Math.abs(amount));
    }

    // Apply to the rollup first. `$inc` is atomic, so concurrent credits cannot
    // interleave into a lost update, and the returned document gives the
    // running total this entry lands on.
    const updated = (await this.accounts.findOneUpdate(
      { userLower },
      {
        $inc: {
          balance: amount,
          lifetimeEarned: amount > 0 ? amount : 0,
          ...(countsTowardCap && amount > 0 ? { earnedToday: amount } : {}),
        },
        $set: { earnedTodayDate: utcDayKey() },
      },
      { new: true }
    )) as PointsAccount;

    account = updated;

    try {
      const entry = await this.ledger.create({
        userLower,
        amount,
        reason,
        activity,
        status: input.status ?? "completed",
        idempotencyKey,
        balanceAfter: updated.balance,
        note: input.note ?? null,
        meta: input.meta ?? {},
      } as PointsLedgerEntry);
      return { entry, account, duplicate: false, cappedTo };
    } catch (error: any) {
      // A concurrent request with the same key won the unique index. Undo the
      // increment we just made and return their entry, so the pair of requests
      // together still credits exactly once.
      await this.accounts.updatePart(
        { userLower },
        {
          $inc: {
            balance: -amount,
            lifetimeEarned: amount > 0 ? -amount : 0,
            ...(countsTowardCap && amount > 0 ? { earnedToday: -amount } : {}),
          },
        }
      );
      if (isDuplicateKeyError(error)) {
        const winner = await this.ledger.byKey(userLower, idempotencyKey);
        if (winner) {
          return {
            entry: winner,
            account: await this.summary(userLower),
            duplicate: true,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Daily check-in.
   *
   * The UTC date is both the idempotency key and the streak key, so a double
   * tap, a retry after a dropped response, and two devices checking in at once
   * all collapse to one credit for that day.
   */
  async checkIn(userLower: string, points: number): Promise<CreditResult & { streakDays: number }> {
    const today = utcDayKey();
    const account = await this.summary(userLower);

    if (account.lastCheckInDate === today) {
      const entry = await this.ledger.byKey(userLower, `checkin:${today}`);
      throw new AlreadyCheckedInError(account.streakDays, entry?.amount ?? 0);
    }

    const continues = account.lastCheckInDate === previousDayKey(today);
    const streakDays = continues ? (account.streakDays || 0) + 1 : 1;

    // Claim the day before crediting: the conditional filter means only one
    // request can move `lastCheckInDate` off its previous value.
    const claimed = await this.accounts.findOneUpdate(
      { userLower, lastCheckInDate: account.lastCheckInDate ?? null },
      { $set: { lastCheckInDate: today, streakDays } },
      { new: true }
    );
    if (!claimed) {
      throw new AlreadyCheckedInError(account.streakDays, 0);
    }

    const result = await this.credit({
      userLower,
      amount: points,
      reason: "daily_checkin",
      activity: "Daily check-in",
      idempotencyKey: `checkin:${today}`,
      meta: { streakDays },
    });

    return { ...result, streakDays };
  }
}

export class InsufficientPointsError extends Error {
  constructor(public balance: number, public required: number) {
    super("You do not have enough IndexxPoints for this.");
    this.name = "InsufficientPointsError";
  }
}

export class AlreadyCheckedInError extends Error {
  constructor(public streakDays: number, public awarded: number) {
    super("You already checked in today. Come back tomorrow!");
    this.name = "AlreadyCheckedInError";
  }
}

export const yaysPoints = new YaysPointsService();
