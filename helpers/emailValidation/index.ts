/**
 * Email send-safety validator — public entry point.
 *
 * validateEmail() runs the fast pass (syntax + disposable/free/role + MX) and,
 * when doSmtp is true and an MX exists, the slow SMTP probe. is_spamtrap is
 * always null (not computable without a proprietary blocklist DB — see types).
 *
 * Ported from the reference Python email_validator.py.
 */

import fs from "fs";
import {
  checkSyntax,
  checkDisposable,
  checkFreeEmail,
  checkRoleAccount,
  getMxRecords,
  computeIsSafeToSend,
} from "./rules";
import { smtpProbe } from "./smtp";
import { emptyResult } from "./types";
import type { EmailValidationResult, ValidateEmailOptions } from "./types";

export * from "./types";
export { DomainThrottler } from "./throttle";
export {
  checkSyntax,
  checkDisposable,
  checkFreeEmail,
  checkRoleAccount,
  getMxRecords,
  computeIsSafeToSend,
} from "./rules";

const SPAMTRAP_NOTE =
  "is_spamtrap cannot be determined by this tool (or any tool without access to a proprietary spamtrap/blocklist database such as Spamhaus). Always null.";

export async function validateEmail(
  email: string,
  options: ValidateEmailOptions = {}
): Promise<EmailValidationResult> {
  const r = emptyResult(email);

  const { isValid, local, domain } = checkSyntax(email);
  r.isValidSyntax = isValid;
  if (!isValid || !local || !domain) {
    r.notes.push("Failed syntax validation; skipped all downstream checks.");
    r.isSafeToSend = false;
    return r;
  }

  r.isDisposable = checkDisposable(domain, options.extraDisposableDomains);
  r.isFreeEmail = checkFreeEmail(domain, options.extraFreeDomains);
  r.isRoleAccount = checkRoleAccount(local, options.extraRoleLocalparts);

  const mxHosts = await getMxRecords(domain, options.dnsTimeoutMs ?? 5000, r.notes);
  r.mxRecords = mxHosts;
  r.mxAcceptsMail = mxHosts.length > 0;

  r.notes.push(SPAMTRAP_NOTE);

  if (options.doSmtp && r.mxAcceptsMail) {
    const probe = await smtpProbe(domain, mxHosts, email, {
      mailFrom: options.mailFrom,
      timeoutMs: options.smtpTimeoutMs,
      throttler: options.throttler,
    });
    r.canConnectSmtp = probe.canConnectSmtp;
    r.isDeliverable = probe.isDeliverable;
    r.isCatchAll = probe.isCatchAll;
    r.hasInboxFull = probe.hasInboxFull;
    r.isDisabled = probe.isDisabled;
    r.notes.push(...probe.notes);
  } else if (!options.doSmtp) {
    r.notes.push(
      "SMTP probing disabled; can_connect_smtp/is_deliverable/is_catch_all/has_inbox_full/is_disabled left as unknown."
    );
  }

  r.isSafeToSend = computeIsSafeToSend(r);
  return r;
}

/**
 * Load a newline-separated domain/localpart list file (lines starting with # are comments).
 *
 * An unreadable path is not fatal — validation still runs on the built-in lists —
 * but it is logged loudly rather than swallowed: a typo'd path would otherwise
 * silently degrade every import to the small built-in set with no outward signal.
 */
export function loadDomainListFile(path: string): Set<string> {
  const out = new Set<string>();
  try {
    const text = fs.readFileSync(path, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim().toLowerCase();
      if (line && !line.startsWith("#")) out.add(line);
    }
    console.log(`[emailValidation] loaded ${out.size} extra domain(s) from ${path}`);
  } catch (err: any) {
    console.warn(
      `[emailValidation] could not read domain list at "${path}" (${err?.code || err?.message}); ` +
        "falling back to the built-in list only."
    );
  }
  return out;
}
