import { IModel } from "./base";

export type MarketingContactStatus =
  | "active"
  | "invalid"
  | "disposable"
  | "bounced"
  | "complained"
  | "blocklisted"
  | "unsubscribed";

/** SMTP verification lifecycle for a contact's slow-pass checks. */
export type SmtpVerificationStatus = "pending" | "verified" | "unknown" | "skipped";

/**
 * Per-contact send-safety signals. Nullable fields are "unknown" (not false).
 * isSpamtrap is ALWAYS null — not computable without a proprietary blocklist DB.
 * SMTP-dependent fields stay null until the async verification job fills them.
 */
export interface EmailValidation {
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
  isSpamtrap: null;
  isSafeToSend: boolean;
  notes: string[];
  /** Progress marker for the async SMTP pass. */
  smtpStatus: SmtpVerificationStatus;
  /** Id of the verification job that (last) enqueued this contact's SMTP pass. */
  smtpJobId?: string;
  checkedAt?: Date;
  smtpCheckedAt?: Date;
}

export type MarketingTemplateType = "marketing" | "transactional";
export type MarketingCampaignStatus =
  | "draft"
  | "sending"
  | "completed"
  | "partial"
  | "failed";
export type MarketingDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "skipped";

export interface MarketingContact extends IModel {
  email: string;
  emailLower: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  status: MarketingContactStatus;
  source?: string;
  lastError?: string;
  validation?: EmailValidation;
  unsubscribedAt?: Date;
  bouncedAt?: Date;
  complainedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingTemplate extends IModel {
  name: string;
  subject: string;
  bodyHtml: string;
  type: MarketingTemplateType;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingCampaignRecipient {
  email: string;
  emailLower: string;
  name?: string;
  status: MarketingDeliveryStatus;
  providerMessageId?: string;
  error?: string;
  sentAt?: Date;
  failedAt?: Date;
  bouncedAt?: Date;
  complainedAt?: Date;
}

export type MarketingVerificationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Tracks an async SMTP-verification run over a set of imported contacts.
 * Resumability is inherent: the worker re-selects contacts whose
 * validation.smtpStatus is still "pending" for this jobId, so an interrupted
 * run is picked up on the next sweep rather than restarted from scratch.
 */
export interface MarketingVerificationJob extends IModel {
  status: MarketingVerificationJobStatus;
  source?: string;
  total: number;
  processed: number;
  safe: number;
  deliverable: number;
  undeliverable: number;
  catchAll: number;
  unknown: number;
  mailFrom: string;
  domainConcurrency: number;
  domainDelayMs: number;
  createdBy?: string;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingCampaign extends IModel {
  name: string;
  templateId: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  status: MarketingCampaignStatus;
  recipients: MarketingCampaignRecipient[];
  stats: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    bounced: number;
    complained: number;
    skipped: number;
  };
  createdBy?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
