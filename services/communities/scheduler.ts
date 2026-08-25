import { communityDirectory } from "../communityDirectory.service";

/**
 * Module 3 — the scheduled-announcement sweep.
 *
 * A plain interval rather than a cron entry, because the Redis leader election
 * that guards the cron table is currently disabled and a scheduled announcement
 * must still go out. Running it in every process is safe: `markPublished`
 * flips the row with the status in the query, so exactly one sweep — in one
 * process — wins the right to fan out each announcement.
 *
 * Set `YAYS_COMMUNITY_SCHEDULER=off` to disable (tests, one-off scripts).
 */

const DEFAULT_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | null = null;

export const communitySchedulerIntervalMs = (): number => {
  const configured = Number(process.env.YAYS_COMMUNITY_SCHEDULER_MS);
  return Number.isFinite(configured) && configured >= 5_000
    ? configured
    : DEFAULT_INTERVAL_MS;
};

export const isCommunitySchedulerEnabled = (): boolean =>
  String(process.env.YAYS_COMMUNITY_SCHEDULER || "").toLowerCase() !== "off";

/** Idempotent: calling twice does not start two sweeps. */
export const startCommunityScheduler = (): boolean => {
  if (timer || !isCommunitySchedulerEnabled()) {
    return false;
  }
  timer = setInterval(() => {
    communityDirectory
      .publishDue()
      .then((published) => {
        if (published > 0) {
          console.log(`[m3/communities] published ${published} scheduled announcement(s)`);
        }
      })
      .catch((error) =>
        console.error("[m3/communities] scheduled announcement sweep", error)
      );
  }, communitySchedulerIntervalMs());
  // Never hold the process open just to run a sweep.
  timer.unref?.();
  return true;
};

export const stopCommunityScheduler = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
