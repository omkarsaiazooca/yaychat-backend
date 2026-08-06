// src/cache/subscriptionPlansCache.ts
import type { RedisClientType } from "redis";
import { getRedis, getJSON, setJSON, delKey } from "./redis";
import { SubscriptionPlansService } from "../services/miningSubscriptionPlan.service";

type Plan = { name: string; miningRate: number; speedBoost: number };
type PlansByName = Record<string, Plan>;

const CACHE_KEY = "subscriptionPlans:v1";   // bump suffix to force invalidate
const LOCK_KEY  = "subscriptionPlans:lock";
const TTL_SEC   = 7 * 24 * 60 * 60;         // 7 days

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getSubscriptionPlansCached(
  svc: SubscriptionPlansService,
  redis: RedisClientType = getRedis()
): Promise<PlansByName> {
  // 1) read
  const cached = await getJSON<PlansByName>(CACHE_KEY);
  if (cached) return cached;

  // 2) stampede lock: only one refresher does the DB call
  const gotLock = await redis.set(LOCK_KEY, "1", { NX: true, EX: 30 });
  if (!gotLock) {
    await sleep(300);
    const secondTry = await getJSON<PlansByName>(CACHE_KEY);
    if (secondTry) return secondTry;
    // fallthrough: last-resort fetch
  }

  try {
    const plans: any[] = await svc.find({}); // your existing call
    const byName: PlansByName = Object.fromEntries(
      plans.map((p) => [p.name, { name: p.name, miningRate: p.miningRate, speedBoost: p.speedBoost }])
    );

    // 3) save
    await setJSON(CACHE_KEY, byName, TTL_SEC);
    return byName;
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
}

export async function invalidateSubscriptionPlansCache(): Promise<void> {
  await delKey(CACHE_KEY);
}
