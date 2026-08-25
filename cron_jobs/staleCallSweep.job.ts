/**
 * Close out calls whose ring expired with no outcome.
 *
 * The signaling layer sets an in-process timer per ring, which is enough for
 * the common case. It is not enough when the worker holding that timer dies —
 * a PM2 restart, a deploy, an OOM — because the timer dies with it and the
 * call row stays `ringing` forever. A user with a stuck `ringing` row is
 * treated as *busy*: every subsequent call to them is rejected, and nothing in
 * the app can clear it. That is a silent, permanent loss of the feature for
 * that account, which is why the sweep is a scheduled job rather than another
 * in-process fallback.
 *
 * Runs on the leader only (`scheduleExactlyOnce`) so a cluster does not settle
 * the same call from several workers.
 */
import { minuteSlot, scheduleExactlyOnce } from "../helpers/scheduleExactlyOnce";
import { ChatSocketService } from "../services/chatWebsocket.service";
import { yaysCalls } from "../services/yaysCall.service";

export async function runStaleCallSweep(): Promise<void> {
  const settled = await yaysCalls.expireStaleRings();
  if (!settled.length) {
    return;
  }

  // Tell both ends, so a client that survived the worker restart stops showing
  // a call that the server has already given up on.
  const io = ChatSocketService.getIO();
  if (io) {
    for (const call of settled) {
      const event = { callId: call.callId, status: call.status, reason: call.endReason };
      io.to(`user:${call.callerLower}`).emit("call:ended", event);
      io.to(`user:${call.calleeLower}`).emit("call:ended", event);
    }
  }

  console.log(`[yays_stale_call_sweep] closed ${settled.length} abandoned ring(s)`);
}

export const setupStaleCallSweepJob = (redisClient: any, timezone = "Asia/Kolkata") => {
  scheduleExactlyOnce({
    cronExpr: "* * * * *",
    jobName: "yays_stale_call_sweep",
    timezone,
    redis: redisClient,
    slotKeyFn: minuteSlot,
    lockTtlMs: 50_000,
    run: () =>
      runStaleCallSweep().catch((err) =>
        console.error("[yays_stale_call_sweep] failed:", err)
      ),
  });
};
