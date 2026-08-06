import { Document, Schema } from "mongoose";
import {
  MarketingCampaign,
  MarketingContact,
  MarketingTemplate,
  MarketingVerificationJob,
} from "../data/marketingEmail";

export interface MarketingContactDocument extends Document, MarketingContact {}
export interface MarketingTemplateDocument extends Document, MarketingTemplate {}
export interface MarketingCampaignDocument extends Document, MarketingCampaign {}
export interface MarketingVerificationJobDocument
  extends Document,
    MarketingVerificationJob {}

// Nullable Boolean fields intentionally default to null ("unknown"), never false.
export const EmailValidationSchema = new Schema(
  {
    isValidSyntax: { type: Boolean, default: false },
    isDisposable: { type: Boolean, default: null },
    isRoleAccount: { type: Boolean, default: null },
    isFreeEmail: { type: Boolean, default: null },
    mxRecords: [{ type: String }],
    mxAcceptsMail: { type: Boolean, default: null },
    canConnectSmtp: { type: Boolean, default: null },
    isDeliverable: { type: Boolean, default: null },
    isCatchAll: { type: Boolean, default: null },
    hasInboxFull: { type: Boolean, default: null },
    isDisabled: { type: Boolean, default: null },
    // isSpamtrap is never computable here — stored as null and surfaced as "not available".
    isSpamtrap: { type: Boolean, default: null },
    isSafeToSend: { type: Boolean, default: false },
    notes: [{ type: String }],
    smtpStatus: {
      type: String,
      enum: ["pending", "verified", "unknown", "skipped"],
      default: "skipped",
      index: true,
    },
    smtpJobId: { type: String, index: true },
    checkedAt: { type: Date },
    smtpCheckedAt: { type: Date },
  },
  { _id: false }
);

export const MarketingContactSchema = new Schema<MarketingContactDocument>({
  email: { type: String, required: true },
  emailLower: { type: String, required: true, unique: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  tags: [{ type: String, index: true }],
  status: {
    type: String,
    enum: [
      "active",
      "invalid",
      "disposable",
      "bounced",
      "complained",
      "blocklisted",
      "unsubscribed",
    ],
    default: "active",
    index: true,
  },
  source: { type: String },
  lastError: { type: String },
  validation: { type: EmailValidationSchema, default: undefined },
  unsubscribedAt: { type: Date },
  bouncedAt: { type: Date },
  complainedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const MarketingTemplateSchema = new Schema<MarketingTemplateDocument>({
  name: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  bodyHtml: { type: String, required: true },
  type: {
    type: String,
    enum: ["marketing", "transactional"],
    default: "marketing",
    index: true,
  },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const RecipientSchema = new Schema(
  {
    email: { type: String, required: true },
    emailLower: { type: String, required: true, index: true },
    name: { type: String },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "bounced", "complained", "unsubscribed", "skipped"],
      default: "pending",
      index: true,
    },
    providerMessageId: { type: String },
    error: { type: String },
    sentAt: { type: Date },
    failedAt: { type: Date },
    bouncedAt: { type: Date },
    complainedAt: { type: Date },
  },
  { _id: false }
);

export const MarketingCampaignSchema = new Schema<MarketingCampaignDocument>({
  name: { type: String, required: true, index: true },
  templateId: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  fromEmail: { type: String, required: true },
  fromName: { type: String },
  status: {
    type: String,
    enum: ["draft", "sending", "completed", "partial", "failed"],
    default: "draft",
    index: true,
  },
  recipients: [RecipientSchema],
  stats: {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    complained: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
  },
  createdBy: { type: String },
  startedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

MarketingCampaignSchema.index({ createdAt: -1 });
MarketingCampaignSchema.index({ "recipients.emailLower": 1 });

export const MarketingVerificationJobSchema =
  new Schema<MarketingVerificationJobDocument>({
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    source: { type: String },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    safe: { type: Number, default: 0 },
    deliverable: { type: Number, default: 0 },
    undeliverable: { type: Number, default: 0 },
    catchAll: { type: Number, default: 0 },
    unknown: { type: Number, default: 0 },
    mailFrom: { type: String, required: true },
    domainConcurrency: { type: Number, default: 2 },
    domainDelayMs: { type: Number, default: 1000 },
    createdBy: { type: String },
    lastError: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  });

MarketingVerificationJobSchema.index({ createdAt: -1 });
