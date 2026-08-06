import Queue1, { Queue } from "bull";
import { createClient } from "redis";

const REDIS_HOST =
  process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT || 11678);
const REDIS_PASSWORD =
  process.env.REDIS_PASSWORD;

const redisClient = createClient({
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
});

redisClient.on("error", (err) =>
  console.error("[mining-stop] redis error:", err)
);

async function ensureRedisConnected() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export const miningStopQueue: Queue = new Queue1("mining-stop", {
  redis: {
    port: REDIS_PORT,
    host: REDIS_HOST,
    password: REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 1000 },
  },
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule a per-user stop check at +6h from cycleStart.
 * Safe to call from API handlers; uses Redis NX to dedupe per cycle.
 */
export async function scheduleMiningStop(
  email: string,
  coin: string,
  cycleStartISO: string
) {
  const lowerEmail = String(email).toLowerCase();
  const cycleStart = new Date(cycleStartISO);
  if (!lowerEmail || !coin || !cycleStartISO || Number.isNaN(cycleStart.getTime())) return;

  await ensureRedisConnected();

  const jobKey = `btcy:mining:job:${coin}:${lowerEmail}:${cycleStart.toISOString()}`;

  const ok = await redisClient.set(jobKey, "1", {
    NX: true,
    PX: ONE_DAY_MS + 6 * 60 * 60 * 1000,
  });
  if (!ok) return; // already scheduled for this cycle

  const firstDelay = Math.max(
    0,
    6 * 60 * 60 * 1000 - (Date.now() - cycleStart.getTime())
  );

  await miningStopQueue.add(
    { email: lowerEmail, coin, cycleStart: cycleStart.toISOString(), step: "6h_check" },
    {
      delay: firstDelay,
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
    }
  );

  console.log(
    `[mining-stop] scheduled 6h check for ${lowerEmail} ${coin} in ${Math.round(
      firstDelay / 1000
    )}s`
  );
}
