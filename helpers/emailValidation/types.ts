/**
 * Shared types for the email send-safety validator.
 *
 * Ported from the reference Python implementation (email_validator.py). The
 * field set matches the CSV-import validation spec: every SMTP-dependent field
 * is nullable ("unknown") rather than defaulting to false, and is_spamtrap is
 * ALWAYS null — it cannot be computed without a proprietary spamtrap/blocklist
 * database (e.g. Spamhaus). Do not let downstream code treat null as false.
 */

export interface EmailValidationResult {
  email: string;
  isValidSyntax: boolean;
  isDisposable: boolean | null;
  isRoleAccount: boolean | null;
  isFreeEmail: boolean | null;
  mxRecords: string[];
  mxAcceptsMail: boolean | null;
  canConnectSmtp: boolean | null;
  isDeliverable: boolean | null;
  isCatchAll: boolean | null;
  hasInboxFull: boolean | null;
  isDisabled: boolean | null;
  isSpamtrap: null; // never computable — see module docstring
  isSafeToSend: boolean;
  notes: string[];
}

/** The subset of fields produced by the SMTP probe (the slow, port-25 pass). */
export interface SmtpProbeResult {
  canConnectSmtp: boolean | null;
  isDeliverable: boolean | null;
  isCatchAll: boolean | null;
  hasInboxFull: boolean | null;
  isDisabled: boolean | null;
  notes: string[];
}

export interface ValidateEmailOptions {
  /** MAIL FROM used for SMTP probing — MUST be a domain we control. */
  mailFrom?: string;
  /** Run the live SMTP probe (requires outbound port 25). Default false. */
  doSmtp?: boolean;
  smtpTimeoutMs?: number;
  dnsTimeoutMs?: number;
  extraDisposableDomains?: Set<string>;
  extraFreeDomains?: Set<string>;
  extraRoleLocalparts?: Set<string>;
  /** Per-domain SMTP throttler shared across a batch. */
  throttler?: import("./throttle").DomainThrottler;
}

/** Builds an all-unknown result for a given email (before any checks run). */
export const emptyResult = (email: string): EmailValidationResult => ({
  email,
  isValidSyntax: false,
  isDisposable: null,
  isRoleAccount: null,
  isFreeEmail: null,
  mxRecords: [],
  mxAcceptsMail: null,
  canConnectSmtp: null,
  isDeliverable: null,
  isCatchAll: null,
  hasInboxFull: null,
  isDisabled: null,
  isSpamtrap: null,
  isSafeToSend: false,
  notes: [],
});
