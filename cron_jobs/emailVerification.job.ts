/**
 * Async SMTP email-verification worker (the slow, port-25 pass for CSV imports).
 *
 * Runs on the leader node every few minutes and drains any active verification
 * jobs in batches, throttled per destination domain. Resumability is inherent:
 * each sweep re-selects still-pending contacts, so an interrupted run continues
 * where it left off instead of restarting.
 *
 * SMTP probing needs outbound port 25 — gate it with MARKETING_EMAIL_VERIFY_SMTP
 * and only deploy the worker on a host that actually has port 25 egress.
 */

import { minuteSlot, scheduleExactlyOnce } from "../helpers/scheduleExactlyOnce";
import { MarketingEmailService } from "../services/marketingEmail.service";
import { keys } from "../config/keys";

const service = new MarketingEmailService();

// Give the sweep most of the interval, leaving headroom before the next tick.
const SWEEP_BUDGET_MS = 4 * 60 * 1000;

export async function runEmailVerificationSweep(): Promise<void> {
  if (!keys.marketingEmail.verifySmtpEnabled) return;
  const result = await service.runVerificationSweep(SWEEP_BUDGET_MS);
  if (result.jobs > 0) {
    console.log(
      `[email_verification_sweep] processed ${result.processed} address(es) across ${result.jobs} job(s)`
    );
  }
}

export const setupEmailVerificationJob = (redisClient: any, timezone = "Asia/Kolkata") => {
  if (!keys.marketingEmail.verifySmtpEnabled) {
    console.log("[email_verification_sweep] disabled (MARKETING_EMAIL_VERIFY_SMTP=false)");
    return;
  }
  scheduleExactlyOnce({
    cronExpr: "*/5 * * * *",
    jobName: "email_verification_sweep",
    timezone,
    redis: redisClient,
    slotKeyFn: minuteSlot,
    lockTtlMs: SWEEP_BUDGET_MS + 60 * 1000,
    run: () =>
      runEmailVerificationSweep().catch((err) =>
        console.error("[email_verification_sweep] failed:", err)
      ),
  });
};
