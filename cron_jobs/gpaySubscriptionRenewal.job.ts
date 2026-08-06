/**
 * Daily job: Check recent GPay mining subscriptions against Google Play.
 *
 * RTDN is the primary near-real-time source of truth. This cron remains as a
 * daily reconciliation backup for recent orders in case push delivery is
 * delayed or temporarily unavailable.
 */

import { RedisClientType } from "redis";
import { scheduleExactlyOnce, daySlot } from "../helpers/scheduleExactlyOnce";
import { OrderService } from "../services/order.service";
import {
  DEFAULT_GOOGLE_PLAY_PACKAGE_NAME,
  GooglePlaySubscriptionSyncService,
} from "../services/googlePlaySubscriptionSync.service";

const orderService = new OrderService();
const googlePlaySubscriptionSyncService = new GooglePlaySubscriptionSyncService();

const DAYS_LOOKBACK = 30;

export async function runGpaySubscriptionRenewalCheck() {
  console.log("🔄 [GpayRenewal] Starting Gpay subscription renewal check...");

  const cutoff = new Date(Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000);
  const gpayOrders = await (orderService as any).find({
    paymentType: "Gpay",
    orderType: "MiningSubscriptionOrder",
    googlePurchaseToken: { $exists: true, $ne: null },
    created: { $gte: cutoff },
  });

  if (!gpayOrders.length) {
    console.log("[GpayRenewal] No Gpay subscription orders found in last 30 days.");
    return;
  }

  console.log(`[GpayRenewal] Found ${gpayOrders.length} Gpay orders to check.`);

  let active = 0;
  let ending = 0;
  let inactive = 0;
  let ignored = 0;
  let errors = 0;

  for (const order of gpayOrders) {
    const purchaseToken = String(order?.googlePurchaseToken || "").trim();
    const packageName = String(
      order?.googlePackageName ||
        process.env.GOOGLE_PLAY_PACKAGE_NAME ||
        DEFAULT_GOOGLE_PLAY_PACKAGE_NAME
    ).trim();

    if (!purchaseToken || !packageName) {
      console.warn(
        `[GpayRenewal] Skipping order ${order?.orderId}: missing purchaseToken or packageName`
      );
      ignored++;
      continue;
    }

    try {
      const result = await googlePlaySubscriptionSyncService.syncSubscriptionByToken({
        packageName,
        purchaseToken,
        source: "cron",
      });

      if (result.action === "active") {
        console.log(
          `  ✅ Active: ${result.email || order?.user?.email || "unknown"} -> ${
            result.googleState || "unknown"
          }`
        );
        active++;
      } else if (result.action === "ending") {
        console.log(
          `  ⏳ Ending: ${result.email || order?.user?.email || "unknown"} -> access until ${
            result.endDate ? result.endDate.toISOString() : "unknown"
          }`
        );
        ending++;
      } else if (result.action === "inactive") {
        console.log(
          `  ❌ Inactive: ${result.email || order?.user?.email || "unknown"} -> ${
            result.googleState || "unknown"
          }`
        );
        inactive++;
      } else if (result.action === "not_found") {
        console.warn(
          `  ⚠️ Not found: ${order?.orderId || "unknown"} -> ${result.message}`
        );
        ignored++;
      } else {
        ignored++;
      }
    } catch (err: any) {
      console.error(
        `  ⚠️ Error processing order ${order?.orderId || "unknown"}:`,
        err?.message || err
      );
      errors++;
    }
  }

  console.log(
    `\n[GpayRenewal] Done — active: ${active}, ending: ${ending}, inactive: ${inactive}, ignored: ${ignored}, errors: ${errors}`
  );
}

export function setupGpaySubscriptionRenewalJob(redis: RedisClientType, tz: string) {
  scheduleExactlyOnce({
    cronExpr: "0 2 * * *", // daily at 2:00 AM
    jobName: "gpay_subscription_renewal",
    timezone: tz,
    redis,
    slotKeyFn: daySlot,
    lockTtlMs: 30 * 60_000, // 30 min lock
    run: runGpaySubscriptionRenewalCheck,
  });

  console.log("✅ [GpayRenewal] Gpay subscription renewal job registered (daily 2:00 AM)");
}
