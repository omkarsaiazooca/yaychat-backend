/**
 * Fast-pass validation rules (no SMTP): syntax, disposable/free/role
 * classification, and MX/DNS resolution. Faithful port of the reference
 * Python checks. None of these require outbound port 25, so they run
 * synchronously on CSV import.
 */

import { promises as dnsPromises } from "dns";
import {
  DEFAULT_DISPOSABLE_DOMAINS,
  DEFAULT_FREE_EMAIL_DOMAINS,
  DEFAULT_ROLE_ACCOUNT_LOCALPARTS,
} from "./lists";
import type { EmailValidationResult } from "./types";

// Simplified but reasonably strict RFC 5322 local-part/domain pattern
// (ported from the reference _EMAIL_RE).
// Group 1 = local part, group 2 = domain. (Positional groups, not named, to
// stay compatible with the project's ES2016 compile target.)
const EMAIL_RE =
  /^([A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

export interface SyntaxResult {
  isValid: boolean;
  local: string | null;
  domain: string | null;
}

/** Validate address format and split into local/domain. */
export function checkSyntax(email: string): SyntaxResult {
  if (!email || email.length > 254) return { isValid: false, local: null, domain: null };
  const match = EMAIL_RE.exec(email.trim());
  if (!match) return { isValid: false, local: null, domain: null };
  const local = match[1];
  const domain = match[2];
  if (local.length > 64 || local.includes("..") || domain.includes("..")) {
    return { isValid: false, local: null, domain: null };
  }
  return { isValid: true, local, domain };
}

export function checkDisposable(domain: string, extra?: Set<string>): boolean {
  const d = domain.toLowerCase();
  return DEFAULT_DISPOSABLE_DOMAINS.has(d) || (extra?.has(d) ?? false);
}

export function checkFreeEmail(domain: string, extra?: Set<string>): boolean {
  const d = domain.toLowerCase();
  return DEFAULT_FREE_EMAIL_DOMAINS.has(d) || (extra?.has(d) ?? false);
}

export function checkRoleAccount(local: string, extra?: Set<string>): boolean {
  const l = local.toLowerCase();
  return DEFAULT_ROLE_ACCOUNT_LOCALPARTS.has(l) || (extra?.has(l) ?? false);
}

/**
 * Resolve MX hosts (ranked by preference). Returns [] when the domain accepts
 * no mail, pushing an explanatory note. Handles the RFC 7505 "null MX" case
 * (a single `.`/empty exchange) and the RFC 5321 implicit-MX A-record fallback.
 */
export async function getMxRecords(
  domain: string,
  timeoutMs: number,
  notes: string[]
): Promise<string[]> {
  try {
    const answers = await withTimeout(dnsPromises.resolveMx(domain), timeoutMs);
    const ranked = [...answers].sort((a, b) => a.priority - b.priority);
    const hosts = ranked.map((r) => String(r.exchange).replace(/\.$/, ""));
    if (hosts.length === 1 && (hosts[0] === "" || hosts[0] === ".")) {
      // Null MX (RFC 7505): the domain explicitly declares it accepts no mail.
      notes.push(
        "Domain publishes a null MX record (RFC 7505): it explicitly declares that it does not accept email."
      );
      return [];
    }
    // Some resolvers report an empty exchange for a null MX; filter defensively.
    return hosts.filter((h) => h !== "" && h !== ".");
  } catch (err: any) {
    const code = err?.code;
    if (code === "ENOTFOUND") {
      notes.push("Domain does not exist (NXDOMAIN).");
      return [];
    }
    if (code === "ENODATA") {
      // No MX record — check for an A-record fallback (implicit MX, RFC 5321 §5.1).
      try {
        await withTimeout(dnsPromises.resolve4(domain), timeoutMs);
        notes.push(
          "No MX record; domain has an A record so mail may still be deliverable via implicit MX (RFC 5321)."
        );
        return [domain];
      } catch {
        notes.push("No MX record and no A record fallback found.");
        return [];
      }
    }
    notes.push(`DNS lookup failed: ${err?.message || err}`);
    return [];
  }
}

/**
 * Conservative rollup verdict. Hard failures: bad syntax, disposable, no
 * mail-accepting MX, explicit SMTP rejection, full inbox, or disabled account.
 * Role accounts and catch-all domains lower confidence but do not auto-fail.
 * (Mirrors compute_is_safe_to_send in the reference.)
 */
export function computeIsSafeToSend(r: EmailValidationResult): boolean {
  if (!r.isValidSyntax) return false;
  if (r.isDisposable) return false;
  if (r.mxAcceptsMail === false) return false;
  if (r.isDeliverable === false) return false;
  if (r.hasInboxFull === true) return false;
  if (r.isDisabled === true) return false;
  return true;
}

/** Rejects a promise if it does not settle within `ms` (DNS has its own timeouts too). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("DNS lookup timed out"), { code: "ETIMEOUT" })), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
