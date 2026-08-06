// utils/scheduleExactlyOnce.ts
import * as cron from "node-cron";
import os from "os";

type SlotKeyFn = (now: Date) => string;

export function scheduleExactlyOnce(opts: {
  cronExpr: string;
  jobName: string;              // e.g., "stopMiningAfter24Hours"
  timezone?: string;            // default "Asia/Kolkata"
  redis: any;                   // your connected redis client
  slotKeyFn: SlotKeyFn;         // minute/day/month/etc
  lockTtlMs: number;            // a bit > job’s worst-case runtime
  run: () => Promise<void>;
}) {
  const {
    cronExpr, jobName, timezone = "Asia/Kolkata",
    redis, slotKeyFn, lockTtlMs, run
  } = opts;

  cron.schedule(cronExpr, async () => {
    const now = new Date();
    const slotKey = `btcy:jobs:${jobName}:${slotKeyFn(now)}`;
    const meta = `${os.hostname()}:${process.pid}:${now.toISOString()}`;

    const ok = await redis.set(slotKey, meta, { NX: true, PX: lockTtlMs });
    if (!ok) return; // someone else already running this slot

    try {
      await run();
    } catch (e) {
      console.error(`[${jobName}] failed:`, e);
    }
  }, { timezone });
}

export const minuteSlot = (d: Date) =>
  d.toISOString().slice(0,16).replace(/[-:T]/g,""); // YYYYMMDDHHMM

export const daySlot = (d: Date) =>
  d.toISOString().slice(0,10).replace(/-/g,"");     // YYYYMMDD

export const monthSlot = (d: Date) =>
  d.toISOString().slice(0,7).replace(/-/g,"");      // YYYYMM

export const quarterSlot = (d: Date) => {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth()/3) + 1;
  return `${y}Q${q}`;
};

export const halfYearSlot = (d: Date) => {
  const y = d.getUTCFullYear();
  const h = d.getUTCMonth() < 6 ? 1 : 2;
  return `${y}H${h}`;
};
