import {
  SendEmailCommand,
  SESClient,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { keys } from "../config/keys";
import mongo from "../db/connection";
import {
  MarketingCampaign,
  MarketingCampaignRecipient,
  MarketingContact,
  MarketingContactStatus,
  MarketingTemplate,
  MarketingTemplateType,
} from "../data/marketingEmail";
import {
  MarketingCampaignDocument,
  MarketingCampaignSchema,
  MarketingContactDocument,
  MarketingContactSchema,
  MarketingTemplateDocument,
  MarketingTemplateSchema,
  MarketingVerificationJobDocument,
  MarketingVerificationJobSchema,
} from "../models/marketingEmail";
import { EmailValidation, MarketingVerificationJob } from "../data/marketingEmail";
import {
  validateEmail,
  loadDomainListFile,
  DomainThrottler,
  EmailValidationResult,
  checkSyntax,
  checkDisposable,
  checkFreeEmail,
  checkRoleAccount,
  getMxRecords,
  computeIsSafeToSend,
} from "../helpers/emailValidation";
import { emptyResult } from "../helpers/emailValidation/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com",
]);
const SUPPRESSED_STATUSES: MarketingContactStatus[] = [
  "invalid",
  "disposable",
  "bounced",
  "complained",
  "blocklisted",
  "unsubscribed",
];
const CONTACT_STATUSES = new Set<MarketingContactStatus>([
  "active",
  "invalid",
  "disposable",
  "bounced",
  "complained",
  "blocklisted",
  "unsubscribed",
]);

const normalizeEmail = (value: any) => String(value || "").trim().toLowerCase();
const normalizeTags = (tags: any) =>
  Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => String(tag || "").trim()).filter(Boolean)))
    : [];

const contactModel = mongo.primary.model<MarketingContactDocument>(
  "marketingEmailContact",
  MarketingContactSchema,
  "marketingEmailContact"
);
const templateModel = mongo.primary.model<MarketingTemplateDocument>(
  "marketingEmailTemplate",
  MarketingTemplateSchema,
  "marketingEmailTemplate"
);
const campaignModel = mongo.primary.model<MarketingCampaignDocument>(
  "marketingEmailCampaign",
  MarketingCampaignSchema,
  "marketingEmailCampaign"
);
const verificationJobModel = mongo.primary.model<MarketingVerificationJobDocument>(
  "marketingEmailVerificationJob",
  MarketingVerificationJobSchema,
  "marketingEmailVerificationJob"
);

// Larger, maintained disposable-domain list (optional) — loaded once at startup.
const EXTRA_DISPOSABLE_DOMAINS = keys.marketingEmail.verifyDisposableListPath
  ? loadDomainListFile(keys.marketingEmail.verifyDisposableListPath)
  : undefined;

/** Map an EmailValidationResult into the persisted EmailValidation sub-doc. */
const toValidationDoc = (
  r: EmailValidationResult,
  smtpEligible: boolean,
  smtpEnabled: boolean,
  now: Date
): EmailValidation => ({
  isValidSyntax: r.isValidSyntax,
  isDisposable: r.isDisposable,
  isRoleAccount: r.isRoleAccount,
  isFreeEmail: r.isFreeEmail,
  mxRecords: r.mxRecords,
  mxAcceptsMail: r.mxAcceptsMail,
  canConnectSmtp: r.canConnectSmtp,
  isDeliverable: r.isDeliverable,
  isCatchAll: r.isCatchAll,
  hasInboxFull: r.hasInboxFull,
  isDisabled: r.isDisabled,
  isSpamtrap: null,
  isSafeToSend: r.isSafeToSend,
  notes: r.notes,
  // Only addresses worth probing are queued for the SMTP pass; the rest are
  // "skipped" (already failed fast-pass) so they aren't picked up by the worker.
  smtpStatus: smtpEnabled && smtpEligible ? "pending" : "skipped",
  checkedAt: now,
});

/** Derive a contact status from fast-pass validation signals. */
const statusFromValidation = (r: EmailValidationResult): MarketingContactStatus => {
  if (!r.isValidSyntax) return "invalid";
  if (r.isDisposable) return "disposable";
  if (r.mxAcceptsMail === false) return "invalid";
  return "active";
};

/** Run `worker` over `items` with at most `concurrency` in flight at once. */
async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const limit = Math.max(1, concurrency);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

export class MarketingEmailService {
  private ses = new SESClient({
    region: keys.marketingEmail.awsSesRegion,
    credentials:
      keys.marketingEmail.awsAccessKeyId && keys.marketingEmail.awsSecretAccessKey
        ? {
            accessKeyId: keys.marketingEmail.awsAccessKeyId,
            secretAccessKey: keys.marketingEmail.awsSecretAccessKey,
          }
        : undefined,
  });

  /**
   * Fast pass (synchronous, runs on import): syntax + disposable/free/role +
   * MX for every address. No SMTP — so it's safe to await inline. Persists a
   * full `validation` sub-doc per contact (the "why", not just pass/fail) and
   * marks send-eligible addresses smtpStatus:"pending" for the async worker.
   *
   * DNS is deduped per-domain so large lists (which share gmail.com/outlook.com
   * heavily) stay fast — MX/classification is resolved once per unique domain.
   */
  async upsertContacts(input: {
    contacts: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      tags?: string[];
    }>;
    source?: string;
  }) {
    const now = new Date();
    const smtpEnabled = keys.marketingEmail.verifySmtpEnabled;
    const seen = new Set<string>();
    const counts = {
      imported: 0,
      updated: 0,
      duplicate: 0,
      invalid: 0,
      disposable: 0,
      roleAccount: 0,
      freeEmail: 0,
      noMx: 0,
      queuedForSmtp: 0,
      total: 0,
      // Lets the UI distinguish "nothing qualified" from "SMTP checks are off
      // on this server" (e.g. no outbound port 25) — they look identical otherwise.
      smtpEnabled,
    };

    // Per-domain memo: MX + domain-level classification resolved once per domain.
    const domainCache = new Map<
      string,
      {
        mxRecords: string[];
        mxAcceptsMail: boolean;
        isDisposable: boolean;
        isFreeEmail: boolean;
        notes: string[];
      }
    >();

    const resolveDomain = async (domain: string) => {
      const cached = domainCache.get(domain);
      if (cached) return cached;
      const notes: string[] = [];
      const mxRecords = await getMxRecords(domain, 5000, notes);
      const entry = {
        mxRecords,
        mxAcceptsMail: mxRecords.length > 0,
        isDisposable: checkDisposable(domain, EXTRA_DISPOSABLE_DOMAINS),
        isFreeEmail: checkFreeEmail(domain),
        notes,
      };
      domainCache.set(domain, entry);
      return entry;
    };

    for (const raw of input.contacts || []) {
      counts.total += 1;
      const emailLower = normalizeEmail(raw.email);
      const { isValid, local, domain } = checkSyntax(emailLower);

      if (!isValid || !local || !domain) {
        counts.invalid += 1;
        // Still record invalid contacts so the team can review flagged rows.
        const r = emptyResult(emailLower || String(raw.email || ""));
        r.isValidSyntax = false;
        r.notes.push("Failed syntax validation; skipped all downstream checks.");
        await this.writeContact(raw, emailLower || normalizeEmail(raw.email), r, false, smtpEnabled, "invalid", now, input.source, counts, seen);
        continue;
      }
      if (seen.has(emailLower)) {
        counts.duplicate += 1;
        continue;
      }

      const dom = await resolveDomain(domain);
      const r = emptyResult(emailLower);
      r.isValidSyntax = true;
      r.isDisposable = dom.isDisposable;
      r.isFreeEmail = dom.isFreeEmail;
      r.isRoleAccount = checkRoleAccount(local);
      r.mxRecords = dom.mxRecords;
      r.mxAcceptsMail = dom.mxAcceptsMail;
      r.notes.push(...dom.notes);
      r.notes.push(
        "is_spamtrap cannot be determined without a proprietary spamtrap/blocklist database (e.g. Spamhaus). Always null."
      );
      r.isSafeToSend = computeIsSafeToSend(r);

      if (r.isDisposable) counts.disposable += 1;
      if (r.isRoleAccount) counts.roleAccount += 1;
      if (r.isFreeEmail) counts.freeEmail += 1;
      if (r.mxAcceptsMail === false) counts.noMx += 1;

      // Only probe addresses that survived the fast pass (valid, not disposable,
      // MX accepts mail). This is the two-pass fast-filter-then-verify workflow.
      const smtpEligible = r.isValidSyntax && !r.isDisposable && r.mxAcceptsMail === true;
      if (smtpEnabled && smtpEligible) counts.queuedForSmtp += 1;

      await this.writeContact(
        raw,
        emailLower,
        r,
        smtpEligible,
        smtpEnabled,
        statusFromValidation(r),
        now,
        input.source,
        counts,
        seen
      );
    }

    return counts;
  }

  /** Upsert a single contact with its validation sub-doc; updates imported/updated counts. */
  private async writeContact(
    raw: { email: string; firstName?: string; lastName?: string; tags?: string[] },
    emailLower: string,
    r: EmailValidationResult,
    smtpEligible: boolean,
    smtpEnabled: boolean,
    status: MarketingContactStatus,
    now: Date,
    source: string | undefined,
    counts: { imported: number; updated: number },
    seen: Set<string>
  ) {
    if (!emailLower) return;
    seen.add(emailLower);
    const validation = toValidationDoc(r, smtpEligible, smtpEnabled, now);
    const lastError = !r.isValidSyntax
      ? "Invalid email syntax"
      : r.isDisposable
      ? "Disposable email provider"
      : r.mxAcceptsMail === false
      ? "Domain does not accept mail (no valid MX)"
      : "";

    const update = {
      $set: {
        email: String(raw.email).trim(),
        emailLower,
        firstName: String(raw.firstName || "").trim(),
        lastName: String(raw.lastName || "").trim(),
        tags: normalizeTags(raw.tags),
        source: String(source || "manual").trim(),
        status,
        lastError,
        validation,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    };

    const result = await contactModel.updateOne({ emailLower }, update, { upsert: true });
    if (result.upsertedCount) counts.imported += 1;
    else counts.updated += 1;
  }

  // ----------------------------------------------------------------------
  // Async SMTP verification (the slow, port-25 pass)
  // ----------------------------------------------------------------------

  /**
   * Create a verification job and claim the eligible pending contacts for it.
   * Eligible = fast-pass marked smtpStatus:"pending" and not already owned by
   * another job. The worker (runVerificationSweep) then drains it in batches.
   */
  async startSmtpVerification(input: {
    source?: string;
    contactIds?: string[];
    createdBy?: string;
  }) {
    if (!keys.marketingEmail.verifySmtpEnabled) {
      throw new Error("SMTP verification is disabled (MARKETING_EMAIL_VERIFY_SMTP=false).");
    }
    const job = await verificationJobModel.create({
      status: "queued",
      source: input.source,
      mailFrom: keys.marketingEmail.verifyMailFrom,
      domainConcurrency: keys.marketingEmail.verifyDomainConcurrency,
      domainDelayMs: keys.marketingEmail.verifyDomainDelayMs,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const filter: any = {
      "validation.smtpStatus": "pending",
      $or: [{ "validation.smtpJobId": { $exists: false } }, { "validation.smtpJobId": null }],
    };
    if (input.source) filter.source = input.source;
    if (Array.isArray(input.contactIds) && input.contactIds.length) {
      filter._id = { $in: input.contactIds };
    }

    const claimed = await contactModel.updateMany(filter, {
      $set: { "validation.smtpJobId": String(job._id), updatedAt: new Date() },
    });

    const total = claimed.modifiedCount || 0;
    await verificationJobModel.updateOne(
      { _id: job._id },
      { $set: { total, updatedAt: new Date() } }
    );

    return { ...job.toObject(), total };
  }

  async getVerificationJob(jobId: string) {
    const job = await verificationJobModel.findById(jobId).lean();
    if (!job) throw new Error("Verification job not found.");
    const remaining = await contactModel.countDocuments({
      "validation.smtpJobId": jobId,
      "validation.smtpStatus": "pending",
    });
    return { ...job, remaining };
  }

  async listVerificationJobs(limit = 20) {
    return verificationJobModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit || 20), 100))
      .lean();
  }

  async cancelVerificationJob(jobId: string) {
    const job = await verificationJobModel.findById(jobId);
    if (!job) throw new Error("Verification job not found.");
    if (["completed", "failed", "cancelled"].includes(job.status)) return job.toObject();
    job.status = "cancelled";
    job.completedAt = new Date();
    job.updatedAt = new Date();
    await job.save();
    // Release still-pending contacts so they're no longer probed.
    await contactModel.updateMany(
      { "validation.smtpJobId": jobId, "validation.smtpStatus": "pending" },
      { $set: { "validation.smtpStatus": "skipped", updatedAt: new Date() } }
    );
    return job.toObject();
  }

  /**
   * Process a single batch of pending contacts for a job. Returns whether the
   * job still has pending work. Safe to call repeatedly (resumable): each call
   * only claims the next `batchSize` still-pending contacts, so an interrupted
   * run is picked up exactly where it left off.
   */
  async processVerificationBatch(jobId: string): Promise<{ done: boolean; processed: number }> {
    const job = await verificationJobModel.findById(jobId);
    if (!job || ["completed", "failed", "cancelled"].includes(job.status)) {
      return { done: true, processed: 0 };
    }
    if (job.status === "queued") {
      job.status = "running";
      job.startedAt = job.startedAt || new Date();
      await job.save();
    }

    const batch = await contactModel
      .find({ "validation.smtpJobId": jobId, "validation.smtpStatus": "pending" })
      .limit(keys.marketingEmail.verifyBatchSize)
      .lean();

    if (!batch.length) {
      job.status = "completed";
      job.completedAt = new Date();
      job.updatedAt = new Date();
      await job.save();
      return { done: true, processed: 0 };
    }

    const throttler = new DomainThrottler(job.domainConcurrency, job.domainDelayMs);
    const inc = { processed: 0, safe: 0, deliverable: 0, undeliverable: 0, catchAll: 0, unknown: 0 };

    await mapWithConcurrency(
      batch,
      keys.marketingEmail.verifyWorkerConcurrency,
      async (contact) => {
        try {
          const r = await validateEmail(contact.email, {
            doSmtp: true,
            mailFrom: job.mailFrom,
            throttler,
            smtpTimeoutMs: keys.marketingEmail.verifySmtpTimeoutMs,
            extraDisposableDomains: EXTRA_DISPOSABLE_DOMAINS,
          });
          await this.applySmtpResult(String(contact._id), contact.validation, r);
          inc.processed += 1;
          if (r.isSafeToSend) inc.safe += 1;
          if (r.isDeliverable === true) inc.deliverable += 1;
          if (r.isDeliverable === false) inc.undeliverable += 1;
          if (r.isCatchAll === true) inc.catchAll += 1;
          if (r.canConnectSmtp === null) inc.unknown += 1;
        } catch (err: any) {
          // Never leave a contact stuck "pending" — mark unknown and move on.
          await contactModel.updateOne(
            { _id: contact._id },
            {
              $set: {
                "validation.smtpStatus": "unknown",
                "validation.smtpCheckedAt": new Date(),
                updatedAt: new Date(),
              },
              $push: { "validation.notes": `SMTP verification error: ${err?.message || err}` },
            }
          );
          inc.processed += 1;
          inc.unknown += 1;
        }
      }
    );

    await verificationJobModel.updateOne(
      { _id: jobId },
      {
        $inc: {
          processed: inc.processed,
          safe: inc.safe,
          deliverable: inc.deliverable,
          undeliverable: inc.undeliverable,
          catchAll: inc.catchAll,
          unknown: inc.unknown,
        },
        $set: { updatedAt: new Date() },
      }
    );

    const remaining = await contactModel.countDocuments({
      "validation.smtpJobId": jobId,
      "validation.smtpStatus": "pending",
    });
    if (remaining === 0) {
      await verificationJobModel.updateOne(
        { _id: jobId },
        { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date() } }
      );
      return { done: true, processed: inc.processed };
    }
    return { done: false, processed: inc.processed };
  }

  /** Merge SMTP-pass results into an existing contact's validation sub-doc. */
  private async applySmtpResult(
    contactId: string,
    existing: EmailValidation | undefined,
    r: EmailValidationResult
  ) {
    const merged: EmailValidationResult = {
      ...r,
      // Preserve fast-pass classification already stored on the contact.
      isRoleAccount: existing?.isRoleAccount ?? r.isRoleAccount,
      isFreeEmail: existing?.isFreeEmail ?? r.isFreeEmail,
    };
    const smtpStatus = r.canConnectSmtp === null ? "unknown" : "verified";
    const status: MarketingContactStatus =
      r.isDeliverable === false || r.hasInboxFull === true || r.isDisabled === true
        ? "bounced"
        : existing && !existing.isSafeToSend && !r.isSafeToSend
        ? "invalid"
        : "active";

    await contactModel.updateOne(
      { _id: contactId },
      {
        $set: {
          "validation.canConnectSmtp": merged.canConnectSmtp,
          "validation.isDeliverable": merged.isDeliverable,
          "validation.isCatchAll": merged.isCatchAll,
          "validation.hasInboxFull": merged.hasInboxFull,
          "validation.isDisabled": merged.isDisabled,
          "validation.isSafeToSend": merged.isSafeToSend,
          "validation.notes": merged.notes,
          "validation.smtpStatus": smtpStatus,
          "validation.smtpCheckedAt": new Date(),
          status,
          lastError:
            r.isDeliverable === false
              ? "SMTP rejected recipient (undeliverable)"
              : r.hasInboxFull === true
              ? "Mailbox full / over quota"
              : r.isDisabled === true
              ? "Mailbox disabled / suspended"
              : "",
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Worker entry point (called by the cron sweep). Drains active jobs in
   * batches up to a wall-clock budget so no single invocation blocks forever.
   */
  async runVerificationSweep(maxMs = 4 * 60 * 1000): Promise<{ processed: number; jobs: number }> {
    if (!keys.marketingEmail.verifySmtpEnabled) return { processed: 0, jobs: 0 };
    const deadline = Date.now() + maxMs;
    let processed = 0;
    let jobsTouched = 0;

    while (Date.now() < deadline) {
      const job = await verificationJobModel
        .findOne({ status: { $in: ["queued", "running"] } })
        .sort({ createdAt: 1 })
        .lean();
      if (!job) break;
      jobsTouched += 1;

      let done = false;
      while (!done && Date.now() < deadline) {
        const res = await this.processVerificationBatch(String(job._id));
        processed += res.processed;
        done = res.done;
      }
    }
    return { processed, jobs: jobsTouched };
  }

  async listContacts(params: { status?: string; search?: string; limit?: number }) {
    const cond: any = {};
    if (params.status) cond.status = params.status;
    if (params.search) {
      const rx = new RegExp(String(params.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      cond.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];
    }
    return contactModel
      .find(cond)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(params.limit || 100), 500))
      .lean();
  }

  async createContact(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    tags?: string[];
    status?: MarketingContactStatus;
  }) {
    const emailLower = normalizeEmail(input.email);
    if (!emailLower || !EMAIL_REGEX.test(emailLower)) {
      throw new Error("A valid contact email is required.");
    }
    if (await contactModel.exists({ emailLower })) {
      throw new Error("A contact with this email already exists.");
    }
    const status = input.status || "active";
    if (!CONTACT_STATUSES.has(status)) throw new Error("Invalid contact status.");
    const now = new Date();
    return contactModel.create({
      email: String(input.email).trim(),
      emailLower,
      firstName: String(input.firstName || "").trim(),
      lastName: String(input.lastName || "").trim(),
      tags: normalizeTags(input.tags),
      status,
      source: "manual",
      lastError: status === "blocklisted" ? "Admin blocklist" : "",
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateContact(
    id: string,
    input: {
      email?: string;
      firstName?: string;
      lastName?: string;
      tags?: string[];
      status?: MarketingContactStatus;
    }
  ) {
    const update: any = { updatedAt: new Date() };
    if (input.email !== undefined) {
      const emailLower = normalizeEmail(input.email);
      if (!emailLower || !EMAIL_REGEX.test(emailLower)) {
        throw new Error("A valid contact email is required.");
      }
      const duplicate = await contactModel.exists({ emailLower, _id: { $ne: id } });
      if (duplicate) throw new Error("A contact with this email already exists.");
      update.email = String(input.email).trim();
      update.emailLower = emailLower;
    }
    if (input.firstName !== undefined) update.firstName = String(input.firstName).trim();
    if (input.lastName !== undefined) update.lastName = String(input.lastName).trim();
    if (input.tags !== undefined) update.tags = normalizeTags(input.tags);
    if (input.status !== undefined) {
      if (!CONTACT_STATUSES.has(input.status)) throw new Error("Invalid contact status.");
      update.status = input.status;
      update.lastError = input.status === "blocklisted" ? "Admin blocklist" : "";
    }
    const contact = await contactModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!contact) throw new Error("Contact not found.");
    return contact;
  }

  async bulkUpdateContacts(input: {
    contactIds: string[];
    status?: MarketingContactStatus;
    addTags?: string[];
  }) {
    const contactIds = Array.isArray(input.contactIds) ? input.contactIds.filter(Boolean) : [];
    if (!contactIds.length) throw new Error("Select at least one contact.");
    if (contactIds.length > 5000) throw new Error("Bulk actions are limited to 5,000 contacts.");
    if (input.status && !CONTACT_STATUSES.has(input.status)) {
      throw new Error("Invalid contact status.");
    }
    const update: any = { $set: { updatedAt: new Date() } };
    if (input.status) {
      update.$set.status = input.status;
      update.$set.lastError = input.status === "blocklisted" ? "Admin blocklist" : "";
    }
    const tags = normalizeTags(input.addTags);
    if (tags.length) update.$addToSet = { tags: { $each: tags } };
    if (!input.status && !tags.length) throw new Error("No contact changes were provided.");
    const result = await contactModel.updateMany({ _id: { $in: contactIds } }, update);
    return { matched: result.matchedCount, updated: result.modifiedCount };
  }

  async deleteContacts(contactIdsInput: string[]) {
    const contactIds = Array.isArray(contactIdsInput) ? contactIdsInput.filter(Boolean) : [];
    if (!contactIds.length) throw new Error("Select at least one contact.");
    if (contactIds.length > 5000) throw new Error("Bulk actions are limited to 5,000 contacts.");
    const result = await contactModel.deleteMany({ _id: { $in: contactIds } });
    return { deleted: result.deletedCount || 0 };
  }

  async createTemplate(input: {
    name: string;
    subject: string;
    bodyHtml: string;
    type?: MarketingTemplateType;
    createdBy?: string;
  }) {
    const type = input.type || "marketing";
    if (!input.name || !input.subject || !input.bodyHtml) {
      throw new Error("Template name, subject, and HTML body are required.");
    }

    const bodyHtml =
      type === "marketing" && !input.bodyHtml.includes("{{unsubscribeUrl}}")
        ? `${input.bodyHtml}<p style="font-size:12px;color:#777;margin-top:24px;">No longer want these emails? <a href="{{unsubscribeUrl}}">Unsubscribe</a>.</p>`
        : input.bodyHtml;

    return templateModel.create({
      name: input.name.trim(),
      subject: input.subject.trim(),
      bodyHtml,
      type,
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async listTemplates() {
    return templateModel.find({}).sort({ createdAt: -1 }).lean();
  }

  async deleteTemplate(id: string) {
    const usedByCampaign = await campaignModel.exists({ templateId: id });
    if (usedByCampaign) {
      throw new Error("This template is used by a campaign and cannot be deleted.");
    }
    const template = await templateModel.findByIdAndDelete(id).lean();
    if (!template) throw new Error("Template not found.");
    return { deleted: true, templateId: id, name: template.name };
  }

  async createCampaign(input: {
    name: string;
    templateId: string;
    fromEmail?: string;
    fromName?: string;
    subject?: string;
    contactIds?: string[];
    emails?: string[];
    createdBy?: string;
  }) {
    const template = await templateModel.findById(input.templateId).lean();
    if (!template) throw new Error("Template not found.");

    const contactCond: any = { status: "active" };
    if (Array.isArray(input.contactIds) && input.contactIds.length) {
      contactCond._id = { $in: input.contactIds };
    } else if (Array.isArray(input.emails) && input.emails.length) {
      contactCond.emailLower = { $in: input.emails.map(normalizeEmail).filter(Boolean) };
    }

    const contacts = await contactModel.find(contactCond).limit(50000).lean();
    const deduped = new Map<string, any>();
    contacts.forEach((contact) => deduped.set(contact.emailLower, contact));
    if (!deduped.size) throw new Error("No active contacts found for this campaign.");

    const recipients: MarketingCampaignRecipient[] = Array.from(deduped.values()).map(
      (contact) => ({
        email: contact.email,
        emailLower: contact.emailLower,
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        status: "pending",
      })
    );

    return campaignModel.create({
      name: input.name.trim(),
      templateId: String((template as any)._id),
      subject: (input.subject || template.subject).trim(),
      fromEmail: normalizeEmail(input.fromEmail || keys.marketingEmail.awsSesFromEmail),
      fromName: input.fromName || keys.marketingEmail.awsSesFromName,
      status: "draft",
      recipients,
      stats: this.calculateStats(recipients),
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async listCampaigns() {
    return campaignModel.find({}).sort({ createdAt: -1 }).limit(100).lean();
  }

  async getCampaign(id: string) {
    return campaignModel.findById(id).lean();
  }

  async sendCampaign(id: string, limit = 100) {
    const campaign = await campaignModel.findById(id);
    if (!campaign) throw new Error("Campaign not found.");
    const template = await templateModel.findById(campaign.templateId).lean();
    if (!template) throw new Error("Template not found.");
    if (!campaign.fromEmail) throw new Error("Campaign fromEmail is required.");

    campaign.status = "sending";
    campaign.startedAt = campaign.startedAt || new Date();
    campaign.updatedAt = new Date();
    await campaign.save();

    const maxToSend = Math.min(Math.max(Number(limit || 100), 1), 500);
    let sentThisRun = 0;

    for (const recipient of campaign.recipients) {
      if (sentThisRun >= maxToSend) break;
      if (recipient.status !== "pending") continue;

      const contact = await contactModel.findOne({ emailLower: recipient.emailLower }).lean();
      if (!contact || SUPPRESSED_STATUSES.includes(contact.status)) {
        recipient.status = contact?.status === "unsubscribed" ? "unsubscribed" : "skipped";
        recipient.error = `Suppressed contact status: ${contact?.status || "missing"}`;
        continue;
      }

      try {
        const rendered = this.renderTemplate(template.bodyHtml, recipient, String((campaign as any)._id));
        const messageId = await this.sendSesEmail({
          to: recipient.email,
          fromEmail: campaign.fromEmail,
          fromName: campaign.fromName,
          subject: campaign.subject,
          html: rendered,
        });
        recipient.status = "sent";
        recipient.providerMessageId = messageId;
        recipient.sentAt = new Date();
        sentThisRun += 1;
      } catch (error) {
        recipient.status = "failed";
        recipient.error = error instanceof Error ? error.message : "SES send failed";
        recipient.failedAt = new Date();
      }
    }

    campaign.stats = this.calculateStats(campaign.recipients as any);
    campaign.status =
      campaign.stats.pending > 0
        ? "partial"
        : campaign.stats.failed > 0 || campaign.stats.skipped > 0
        ? "partial"
        : "completed";
    campaign.completedAt = campaign.stats.pending > 0 ? undefined : new Date();
    campaign.updatedAt = new Date();
    await campaign.save();

    return campaign.toObject();
  }

  async sendTestEmail(input: {
    toEmail: string;
    subject: string;
    bodyHtml: string;
    fromEmail?: string;
    fromName?: string;
  }) {
    const toEmail = normalizeEmail(input.toEmail);
    const fromEmail = normalizeEmail(input.fromEmail || keys.marketingEmail.awsSesFromEmail);

    if (!toEmail || !EMAIL_REGEX.test(toEmail)) {
      throw new Error("A valid test recipient email is required.");
    }
    if (!fromEmail || !EMAIL_REGEX.test(fromEmail)) {
      throw new Error("A verified SES fromEmail is required.");
    }
    if (!input.subject || !input.bodyHtml) {
      throw new Error("Subject and HTML body are required.");
    }

    const rendered = this.renderTemplate(
      input.bodyHtml,
      {
        email: toEmail,
        emailLower: toEmail,
        name: "Marketing Test",
        status: "pending",
      },
      "test"
    );

    const messageId = await this.sendSesEmail({
      to: toEmail,
      fromEmail,
      fromName: input.fromName || keys.marketingEmail.awsSesFromName,
      subject: `[TEST] ${input.subject}`,
      html: rendered,
    });

    return { messageId, toEmail, fromEmail };
  }

  async unsubscribe(email: string, campaignId?: string) {
    const emailLower = normalizeEmail(email);
    if (!emailLower) throw new Error("email is required.");
    const now = new Date();
    await contactModel.updateOne(
      { emailLower },
      { $set: { status: "unsubscribed", unsubscribedAt: now, updatedAt: now } }
    );
    if (campaignId) {
      await campaignModel.updateOne(
        { _id: campaignId, "recipients.emailLower": emailLower },
        {
          $set: {
            "recipients.$.status": "unsubscribed",
            "recipients.$.error": "Recipient unsubscribed",
            updatedAt: now,
          },
        }
      );
    }
    return { email: emailLower, status: "unsubscribed" };
  }

  async handleSesEvent(payload: any) {
    const body = typeof payload?.Message === "string" ? JSON.parse(payload.Message) : payload;
    const notificationType = String(body?.notificationType || body?.eventType || "").toLowerCase();
    const mail = body?.mail || {};
    const recipients: string[] =
      body?.bounce?.bouncedRecipients?.map((item: any) => item.emailAddress) ||
      body?.complaint?.complainedRecipients?.map((item: any) => item.emailAddress) ||
      mail.destination ||
      [];
    const nextStatus =
      notificationType === "bounce"
        ? "bounced"
        : notificationType === "complaint"
        ? "complained"
        : null;
    if (!nextStatus) return { processed: false };

    const now = new Date();
    for (const email of recipients) {
      const emailLower = normalizeEmail(email);
      await contactModel.updateOne(
        { emailLower },
        {
          $set: {
            status: nextStatus,
            lastError: `SES ${notificationType}`,
            updatedAt: now,
            ...(nextStatus === "bounced" ? { bouncedAt: now } : { complainedAt: now }),
          },
        }
      );
      await campaignModel.updateMany(
        { "recipients.emailLower": emailLower },
        {
          $set: {
            "recipients.$[recipient].status": nextStatus,
            "recipients.$[recipient].error": `SES ${notificationType}`,
            ...(nextStatus === "bounced"
              ? { "recipients.$[recipient].bouncedAt": now }
              : { "recipients.$[recipient].complainedAt": now }),
          },
        },
        { arrayFilters: [{ "recipient.emailLower": emailLower }] }
      );
    }

    return { processed: true, notificationType, recipients: recipients.length };
  }

  private calculateStats(recipients: MarketingCampaignRecipient[]) {
    const stats = {
      total: recipients.length,
      pending: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
      complained: 0,
      skipped: 0,
    };
    recipients.forEach((recipient) => {
      if (recipient.status === "pending") stats.pending += 1;
      if (recipient.status === "sent") stats.sent += 1;
      if (recipient.status === "failed") stats.failed += 1;
      if (recipient.status === "bounced") stats.bounced += 1;
      if (recipient.status === "complained") stats.complained += 1;
      if (recipient.status === "skipped" || recipient.status === "unsubscribed") {
        stats.skipped += 1;
      }
    });
    return stats;
  }

  private renderTemplate(html: string, recipient: MarketingCampaignRecipient, campaignId: string) {
    const unsubscribeBase = keys.marketingEmail.unsubscribeBaseUrl;
    const unsubscribeUrl = `${unsubscribeBase.replace(/\/$/, "")}/api/v1/marketing-email/unsubscribe?email=${encodeURIComponent(
      recipient.emailLower
    )}&campaignId=${encodeURIComponent(campaignId)}`;

    return html
      .replace(/{{\s*email\s*}}/g, recipient.email)
      .replace(/{{\s*firstName\s*}}/g, recipient.name?.split(" ")[0] || "there")
      .replace(/{{\s*name\s*}}/g, recipient.name || "there")
      .replace(/{{\s*unsubscribeUrl\s*}}/g, unsubscribeUrl);
  }

  private async sendSesEmail(input: {
    to: string;
    fromEmail: string;
    fromName?: string;
    subject: string;
    html: string;
  }) {
    const source = input.fromName
      ? `${input.fromName.replace(/"/g, "")} <${input.fromEmail}>`
      : input.fromEmail;
    const commandInput: SendEmailCommandInput = {
      Source: source,
      Destination: { ToAddresses: [input.to] },
      Message: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: { Html: { Data: input.html, Charset: "UTF-8" } },
      },
    };
    if (keys.marketingEmail.awsSesConfigurationSet) {
      commandInput.ConfigurationSetName = keys.marketingEmail.awsSesConfigurationSet;
    }
    const result = await this.ses.send(new SendEmailCommand(commandInput));
    return result.MessageId || "";
  }
}
