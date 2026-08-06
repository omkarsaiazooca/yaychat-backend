import { getRedis } from "../cache/redis";
import { getSubscriptionPlansCached } from "../cache/subscriptionPlansCache";
import { SubscriptionPlan } from "../data/miningSubcriptionPlans";
import { Subscription } from "../data/subscription";
import { Repository } from "../db/base";
import { addMinutesUTC } from "../helpers/time";
import subscriptionSchema from "../models/subscription";
import { MiningService } from "./mining.service";
import { SubscriptionPlansService } from "./miningSubscriptionPlan.service";
import { UserService } from "./user.service";
import { NotificationService } from "./notification.service";
const miningService: MiningService = new MiningService();
const subscriptionPlansService: SubscriptionPlansService =
  new SubscriptionPlansService();
const userService: UserService = new UserService();
const notificationService: NotificationService = new NotificationService();
const INFLUENCER_REFERRAL_CODE = "kZAeFJch";
const REFERRAL_TRIAL_SOURCE = "ReferralTrial";
const TRIAL_DAYS = 30;
const TRIAL_DAYS_WEEK = 7;
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
const MS_PER_DAY = 86_400_000;
const endOfDayUTC = (d: Date) => {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
};

// name constants used in your code
const FREE_PLAN_NAME = "Free";
const ELECTRIC_PLAN_NAME = "Electric Power";
const TURBO_PLAN_NAME = "Turbo Power";
const NUCLEAR_PLAN_NAME = "Nuclear Power";
const ANNIVERSARY_NUCLEAR_PROMO_SOURCE = "one_year_mining_nuclear_2026";
const ANNIVERSARY_NUCLEAR_PROMO_START = new Date("2026-05-29T00:00:00.000Z");
const ANNIVERSARY_NUCLEAR_PROMO_DAYS = 7;
const ANNIVERSARY_NUCLEAR_PROMO_PAYMENT_METHOD = "AnniversaryPromo";

const addDaysUTC = (d: Date, days: number) =>
  new Date(d.getTime() + days * MS_PER_DAY);

const ANNIVERSARY_NUCLEAR_PROMO_END = addDaysUTC(
  ANNIVERSARY_NUCLEAR_PROMO_START,
  ANNIVERSARY_NUCLEAR_PROMO_DAYS
);

type Duration = { years?: number; months?: number; days?: number };

const PLAN_DURATION_MAP: Record<string, Duration> = {
  "Electric Power": { months: 1 },
  "Turbo Power": { months: 1 },
  "Nuclear Power": { months: 1 },
  "Electric Power (3-Month Loyalty)": { months: 3 },
  "Turbo Power (3-Month Loyalty)": { months: 3 },
  "Nuclear Power (3-Month Loyalty)": { months: 3 },
  "Electric Mining Weekly Pass": { days: 7 },
  "Turbo Mining Weekly Pass": { days: 7 },
  "Nuclear Mining Weekly Pass": { days: 7 },
  "15x Speed Mining - 1 Day": { days: 1 },
  "15x Speed Mining - 3 Days": { days: 3 },
  "15x Speed Mining - 7 Days": { days: 7 },
};

function applyDuration(start: Date, duration?: Duration): Date {
  const end = new Date(start);
  const value = duration ?? { years: 1 };
  if (value.years) {
    end.setFullYear(end.getFullYear() + value.years);
  }
  if (value.months) {
    end.setMonth(end.getMonth() + value.months);
  }
  if (value.days) {
    end.setDate(end.getDate() + value.days);
  }
  return end;
}

export class SubscriptionService extends Repository<Subscription, any> {
  constructor() {
    super(subscriptionSchema, "Subscription");
  }

  private isAnniversaryPromoWindowActive(now: Date) {
    return (
      now.getTime() >= ANNIVERSARY_NUCLEAR_PROMO_START.getTime() &&
      now.getTime() < ANNIVERSARY_NUCLEAR_PROMO_END.getTime()
    );
  }

  private isPaidPowerPlan(subscription: any) {
    const plan = String(subscription?.plan || "").toLowerCase();
    const isPowerPlan =
      plan.includes("electric") ||
      plan.includes("turbo") ||
      plan.includes("nuclear");
    const paymentMethod = String(subscription?.paymentMethod || "").trim();
    const isPromoPayment =
      paymentMethod === ANNIVERSARY_NUCLEAR_PROMO_PAYMENT_METHOD;
    return (
      isPowerPlan &&
      !isPromoPayment &&
      (Number(subscription?.cost || 0) > 0 || paymentMethod !== "")
    );
  }

  private isActiveAnniversaryNuclearPromo(subscription: any, now: Date) {
    if (
      !subscription ||
      subscription.anniversaryPromoSource !== ANNIVERSARY_NUCLEAR_PROMO_SOURCE ||
      subscription.anniversaryPromoRestoredAt
    ) {
      return false;
    }

    const promoEndAt = subscription.anniversaryPromoEndAt
      ? new Date(subscription.anniversaryPromoEndAt)
      : null;
    return !!promoEndAt && now.getTime() < promoEndAt.getTime();
  }

  private async restoreAnniversaryNuclearPromoIfEnded(
    email: string,
    coinSymbol: string,
    subscription: any,
    now: Date
  ) {
    if (
      !subscription ||
      subscription.anniversaryPromoSource !== ANNIVERSARY_NUCLEAR_PROMO_SOURCE ||
      subscription.anniversaryPromoRestoredAt
    ) {
      return subscription;
    }

    const promoEndAt = subscription.anniversaryPromoEndAt
      ? new Date(subscription.anniversaryPromoEndAt)
      : null;
    if (!promoEndAt || now.getTime() < promoEndAt.getTime()) {
      return subscription;
    }

    const previousPlan = String(subscription.anniversaryPromoPreviousPlan || "");
    const previousStartDate = subscription.anniversaryPromoPreviousStartDate
      ? new Date(subscription.anniversaryPromoPreviousStartDate)
      : null;
    const previousEndDate = subscription.anniversaryPromoPreviousEndDate
      ? new Date(subscription.anniversaryPromoPreviousEndDate)
      : null;

    if (previousPlan && previousEndDate) {
      const isPendingPurchase =
        subscription.anniversaryPromoPreviousIsPendingPurchase === true;
      const restoredStartDate = previousStartDate || subscription.startDate || now;
      const restoredEndDate = isPendingPurchase
        ? previousEndDate
        : addDaysUTC(previousEndDate, ANNIVERSARY_NUCLEAR_PROMO_DAYS);
      await this.updatePart(
        { email, coinSymbol, status: "Active" },
        {
          $set: {
            plan: previousPlan,
            speedBoost:
              subscription.anniversaryPromoPreviousSpeedBoost ??
              subscription.speedBoost,
            miningRate:
              subscription.anniversaryPromoPreviousMiningRate ??
              subscription.miningRate,
            cost:
              subscription.anniversaryPromoPreviousCost ??
              subscription.cost ??
              0,
            paymentMethod:
              subscription.anniversaryPromoPreviousPaymentMethod || "",
            startDate: restoredStartDate,
            endDate: restoredEndDate,
            anniversaryPromoRestoredAt: now,
            bonusNote:
              isPendingPurchase
                ? "One-year mining anniversary promo ended. Purchased mining plan started."
                : "One-year mining anniversary promo ended. Paid mining plan resumed with 7 held days added.",
          },
        }
      );
      await miningService.updatePart(
        { email, coinSymbol },
        {
          $set: {
            miningPlan: previousPlan,
            miningRate:
              subscription.anniversaryPromoPreviousMiningRate ??
              subscription.miningRate,
            planSyncedAt: now,
          },
        }
      );
    } else {
      await this.updatePart(
        { email, coinSymbol, status: "Active" },
        {
          $set: {
            plan: FREE_PLAN_NAME,
            speedBoost: 1.5,
            miningRate: 1.5,
            cost: 0,
            paymentMethod: "",
            startDate: now,
            endDate: addDays(now, 30),
            anniversaryPromoRestoredAt: now,
            bonusNote:
              "One-year mining anniversary Nuclear promo ended. Free mining resumed.",
          },
        }
      );
      await miningService.updatePart(
        { email, coinSymbol },
        {
          $set: {
            miningPlan: FREE_PLAN_NAME,
            miningRate: 1.5,
            planSyncedAt: now,
          },
        }
      );
    }

    return this.findOne({ email, coinSymbol, status: "Active" });
  }

  private async applyAnniversaryNuclearPromoIfDue(
    email: string,
    coinSymbol: string,
    subscription: any,
    allPlans: any[],
    now: Date
  ) {
    const normalizedEmail = String(email || "").toLowerCase();
    if (
      coinSymbol !== "BTCY" ||
      !subscription ||
      !this.isAnniversaryPromoWindowActive(now) ||
      subscription.anniversaryPromoSource === ANNIVERSARY_NUCLEAR_PROMO_SOURCE
    ) {
      return subscription;
    }

    const nuclearTemplate = allPlans.find(
      (x: any) => x.name === NUCLEAR_PLAN_NAME
    );
    if (!nuclearTemplate) {
      return subscription;
    }

    const promoEndAt = ANNIVERSARY_NUCLEAR_PROMO_END;
    const isPaidPower = this.isPaidPowerPlan(subscription);
    const updateFilter: any = {
      email: normalizedEmail,
      coinSymbol,
      status: "Active",
      $or: [
        { anniversaryPromoSource: { $exists: false } },
        { anniversaryPromoSource: "" },
      ],
    };

    const update: any = {
      $set: {
        plan: NUCLEAR_PLAN_NAME,
        speedBoost: nuclearTemplate.speedBoost,
        miningRate: nuclearTemplate.miningRate,
        cost: 0,
        paymentMethod: ANNIVERSARY_NUCLEAR_PROMO_PAYMENT_METHOD,
        startDate: now,
        endDate: promoEndAt,
        anniversaryPromoSource: ANNIVERSARY_NUCLEAR_PROMO_SOURCE,
        anniversaryPromoAppliedAt: now,
        anniversaryPromoStartAt: now,
        anniversaryPromoEndAt: promoEndAt,
        bonusNote:
          "One-year mining anniversary promo: 7 days of Nuclear Power Mining, free.",
      },
    };

    if (isPaidPower) {
      update.$set.anniversaryPromoPreviousPlan = subscription.plan;
      update.$set.anniversaryPromoPreviousSpeedBoost = subscription.speedBoost;
      update.$set.anniversaryPromoPreviousMiningRate = subscription.miningRate;
      update.$set.anniversaryPromoPreviousCost = subscription.cost;
      update.$set.anniversaryPromoPreviousPaymentMethod =
        subscription.paymentMethod;
      update.$set.anniversaryPromoPreviousEndDate = subscription.endDate;
    }

    await this.updatePart(updateFilter, update);
    await miningService.updatePart(
      { email: normalizedEmail, coinSymbol },
      {
        $set: {
          miningPlan: NUCLEAR_PLAN_NAME,
          miningRate: nuclearTemplate.miningRate,
          planSyncedAt: now,
        },
      }
    );

    return this.findOne({ email: normalizedEmail, coinSymbol, status: "Active" });
  }

  private clampOverlapMs(
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date
  ): number {
    const start = Math.max(aStart.getTime(), bStart.getTime());
    const end = Math.min(aEnd.getTime(), bEnd.getTime());
    return Math.max(0, end - start);
  }

  async subscribeUser(
    email: string,
    plan: string,
    paymentMethod: string,
    coinSymbol: string
  ): Promise<any> {
    console.log(email, plan, paymentMethod, coinSymbol);
    const plans = await subscriptionPlansService.find({});
    const miningRateObj = plans.find((p) => p.name === plan);
    if (!miningRateObj) {
      return { status: 400, message: "Invalid subscription plan" };
    }

    const { speedBoost, cost, miningRate } = miningRateObj;

    // Handle payment
    if (cost > 0) {
      const paymentResult = { status: 200, data: {}, success: true, error: "" };
      if (!paymentResult.success) {
        return {
          status: 500,
          message: "Payment failed",
          error: paymentResult.error,
        };
      }
    }

    const startDate = new Date();
    const endDate = applyDuration(
      startDate,
      PLAN_DURATION_MAP[plan] ?? { years: 1 }
    );

    const subscriptionData: Subscription = {
      email,
      plan,
      speedBoost,
      cost,
      paymentMethod,
      startDate,
      endDate,
      status: "Active",
      miningRate: miningRate,
      coinSymbol: coinSymbol,
      referralBonusUsed: 0, // Initialize referral bonus used
    };
    // Find the existing subscription
    let existingSubscription = await this.findOne({ email, coinSymbol });

    if (this.isActiveAnniversaryNuclearPromo(existingSubscription, startDate)) {
      const promoEndAt = new Date(existingSubscription.anniversaryPromoEndAt);
      const deferredEndDate = applyDuration(
        promoEndAt,
        PLAN_DURATION_MAP[plan] ?? { years: 1 }
      );

      await this.updatePart(
        { email, coinSymbol, status: "Active" },
        {
          $set: {
            anniversaryPromoPreviousPlan: plan,
            anniversaryPromoPreviousSpeedBoost: speedBoost,
            anniversaryPromoPreviousMiningRate: miningRate,
            anniversaryPromoPreviousCost: cost,
            anniversaryPromoPreviousPaymentMethod: paymentMethod,
            anniversaryPromoPreviousStartDate: promoEndAt,
            anniversaryPromoPreviousEndDate: deferredEndDate,
            anniversaryPromoPreviousIsPendingPurchase: true,
            bonusNote:
              "Purchased mining plan queued. Anniversary Nuclear promo remains active until its end date.",
          },
        }
      );

      return {
        status: 200,
        message:
          "Subscription purchase queued until the anniversary Nuclear promo ends.",
        data: {
          ...subscriptionData,
          startDate: promoEndAt,
          endDate: deferredEndDate,
          queuedUntil: promoEndAt,
        },
      };
    }

    // Update mining plan based on the subscription
    if (existingSubscription) {
      // Update existing subscription
      await this.updatePart(
        { email, coinSymbol },
        {
          $set: {
            plan,
            speedBoost,
            cost,
            paymentMethod,
            startDate,
            endDate,
            status: "Active",
          },
        }
      );
    } else {
      // Create new subscription
      await this.create({
        ...subscriptionData,
      });
    }

    // Find mining record
    let existingMining = await miningService.findOne({ email });

    if (existingMining) {
      // Update mining plan based on the subscription
      await miningService.updatePart(
        { email },
        { $set: { miningPlan: plan, miningRate } }
      );
    } else {
      // Create mining entry
      await miningService.create({
        email,
        miningPlan: plan,
        totalMined: 0,
        isMiningActive: false,
        miningRate,
        coinSymbol,
      });
    }

    if (plan && plan.toLowerCase() !== "free") {
      await notificationService.sendPowerActivated(email, {
        powerName: plan,
      });
    }

    return {
      status: 200,
      message: "Subscription successful",
      data: { email, plan, speedBoost, cost, startDate, endDate },
    };
  }

  // async getUserSubscriptionOld(email: string, coinSymbol: string): Promise<any> {
  //   try {
  //     const now = new Date();
  //     const filter = { email: email.toLowerCase(), coinSymbol };
  //     let subscription = await this.findOne({
  //       email,
  //       status: "Active",
  //       coinSymbol,
  //     });

  //     const isExpired = !subscription || new Date(subscription.endDate) < now;
  //     if (isExpired) subscription = null;

  //     const allPlans = await subscriptionPlansService.find({});
  //     const freeTemplate = allPlans.find(x => x.name == "Free") as SubscriptionPlan;
  //     const electricTemplate = allPlans.find(x => x.name == "Electric Power") as SubscriptionPlan;

  //     if (!freeTemplate) {
  //       return { status: 400, message: 'Missing required plans (Free or Turbo Power)' };
  //     }

  //     // Count user referrals
  //     const userDoc = await userService.findOneSelect({ email }, { relationships: 1, referralCodeUsed: 1 });
  //     const refCount = userDoc?.relationships?.length || 0;
  //     const totalBonusDays = Math.floor(refCount / 2); // 2 refs = +1 day

  //     const used = userDoc.referralCodeUsed || "";
  //     if (used === "kZAeFJch" && !subscription) {  // User ioins using these referral codes 1 month electric
  //       const now = new Date();
  //       const end = addDays(now, TRIAL_DAYS);

  //       await this.updateOneWithOptions(
  //         { email, coinSymbol },
  //         {
  //           $setOnInsert: { email: filter.email, coinSymbol: filter.coinSymbol },
  //           $set: {
  //             startDate: now,
  //             endDate: end,
  //             status: 'Active',
  //             plan: ELECTRIC_PLAN_NAME,
  //             speedBoost: electricTemplate.speedBoost,
  //             miningRate: electricTemplate.miningRate,
  //             cost: 0,
  //             paymentMethod: '',
  //           },
  //         },
  //         { upsert: true }
  //       );

  //       subscription = await this.findOne({ email, coinSymbol });
  //       return { status: 200, data: subscription };
  //     } else
  // if ((used === "X8hcj4H6" || used === "znk3gcif" || used === "ntHA4dtp") && !subscription) {   // User joins using these referral codes 1 week electric
  //       const now = new Date();
  //       const end = addDays(now, TRIAL_DAYS_WEEK);

  //       await this.updateOneWithOptions(
  //         { email, coinSymbol },
  //         {
  //           $setOnInsert: { email: filter.email, coinSymbol: filter.coinSymbol },
  //           $set: {
  //             startDate: now,
  //             endDate: end,
  //             status: 'Active',
  //             plan: ELECTRIC_PLAN_NAME,
  //             speedBoost: electricTemplate.speedBoost,
  //             miningRate: electricTemplate.miningRate,
  //             cost: 0,
  //             paymentMethod: '',
  //           },
  //         },
  //         { upsert: true }
  //       );

  //       subscription = await this.findOne({ email, coinSymbol });
  //       return { status: 200, data: subscription };
  //     }

  //     if (!subscription) {
  //       // New or expired → create a Free plan with base + bonus days
  //       const startDate = now;
  //       const endDate = new Date(startDate);
  //       endDate.setDate(endDate.getDate() + 30 + totalBonusDays); // 30 days base + bonus

  //       await this.updateOneWithOptions(
  //         { email, coinSymbol }, {
  //         $setOnInsert: { email: filter.email, coinSymbol: filter.coinSymbol },
  //         $set: {
  //           plan: 'Free',
  //           speedBoost: freeTemplate.speedBoost,
  //           miningRate: freeTemplate.miningRate,
  //           cost: 0,
  //           paymentMethod: '',
  //           startDate,
  //           endDate,
  //           status: 'Active',
  //           referralBonusUsed: totalBonusDays,
  //         }
  //       },
  //         { upsert: true }
  //       );
  //       subscription = await this.findOne({ email, coinSymbol, status: "Active" });
  //       return { status: 200, data: subscription };
  //     }

  //     // Existing active subscription
  //     const usedBonus = subscription.referralBonusUsed || 0;
  //     /*const newBonus = totalBonusDays - usedBonus;

  //      if (newBonus > 0) {
  //        // Set new endDate = today + newBonus (ignore current endDate to avoid overflow)
  //        const newEndDate = new Date(now);
  //        newEndDate.setDate(now.getDate() + newBonus);

  //        console.log("Applying new bonus days:", newBonus);
  //        console.log("Setting Turbo Power plan with updated endDate:", newEndDate.toISOString());

  //        // Update subscription with Turbo Power + new bonus days
  //        await this.updatePart(
  //          {
  //            email: subscription.email,
  //            coinSymbol: subscription.coinSymbol,
  //          },
  //          {
  //            $set: {
  //              endDate: newEndDate,
  //              referralBonusUsed: totalBonusDays,
  //              miningRate: turboTemplate.miningRate,
  //              speedBoost: turboTemplate.speedBoost,
  //              plan: 'Turbo Power',
  //            },
  //          }
  //        );

  //        // Reload updated subscription
  //        subscription = await this.findOne({
  //          email,
  //          status: "Active",
  //          coinSymbol,
  //        });
  //      }*/

  //     return { status: 200, data: subscription };
  //   } catch (err) {
  //     console.error(err);
  //     return { status: 500, message: "Error fetching subscription", error: err };
  //   }
  // }

  async getUserSubscription(email: string, coinSymbol: string): Promise<any> {
    try {
      const mining = await miningService.findOne({
        email: email.toLowerCase(),
        coinSymbol,
      });
      const isMiningActive = !!mining?.isMiningActive;
      const now = new Date();
      const filter = { email: email.toLowerCase(), coinSymbol };

      if (!isMiningActive) {
        await this.applyPendingBatch(filter.email, coinSymbol, 5);
      }

      // Active subscription (not expired)
      let subscription = await this.findOne({
        email: filter.email,
        status: "Active",
        coinSymbol,
      });
      subscription = await this.restoreAnniversaryNuclearPromoIfEnded(
        filter.email,
        coinSymbol,
        subscription,
        now
      );

      // Check for pending rewards
      /*/ if (subscription && !isMiningActive) {
         const plan = String(subscription.plan || "");
         const hasPending =
           Array.isArray((subscription as any).pendingRewards) &&
           (subscription as any).pendingRewards.length > 0;
 
         if (hasPending && (plan === "Free" || plan === "Electric Power")) {
           const appliedGrants: any[] = [];
 
           for (const r of (subscription as any).pendingRewards) {
             let start = now;
             let end = addMinutesUTC(now, r.minutes);
 
             if (
               plan === "Electric Power" &&
               subscription.endDate &&
               new Date(subscription.endDate) > now
             ) {
               // keep existing electric window and extend
               start = subscription.startDate;
               end = addMinutesUTC(new Date(subscription.endDate), r.minutes);
             }
 
             await this.updatePart(
               { email, coinSymbol, status: "Active" },
               {
                 $set: { plan: "Electric Power", startDate: start, endDate: end },
                 $push: { rewardGrants: { ...r, appliedAt: now } },
                 $pull: { pendingRewards: { grantedAt: r.grantedAt } },
               }
             );
 
             appliedGrants.push(r);
           }
 
           if (appliedGrants.length) {
             // refresh
             subscription = await this.findOne({ email, coinSymbol, status: "Active" });
           }
         } else if (isMiningActive) {
           console.log(`[rewards] Skipping apply for ${email} (${coinSymbol}) — mining active`);
         } else {
           console.log(`[rewards] No applicable pending rewards for ${email} (${coinSymbol})`);
         }
       }*/

      // then re-read subscription (so UI shows updated plan/dates)
      subscription = await this.findOne({
        email: filter.email,
        coinSymbol,
        status: "Active",
      });
      const expired = !subscription || new Date(subscription.endDate) < now;
      if (expired) subscription = null;

      // Load plans
      const allPlans = await subscriptionPlansService.find({});
      const FREE_PLAN_NAME = "Free";
      const ELECTRIC_PLAN_NAME = "Electric Power";
      const TURBO_PLAN_NAME = "Turbo Power";
      const NUCLEAR_PLAN_NAME = "Nuclear Power";

      const freeTemplate = allPlans.find((x: any) => x.name === FREE_PLAN_NAME);
      const electricTemplate = allPlans.find(
        (x: any) => x.name === ELECTRIC_PLAN_NAME
      );
      const turboTemplate = allPlans.find(
        (x: any) => x.name === TURBO_PLAN_NAME
      );
      const nuclearTemplate = allPlans.find(
        (x: any) => x.name === NUCLEAR_PLAN_NAME
      );

      if (!freeTemplate || !turboTemplate) {
        return {
          status: 400,
          message: "Missing required plans (Free or Turbo Power).",
        };
      }

      // Referral stats (outgoing invites) + the code used by this user (incoming)
      const userDoc = await userService.findOneSelect(
        { email: filter.email },
        { relationships: 1, referralCodeUsed: 1 }
      );
      const refCount = userDoc?.relationships?.length ?? 0;
      const totalBonusDays = Math.floor(refCount / 2); // 2 invites = +1 Turbo day
      const usedCode = String(userDoc?.referralCodeUsed || "");

      // 🔎 If the user used a referral code, find who referred them (if we can)
      let referredByEmail = "";
      let referrerName = "";
      if (usedCode) {
        const referrer = await userService.findOneSelect(
          { referralCode: usedCode },
          { email: 1, firstName: 1, lastName: 1 }
        );
        if (referrer) {
          referredByEmail = String(referrer.email || "");
          const fn = String(referrer.firstName || "").trim();
          const ln = String(referrer.lastName || "").trim();
          referrerName = fn || ln ? `${fn} ${ln}`.trim() : "";
        }
      }

      // 📝 Helper to build the referral note
      const buildReferralNote = (awardText: string) => {
        const who = referrerName || referredByEmail || "a friend";
        return `Referred by ${who}. ${awardText}`;
      };

      // ------------------------------------------------------------
      // Trials via referral codes (Turbo)
      // ------------------------------------------------------------
      if (!subscription) {
        if (["z6E3uNXJ"].includes(usedCode)) {
          // 1 week Electric
          const start = now;
          const end = addDays(start, TRIAL_DAYS_WEEK);
          await this.updateOneWithOptions(
            { email: filter.email, coinSymbol: filter.coinSymbol },
            {
              $setOnInsert: {
                email: filter.email,
                coinSymbol: filter.coinSymbol,
              },
              $set: {
                startDate: start,
                endDate: end, //           status: "Active",
                plan: TURBO_PLAN_NAME,
                speedBoost:
                  turboTemplate?.speedBoost ?? freeTemplate.speedBoost,
                miningRate:
                  turboTemplate?.miningRate ?? freeTemplate.miningRate,
                cost: 0,
                paymentMethod: "",
                // 🔹 store referral note
                referralNote: buildReferralNote(
                  "We applied a 1-week Turbo Power trial to get you started."
                ),
                referredByEmail,
              },
            },
            { upsert: true }
          );
          subscription = await this.findOne({
            email: filter.email,
            coinSymbol,
            status: "Active",
          });
        }
      }

      // ------------------------------------------------------------
      // Baseline Free (if still no subscription)
      // ------------------------------------------------------------
      if (!subscription) {
        const startDate = now;
        const endDate = addDays(startDate, 30);
        await this.updateOneWithOptions(
          { email: filter.email, coinSymbol: filter.coinSymbol },
          {
            $setOnInsert: {
              email: filter.email,
              coinSymbol: filter.coinSymbol,
            },
            $set: {
              plan: FREE_PLAN_NAME,
              speedBoost: freeTemplate.speedBoost,
              miningRate: freeTemplate.miningRate,
              cost: 0,
              paymentMethod: "",
              startDate,
              endDate,
              status: "Active",
              referralBonusUsed: 0,
              // 🔹 If they used a code, at least record the note even without an Electric trial
              ...(usedCode
                ? {
                    referralNote: buildReferralNote(
                      "Welcome! Your referral has been recorded."
                    ),
                    referredByEmail,
                  }
                : {}),
            },
          },
          { upsert: true }
        );
        subscription = await this.findOne({
          email: filter.email,
          coinSymbol,
          status: "Active",
        });
      }

      // ------------------------------------------------------------
      // If subscription exists but referral note was never saved, save it once
      // ------------------------------------------------------------
      if (subscription && usedCode && !subscription.referralNote) {
        await this.updatePart(
          {
            email: filter.email,
            coinSymbol: filter.coinSymbol,
            status: "Active",
          },
          {
            $set: {
              referralNote: buildReferralNote(
                "Your referral has been recorded."
              ),
              referredByEmail,
            },
          }
        );
        subscription = await this.findOne({
          email: filter.email,
          coinSymbol,
          status: "Active",
        });
      }

      // ------------------------------------------------------------
      // Apply *new* referral bonus (outgoing invites) as TURBO days
      // (keeps your existing logic unchanged here, and continues to set `bonusNote`)
      // ------------------------------------------------------------
      const usedSoFar = Number(subscription.referralBonusUsed || 0);
      let newBonus = totalBonusDays - usedSoFar;

      if (newBonus > 0) {
        const isNuclear =
          String(subscription.plan || "").toLowerCase() ===
          NUCLEAR_PLAN_NAME.toLowerCase();

        // Optimistic lock to avoid double-apply if two requests race
        const filterActive = {
          email: filter.email,
          coinSymbol: filter.coinSymbol,
          status: "Active",
          referralBonusUsed: usedSoFar,
        };

        if (isNuclear) {
          // Nuclear: extend from the tail; +1 extra day on top of referral days
          const daysToApply = newBonus + 1;

          const currentEnd = new Date(subscription.endDate);
          const baseRaw =
            currentEnd.getTime() > now.getTime() ? currentEnd : now;
          const base = endOfDayUTC(baseRaw);
          const newEndDate = addDaysUTC(base, daysToApply);

          const speedBoost =
            nuclearTemplate?.speedBoost ??
            subscription.speedBoost ??
            freeTemplate.speedBoost;
          const miningRate =
            nuclearTemplate?.miningRate ??
            subscription.miningRate ??
            freeTemplate.miningRate;

          const bonusNote = `Referral bonus applied: +${newBonus} Turbo day(s) + 1 extra day for Nuclear plan. Thanks for inviting friends!`;

          await this.updatePart(filterActive, {
            $set: {
              // DO NOT change startDate for Nuclear
              endDate: newEndDate,
              plan: NUCLEAR_PLAN_NAME,
              speedBoost,
              miningRate,
              bonusNote,
              lastBonusAppliedAt: now,
            },
            $inc: { referralBonusUsed: newBonus }, // (extra day is not counted)
          });

          // Re-fetch fresh subscription
          subscription = await this.findOne({
            email: filter.email,
            coinSymbol,
            status: "Active",
          });
        } else if (
          String(subscription.plan || "").toLowerCase() ===
          TURBO_PLAN_NAME.toLowerCase()
        ) {
          // --- TURBO: extend from the tail by newBonus days; keep startDate ---
          const daysToApply = newBonus;

          const currentEnd = new Date(subscription.endDate);
          const baseRaw =
            currentEnd.getTime() > now.getTime() ? currentEnd : now;
          const base = endOfDayUTC(baseRaw);
          const newEndDate = addDaysUTC(base, daysToApply);

          const speedBoost =
            turboTemplate?.speedBoost ??
            subscription.speedBoost ??
            freeTemplate.speedBoost;
          const miningRate =
            turboTemplate?.miningRate ??
            subscription.miningRate ??
            freeTemplate.miningRate;

          const bonusNote = `Referral bonus applied: +${newBonus} Turbo day(s). Thanks for inviting friends!`;

          await this.updatePart(filterActive, {
            $set: {
              // DO NOT change startDate for Turbo
              endDate: newEndDate,
              plan: TURBO_PLAN_NAME, // stays Turbo
              speedBoost,
              miningRate,
              bonusNote,
              lastBonusAppliedAt: now,
            },
            $inc: { referralBonusUsed: newBonus },
          });

          // Re-fetch fresh subscription
          subscription = await this.findOne({
            email: filter.email,
            coinSymbol,
            status: "Active",
          });
        } else {
          // Free/Electric: fresh Turbo window starting today
          const daysToApply = newBonus;

          const start = now;
          const end = addDaysUTC(endOfDayUTC(now), daysToApply);

          const speedBoost =
            turboTemplate?.speedBoost ??
            subscription.speedBoost ??
            freeTemplate.speedBoost;
          const miningRate =
            turboTemplate?.miningRate ??
            subscription.miningRate ??
            freeTemplate.miningRate;

          const bonusNote = `Referral bonus applied: +${newBonus} Turbo day(s). Thanks for inviting friends!`;

          await this.updatePart(filterActive, {
            $set: {
              startDate: start, // fresh window
              endDate: end, // today + N days (EOD)
              plan: TURBO_PLAN_NAME, // upgrade during bonus
              speedBoost,
              miningRate,
              bonusNote,
              lastBonusAppliedAt: now,
            },
            $inc: { referralBonusUsed: newBonus },
          });
        }

        // Re-fetch fresh subscription
        subscription = await this.findOne({
          email: filter.email,
          coinSymbol,
          status: "Active",
        });
      }

      subscription = await this.applyAnniversaryNuclearPromoIfDue(
        filter.email,
        coinSymbol,
        subscription,
        allPlans,
        now
      );

      return { status: 200, data: subscription };
    } catch (err) {
      console.error(err);
      return {
        status: 500,
        message: "Error fetching subscription",
        error: err,
      };
    }
  }

  async getUserSubscriptionForUi(
    email: string,
    coinSymbol: string
  ): Promise<any> {
    try {
      const now = new Date();

      // Get mining state first
      const miningState = await miningService.findOne({
        email: email.toLowerCase(),
        coinSymbol,
      });
      const isMiningActive = !!miningState?.isMiningActive;

      // ✅ apply pending if safe
      if (!isMiningActive) {
        await this.applyPendingBatch(email.toLowerCase(), coinSymbol, 5);
      }

      // --- helpers ---
      const toPlain = (doc: any) => {
        if (!doc) return null;
        if (typeof doc.toObject === "function") return doc.toObject();
        if (doc._doc) return { ...doc._doc };
        return JSON.parse(JSON.stringify(doc));
      };
      const normalizePlan = (p?: string) => (p || "").trim();
      const ratesEqual = (a?: number, b?: number) => {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return Math.abs(a - b) < 1e-9;
      };
      const sanitize = (sub: any) => {
        if (!sub) return null;
        const {
          _id,
          email,
          plan,
          speedBoost,
          miningRate,
          cost,
          paymentMethod,
          startDate,
          endDate,
          coinSymbol,
          status,
          referralBonusUsed,
          bonusNote,
          lastBonusAppliedAt,
          referralNote,
          referredByEmail,
          anniversaryPromoSource,
          anniversaryPromoAppliedAt,
          anniversaryPromoStartAt,
          anniversaryPromoEndAt,
          anniversaryPromoPreviousPlan,
          anniversaryPromoPreviousEndDate,
          anniversaryPromoRestoredAt,
        } = sub;
        return {
          _id,
          email,
          plan,
          speedBoost,
          miningRate,
          cost,
          paymentMethod,
          startDate,
          endDate,
          coinSymbol,
          status,
          referralBonusUsed,
          bonusNote,
          lastBonusAppliedAt,
          referralNote,
          referredByEmail,
          anniversaryPromoSource,
          anniversaryPromoAppliedAt,
          anniversaryPromoStartAt,
          anniversaryPromoEndAt,
          anniversaryPromoPreviousPlan,
          anniversaryPromoPreviousEndDate,
          anniversaryPromoRestoredAt,
        };
      };

      // 1) Active subscription (plain object, no lean)
      let subscriptionDoc = await this.findOne({
        email,
        status: "Active",
        coinSymbol,
      });
      subscriptionDoc = await this.restoreAnniversaryNuclearPromoIfEnded(
        email.toLowerCase(),
        coinSymbol,
        subscriptionDoc,
        now
      );
      let subscription = toPlain(subscriptionDoc);

      const isExpired =
        !subscription ||
        (subscription.endDate && new Date(subscription.endDate) < now);
      if (isExpired) subscription = null;

      // 2) Plans (need at least Free)
      const allPlans = await subscriptionPlansService.find({});
      const freeTemplate = allPlans.find(
        (x) => x.name == "Free"
      ) as SubscriptionPlan;
      if (!freeTemplate) {
        return {
          status: 400,
          message: "Missing required plans (Free or Turbo Power)",
        };
      }

      // 3) Referral bonus days
      const userDoc = await userService.findOneSelect(
        { email },
        { relationships: 1 }
      );
      const refCount = userDoc?.relationships?.length || 0;
      const totalBonusDays = Math.floor(refCount / 2); // 2 refs = +1 day

      // 4) If no active subscription, create a Free one with bonus
      if (!subscription) {
        const startDate = now;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30 + totalBonusDays);

        await this.updatePart(
          { email, coinSymbol },
          {
            $set: {
              email,
              plan: "Free",
              speedBoost: freeTemplate.speedBoost,
              miningRate: freeTemplate.miningRate,
              cost: 0,
              paymentMethod: "",
              startDate,
              endDate,
              status: "Active",
              coinSymbol,
              referralBonusUsed: totalBonusDays,
            },
          }
        );
        // downgrade mining to Free so UI & earnings match
        await miningService.updatePart(
          { email, coinSymbol },
          {
            $set: {
              miningPlan: "Free",
              miningRate: freeTemplate.miningRate,
              planSyncedAt: new Date(),
            },
          }
        );

        // re-fetch and convert to plain
        subscriptionDoc = await this.findOne({
          email,
          status: "Active",
          coinSymbol,
        });
        subscription = toPlain(subscriptionDoc);
      }

      subscriptionDoc = await this.applyAnniversaryNuclearPromoIfDue(
        email.toLowerCase(),
        coinSymbol,
        subscription,
        allPlans,
        now
      );
      subscription = toPlain(subscriptionDoc);

      // 5) Pull mining data
      const miningDoc = await miningService.findOne({ email, coinSymbol });
      const mining = toPlain(miningDoc);

      // 6) Base payload from subscription (sanitized)
      const base = sanitize(subscription) || {
        email,
        coinSymbol,
        plan: "Free",
        miningRate: freeTemplate.miningRate,
        status: "Active",
        referralBonusUsed: 0,
        bonusNote: "",
        lastBonusAppliedAt: undefined,
        referralNote: "",
        referredByEmail: "",
        paymentMethod: "",
        speedBoost: freeTemplate.speedBoost,
        cost: 0,
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 86400000),
      };

      // 7) Only override plan/rate if mining differs
      let finalPlan = base.plan ?? null;
      let finalRate = base.miningRate ?? undefined;

      if (mining) {
        const subPlan = normalizePlan(base.plan);
        const minePlan = normalizePlan(mining.miningPlan);
        const planDiffers = !!minePlan && minePlan !== subPlan;
        const rateDiffers = !ratesEqual(mining.miningRate, base.miningRate);

        if (planDiffers) finalPlan = minePlan;
        if (rateDiffers && typeof mining.miningRate === "number")
          finalRate = mining.miningRate;
      }

      // compute userType (same as getUserSubscription012) & expose planName
      const userType = await this.determineUserType(base.paymentMethod || "");
      const planName = finalPlan ?? base.plan ?? "Free";

      const ui = {
        ...(base || {}),
        plan: finalPlan ?? base.plan ?? "Free",
        planName, // <- expose for session logic (6/12/24h)
        userType, // <- expose "Free Mining" | "Power Mining"
        miningRate: typeof finalRate === "number" ? finalRate : base.miningRate,
        // read-only mining state for UI
        isMiningActive: mining?.isMiningActive ?? false,
        totalMined: mining?.totalMined ?? 0,
        lastClaimTime: mining?.lastClaimTime,
        totalMinedBTCY: mining?.totalMinedBTCY,
        bonusNote: base.bonusNote || "",
        lastBonusAppliedAt: base.lastBonusAppliedAt || undefined,
        referralNote: base.referralNote || "",
        referredByEmail: base.referredByEmail || "",
      };

      return { status: 200, data: ui };
    } catch (err) {
      console.error(err);
      return {
        status: 500,
        message: "Error fetching subscription",
        error: err,
      };
    }
  }

  async getUserSubscription012(
    email: string,
    coinSymbol: string
  ): Promise<any> {
    try {
      // Read-only: fetch user (for wallet) and subscription
      const [userDoc, subscription] = await Promise.all([
        userService.findOneSelect({ email }, { userWallets: 1 }),
        this.findOne({ email, coinSymbol }) as Promise<Subscription | null>,
      ]);

      const wallet = userDoc?.userWallets?.find(
        (w: any) => w.coinSymbol === coinSymbol && w.coinNetwork === "Stellar"
      );

      const ensureUserType = async (paymentMethod: string) =>
        this.determineUserType(paymentMethod || "");

      if (!subscription) {
        return {
          status: 404,
          message: "Subscription not found",
          data: {
            email,
            coinSymbol,
            totalBTCYBalance: wallet?.coinBalance || 0,
          },
        };
      }

      // ----- plan details (read-only via cache helper) -----
      let planDetails: any = null;
      try {
        type SubscriptionPlan = {
          name: string;
          miningRate?: number;
          speedBoost?: number;
        };
        const norm = (s?: string) => (s ?? "").trim().toLowerCase();

        const allPlans = (await subscriptionPlansService.find(
          {}
        )) as SubscriptionPlan[];
        if (Array.isArray(allPlans) && allPlans.length) {
          const planMap = Object.fromEntries(
            allPlans.filter((p) => p?.name).map((p) => [norm(p.name), p])
          );

          planDetails = subscription?.plan
            ? planMap[norm(subscription.plan)] ?? null
            : null;
        } else {
          planDetails = null;
        }
      } catch {
        planDetails = null; // non-fatal
      }

      // ----- robust convert-to-plain (no lean) -----
      const toPlain = (doc: any) => {
        if (doc && typeof doc.toObject === "function") {
          return doc.toObject({
            getters: true,
            virtuals: true,
            versionKey: false,
          });
        }
        if (doc && typeof doc.toJSON === "function") {
          return doc.toJSON({
            getters: true,
            virtuals: true,
            versionKey: false,
          });
        }
        if (doc && doc._doc) return { ...doc._doc };
        return { ...doc };
      };

      const subObj: any = toPlain(subscription);
      if (subObj?._id && !subObj.id) {
        subObj.id = String(subObj._id);
        delete subObj._id;
      }

      // enrich read-only fields
      subObj.userType = await ensureUserType(subscription.paymentMethod || "");
      subObj.totalBTCYBalance = wallet?.coinBalance || 0;
      subObj.planDetails = planDetails;

      return { status: 200, data: subObj };
    } catch (err) {
      console.error("getUserSubscription error:", err);
      return {
        status: 500,
        message: "Error fetching subscription",
        error: err,
      };
    }
  }

  // ✅ Determine userType based on payment method
  async determineUserType(paymentMethod: string): Promise<string> {
    const paidMethods = [
      "Gpay",
      "Paypal",
      "Tygapay",
      "WireTransfer",
      "ACH",
      "CreditCard",
      "Zelle",
      ANNIVERSARY_NUCLEAR_PROMO_PAYMENT_METHOD,
    ];
    return paidMethods.includes(paymentMethod) ? "Power Mining" : "Free Mining";
  }

  async cancelSubscription(email: string): Promise<any> {
    const subscription = await this.findOne({ email, status: "Active" });

    if (!subscription) {
      return { status: 404, message: "No active subscription found" };
    }

    // Update the subscription status to cancelled
    await this.updatePart({ email }, { $set: { status: "Cancelled" } });

    return {
      status: 200,
      message: "Subscription cancelled",
      data: subscription,
    };
  }

  async applyAdReward(
    email: string,
    coinSymbol: string,
    minutes: number,
    source: string
  ) {
    const now = new Date();
    const sub = await this.findOne({ email, coinSymbol, status: "Active" });
    if (!sub) return;

    const planLower = (sub.plan || "").toLowerCase();
    const isTurbo = planLower === "turbo power";
    const isNuclear = planLower === "nuclear power";
    const isElectric = planLower === "electric power";
    const isActivePlan = !!sub.endDate && new Date(sub.endDate) > now;

    const grant: any = {
      kind: "turbo_minutes",
      minutes,
      source,
      grantedAt: now,
    };

    // Queue for later if user has a higher/active plan — let them activate after it expires
    if ((isNuclear || isElectric) && isActivePlan) {
      await this.updatePart(
        { email, coinSymbol, status: "Active" },
        { $push: { pendingRewards: grant } }
      );
      return;
    }

    // Queue if mining is currently active
    let getMiningStatus = await miningService.findOne({ email, coinSymbol });
    const isMiningActive = !!getMiningStatus?.isMiningActive;
    if (isMiningActive) {
      console.log(
        `[rewards] Skipping apply for ${email} (${coinSymbol}) — mining active`
      );
      await this.updatePart(
        { email, coinSymbol, status: "Active" },
        { $push: { pendingRewards: grant } }
      );
      return;
    }

    // Turbo already active → extend end date
    // Free/no active plan → grant fresh Turbo
    const isTurboActive = isTurbo && isActivePlan;
    const start = isTurboActive ? sub.startDate : now;
    const end = isTurboActive
      ? addMinutesUTC(new Date(sub.endDate), minutes)
      : addMinutesUTC(now, minutes);

    await this.updatePart(
      { email, coinSymbol, status: "Active" },
      {
        $set: { plan: "Turbo Power", startDate: start, endDate: end },
        $push: { rewardGrants: { ...grant, appliedAt: now } },
      }
    );

    await notificationService.sendPowerActivated(email, {
      powerName: "Turbo Power",
    });
  }

  async computeProratedRewards(
    email: string,
    coinSymbol: string,
    cycleStart: Date,
    now: Date,
    planRates: { [name: string]: number } // e.g. { Free: 0.01, 'Electric Power': 0.02, 'Turbo Power': 0.03, 'Nuclear Power': 0.05 }
  ) {
    const q = { email: email.toLowerCase(), coinSymbol, status: "Active" };
    const sub = await this.findOne(q);

    // total capped to 24h outside
    const totalMs = Math.max(0, now.getTime() - cycleStart.getTime());
    if (!sub) {
      const freeRate = planRates[FREE_PLAN_NAME] ?? 0;
      return {
        ms: { freeMs: totalMs, planMs: 0, planName: FREE_PLAN_NAME },
        reward: (totalMs / 3600000) * freeRate,
      };
    }

    const planName = String(sub.plan || FREE_PLAN_NAME);
    const planLower = planName.toLowerCase();

    // Only one applied window exists on the sub (startDate..endDate)
    const winStart = sub.startDate ? new Date(sub.startDate) : null;
    const winEnd = sub.endDate ? new Date(sub.endDate) : null;

    // If no usable window, everything is Free
    if (!winStart || !winEnd || winEnd <= cycleStart || winStart >= now) {
      const freeRate = planRates[FREE_PLAN_NAME] ?? 0;
      return {
        ms: { freeMs: totalMs, planMs: 0, planName: FREE_PLAN_NAME },
        reward: (totalMs / 3600000) * freeRate,
      };
    }

    // Which plan window should use its special rate?
    // We support Electric/Turbo/Nuclear here; else treat as Free.
    const specialPlan =
      planLower === ELECTRIC_PLAN_NAME.toLowerCase()
        ? ELECTRIC_PLAN_NAME
        : planLower === TURBO_PLAN_NAME.toLowerCase()
        ? TURBO_PLAN_NAME
        : planLower === NUCLEAR_PLAN_NAME.toLowerCase()
        ? NUCLEAR_PLAN_NAME
        : FREE_PLAN_NAME;

    const specialRate =
      planRates[specialPlan] ?? planRates[FREE_PLAN_NAME] ?? 0;
    const freeRate = planRates[FREE_PLAN_NAME] ?? 0;

    const planMs = this.clampOverlapMs(cycleStart, now, winStart, winEnd);
    const freeMs = Math.max(0, totalMs - planMs);

    const reward =
      (planMs / 3600000) * specialRate + (freeMs / 3600000) * freeRate;

    return {
      ms: { freeMs, planMs, planName: specialPlan },
      reward,
    };
  }

  async applyPendingBatch(
    email: string,
    coinSymbol: string,
    limit = 5
  ): Promise<{ appliedCount: number; lastReason?: string; updated?: any }> {
    let appliedCount = 0;
    let lastReason = "";
    let updated: any = null;

    for (let i = 0; i < limit; i++) {
      const r = await this.applyNextPendingReward(email, coinSymbol);
      if (!r.applied) {
        lastReason = r.reason || "";
        break;
      }
      appliedCount++;
      updated = r.updated || updated;
    }

    return { appliedCount, lastReason, updated };
  }

  async applyNextPendingReward(
    email: string,
    coinSymbol: string,
    now = new Date()
  ): Promise<{ applied: boolean; reason?: string; updated?: any }> {
    email = String(email).toLowerCase().trim();

    const sub = (await this.findOne({
      email,
      coinSymbol,
      status: "Active",
    })) as any;
    if (!sub) return { applied: false, reason: "no-active-subscription" };

    const next = Array.isArray(sub.pendingRewards)
      ? sub.pendingRewards[0]
      : null;
    if (!next) return { applied: false, reason: "empty-queue" };

    // skip while mining
    const mining = await miningService.findOne({ email, coinSymbol });
    if (mining?.isMiningActive)
      return { applied: false, reason: "mining-active" };

    const planLower = String(sub.plan || "").toLowerCase();
    const isElectric = planLower === "electric power";
    const isTurbo = planLower === "turbo power";
    const isNuclear = planLower === "nuclear power";

    const MS_PER_DAY = 86_400_000;
    const endOfDayUTC = (d: Date) => {
      const x = new Date(d);
      x.setUTCHours(23, 59, 59, 999);
      return x;
    };
    const addDaysUTC = (d: Date, days: number) =>
      new Date(d.getTime() + days * MS_PER_DAY);
    const addMinutesUTC = (d: Date, mins: number) =>
      new Date(d.getTime() + mins * 60_000);

    const src = String(next.source || "");
    const isTurboEncoded = src.startsWith("TURBO:");
    const isNuclearEncoded = src.startsWith("NUCLEAR:");
    const minutes = Number(next.minutes || 0);

    if (isNuclearEncoded) {
      let days = 0;
      const m = src.match(/NUCLEAR:days=(\d+)/i);
      if (m?.[1]) days = Math.max(0, parseInt(m[1], 10));
      if (!days && minutes > 0) days = Math.floor(minutes / 1440);
      if (!days) {
        await this.updatePart(
          {
            email,
            coinSymbol,
            status: "Active",
            "pendingRewards.grantedAt": next.grantedAt,
          },
          { $pull: { pendingRewards: { grantedAt: next.grantedAt } } }
        );
        return { applied: false, reason: "invalid-nuclear-encoded" };
      }

      const currentEnd = sub.endDate ? new Date(sub.endDate) : now;
      const base = isNuclear && currentEnd > now ? currentEnd : now;
      const start = isNuclear ? sub.startDate || now : now;
      const end = addDaysUTC(endOfDayUTC(base), days);
      const res = await this.updatePart(
        {
          email,
          coinSymbol,
          status: "Active",
          "pendingRewards.grantedAt": next.grantedAt,
        },
        {
          $set: { startDate: start, endDate: end, plan: "Nuclear Power" },
          $push: { rewardGrants: { ...next, appliedAt: now } },
          $pull: { pendingRewards: { grantedAt: next.grantedAt } },
        }
      );
      const modified =
        (res as any)?.modifiedCount ?? (res as any)?.nModified ?? 0;
      if (!modified) return { applied: false, reason: "race-lost-or-missing" };
      const updated = await this.findOne({
        email,
        coinSymbol,
        status: "Active",
      });
      await notificationService.sendPowerActivated(email, {
        powerName: updated?.plan ?? "Nuclear Power",
      });
      return { applied: true, updated };
    }

    if (isTurboEncoded) {
      let days = 0;
      const m = src.match(/TURBO:days=(\d+)/i);
      if (m?.[1]) days = Math.max(0, parseInt(m[1], 10));
      if (!days && minutes > 0) days = Math.floor(minutes / 1440);
      if (!days) {
        await this.updatePart(
          {
            email,
            coinSymbol,
            status: "Active",
            "pendingRewards.grantedAt": next.grantedAt,
          },
          { $pull: { pendingRewards: { grantedAt: next.grantedAt } } }
        );
        return { applied: false, reason: "invalid-turbo-encoded" };
      }

      // Turbo semantics
      if (isNuclear) {
        const currentEnd = sub.endDate ? new Date(sub.endDate) : now;
        const base = currentEnd > now ? currentEnd : now;
        const end = addDaysUTC(endOfDayUTC(base), days);
        const res = await this.updatePart(
          {
            email,
            coinSymbol,
            status: "Active",
            "pendingRewards.grantedAt": next.grantedAt,
          },
          {
            $set: { endDate: end, plan: "Nuclear Power" },
            $push: { rewardGrants: { ...next, appliedAt: now } },
            $pull: { pendingRewards: { grantedAt: next.grantedAt } },
          }
        );
        const modified =
          (res as any)?.modifiedCount ?? (res as any)?.nModified ?? 0;
        if (!modified)
          return { applied: false, reason: "race-lost-or-missing" };
        const updated = await this.findOne({
          email,
          coinSymbol,
          status: "Active",
        });
        await notificationService.sendPowerActivated(email, {
          powerName: updated?.plan ?? "Nuclear Power",
        });
        return { applied: true, updated };
      }

      if (isTurbo) {
        const currentEnd = sub.endDate ? new Date(sub.endDate) : now;
        const base = currentEnd > now ? currentEnd : now;
        const start = sub.startDate || now;
        const end = addDaysUTC(endOfDayUTC(base), days);
        const res = await this.updatePart(
          {
            email,
            coinSymbol,
            status: "Active",
            "pendingRewards.grantedAt": next.grantedAt,
          },
          {
            $set: { startDate: start, endDate: end, plan: "Turbo Power" },
            $push: { rewardGrants: { ...next, appliedAt: now } },
            $pull: { pendingRewards: { grantedAt: next.grantedAt } },
          }
        );
        const modified =
          (res as any)?.modifiedCount ?? (res as any)?.nModified ?? 0;
        if (!modified)
          return { applied: false, reason: "race-lost-or-missing" };
        const updated = await this.findOne({
          email,
          coinSymbol,
          status: "Active",
        });
        await notificationService.sendPowerActivated(email, {
          powerName: updated?.plan ?? "Turbo Power",
        });
        return { applied: true, updated };
      }

      // Free or Electric → start fresh Turbo window from now
      const start = now;
      const end = addDaysUTC(endOfDayUTC(now), days);
      const res = await this.updatePart(
        {
          email,
          coinSymbol,
          status: "Active",
          "pendingRewards.grantedAt": next.grantedAt,
        },
        {
          $set: { plan: "Turbo Power", startDate: start, endDate: end },
          $push: { rewardGrants: { ...next, appliedAt: now } },
          $pull: { pendingRewards: { grantedAt: next.grantedAt } },
        }
      );
      const modified =
        (res as any)?.modifiedCount ?? (res as any)?.nModified ?? 0;
      if (!modified) return { applied: false, reason: "race-lost-or-missing" };
      const updated = await this.findOne({
        email,
        coinSymbol,
        status: "Active",
      });
      await notificationService.sendPowerActivated(email, {
        powerName: updated?.plan ?? "Turbo Power",
      });
      return { applied: true, updated };
    }

    // Normal Electric minutes: keep pending when Turbo/Nuclear
    if (!minutes) {
      await this.updatePart(
        {
          email,
          coinSymbol,
          status: "Active",
          "pendingRewards.grantedAt": next.grantedAt,
        },
        { $pull: { pendingRewards: { grantedAt: next.grantedAt } } }
      );
      return { applied: false, reason: "invalid-electric-minutes" };
    }
    if (isTurbo || isNuclear)
      return { applied: false, reason: "kept-pending-on-turbo-or-nuclear" };

    let start = now;
    let end = addMinutesUTC(now, minutes);
    if (isElectric && sub.endDate && new Date(sub.endDate) > now) {
      start = sub.startDate;
      end = addMinutesUTC(new Date(sub.endDate), minutes);
    }
    const res = await this.updatePart(
      {
        email,
        coinSymbol,
        status: "Active",
        "pendingRewards.grantedAt": next.grantedAt,
      },
      {
        $set: { plan: "Electric Power", startDate: start, endDate: end },
        $push: { rewardGrants: { ...next, appliedAt: now } },
        $pull: { pendingRewards: { grantedAt: next.grantedAt } },
      }
    );
    const modified =
      (res as any)?.modifiedCount ?? (res as any)?.nModified ?? 0;
    if (!modified) return { applied: false, reason: "race-lost-or-missing" };
    const updated = await this.findOne({ email, coinSymbol, status: "Active" });
    await notificationService.sendPowerActivated(email, {
      powerName: updated?.plan ?? "Electric Power",
    });
    return { applied: true, updated };
  }
}
