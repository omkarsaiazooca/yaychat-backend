import { Repository } from "../db/base";
import { SocialCampaignApp, SocialCampaignSubmission } from "../data/socialCampaign";
import SocialCampaignSubmissionSchema from "../models/socialCampaign";
import { S3SocialCampaignService } from "./s3SocialCampaign.service";
import { UserService } from "./user.service";
import { BTCYRewardService } from "./btcyReward.service";
import { NotificationService } from "./notification.service";
import { SendEmail } from "../platform/email.operations";

const normalizeEmail = (value: any) => String(value || "").trim().toLowerCase();
const REWARD_DAYS = 14;
const REWARD_REASON = "SOCIAL_MEDIA_CAMPAIGN_APPROVED";

const toKeyArray = (value: any) =>
  Array.isArray(value) ? value.map((k) => String(k || "").trim()).filter(Boolean) : [];

export class SocialCampaignService extends Repository<SocialCampaignSubmission, any> {
  private s3Service = new S3SocialCampaignService();
  private userService = new UserService();
  private rewardService = new BTCYRewardService();
  private notificationService = new NotificationService();
  private emailService = new SendEmail();

  constructor() {
    super(SocialCampaignSubmissionSchema, "socialCampaignSubmission");
  }

  private escapeHtml(value: any) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private sendCampaignEmail(toEmail: string, subject: string, bodyContent: string) {
    return this.emailService.sendGenericEmail({
      toEmail,
      subject,
      bodyContent,
      senderName: "Bitcoin Yay",
      senderEmail: "accounts@indexx.ai",
      replyToEmail: "wallet@indexx.ai",
      logoUrl: "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/btcy-powered-by-indexx.png",
      logoLink: "https://bitcoinyay.com/",
    });
  }

  async requestPresignedUpload(params: { email: string; app: string; mimeType: string }) {
    const email = normalizeEmail(params.email);
    const app = String(params.app || "").trim().toLowerCase();
    const mimeType = String(params.mimeType || "").trim().toLowerCase();

    if (!email) {
      return { status: 401, data: { message: "Unauthorized: email is required" } };
    }
    if (!this.s3Service.isValidApp(app)) {
      return { status: 400, data: { message: "app must be one of: bitcoinyay, emmm" } };
    }
    if (!this.s3Service.isAllowedMimeType(mimeType)) {
      return { status: 400, data: { message: "mimeType must be one of: image/jpeg, image/png, image/webp, image/gif" } };
    }

    const { uploadUrl, key } = await this.s3Service.generatePresignedPutUrl(app as SocialCampaignApp, email, mimeType);

    return { status: 200, data: { uploadUrl, key } };
  }

  private validateKeysForApp(keys: string[], app: SocialCampaignApp, label: string) {
    if (keys.length === 0) {
      return `At least one ${label} screenshot is required.`;
    }
    const invalidKey = keys.find((key) => !this.s3Service.isKeyForApp(key, app));
    if (invalidKey) {
      return `Invalid ${label} image key: ${invalidKey}`;
    }
    return null;
  }

  async createSubmission(params: { email: string; bitcoinyayImageKeys: string[]; emmmImageKeys: string[] }) {
    const email = normalizeEmail(params.email);
    if (!email) {
      return { status: 401, data: { message: "Unauthorized: email is required" } };
    }

    const bitcoinyayImageKeys = toKeyArray(params.bitcoinyayImageKeys);
    const emmmImageKeys = toKeyArray(params.emmmImageKeys);

    const bitcoinyayError = this.validateKeysForApp(bitcoinyayImageKeys, "bitcoinyay", "Bitcoin Yay");
    if (bitcoinyayError) {
      return { status: 400, data: { message: bitcoinyayError } };
    }
    const emmmError = this.validateKeysForApp(emmmImageKeys, "emmm", "EMMM");
    if (emmmError) {
      return { status: 400, data: { message: emmmError } };
    }

    const existing = await this.findLatest({ email });
    if (existing && (existing.status === "pending" || existing.status === "approved")) {
      return {
        status: 409,
        data: {
          message:
            existing.status === "pending"
              ? "You already have a pending submission. Please wait for admin review."
              : "You already have an approved submission.",
        },
      };
    }

    const submission = await this.create({
      email,
      bitcoinyayImageKeys,
      emmmImageKeys,
      status: "pending",
      submittedAt: new Date(),
    } as SocialCampaignSubmission);

    return { status: 200, data: submission };
  }

  async getMySubmission(params: { email: string }) {
    const email = normalizeEmail(params.email);
    if (!email) {
      return { status: 401, data: { message: "Unauthorized: email is required" } };
    }

    const submission = await this.findLatest({ email });
    return { status: 200, data: submission || null };
  }

  private async attachUserInfo(submissions: any[]) {
    const emails = Array.from(new Set(submissions.map((s) => s.email)));
    const users = await this.userService.findSelect(
      { email: { $in: emails } },
      { email: 1, firstName: 1, lastName: 1, username: 1 }
    );
    const userByEmail = new Map(users.map((u: any) => [u.email, u]));

    return submissions.map((s) => {
      const user: any = userByEmail.get(s.email);
      return {
        ...(s.toObject ? s.toObject() : s),
        userId: user?._id || null,
        userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : null,
      };
    });
  }

  async listSubmissions(params: { status?: string; email?: string; page?: number; limit?: number }) {
    const cond: any = {};
    if (params.status) cond.status = String(params.status).trim().toLowerCase();
    if (params.email) cond.email = normalizeEmail(params.email);

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [rawItems, total] = await Promise.all([
      this.findPaginatedSkip(limit, skip, { submittedAt: -1 }, cond, {}),
      this.findCount(cond),
    ]);

    const items = await this.attachUserInfo(rawItems);

    return { status: 200, data: { items, total, page, limit } };
  }

  async getSubmissionById(id: string) {
    const submission: any = await this.findOne({ _id: id });
    if (!submission) {
      return { status: 404, data: { message: "Submission not found" } };
    }

    const [bitcoinyayImageUrls, emmmImageUrls, [withUser]] = await Promise.all([
      Promise.all((submission.bitcoinyayImageKeys || []).map((key: string) => this.s3Service.generatePresignedGetUrl(key))),
      Promise.all((submission.emmmImageKeys || []).map((key: string) => this.s3Service.generatePresignedGetUrl(key))),
      this.attachUserInfo([submission]),
    ]);

    return { status: 200, data: { ...withUser, bitcoinyayImageUrls, emmmImageUrls } };
  }

  async approveSubmission(id: string, reviewerEmail: string) {
    const submission = await this.findOne({ _id: id });
    if (!submission) {
      return { status: 404, data: { message: "Submission not found" } };
    }
    if (submission.status === "approved") {
      return { status: 409, data: { message: "Submission is already approved" } };
    }

    const reward = await this.rewardService.grantTurboDays(submission.email, REWARD_DAYS, REWARD_REASON);

    await this.updatePart(
      { _id: id },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: normalizeEmail(reviewerEmail),
          rewardGranted: true,
          rewardDays: REWARD_DAYS,
        },
        $unset: { rejectionReason: "" },
      }
    );

    this.notificationService
      .sendSocialCampaignApproved(submission.email, { days: REWARD_DAYS })
      .catch((err: any) => console.error("SocialCampaignService.approveSubmission notify error:", err?.message || err));

    this.sendCampaignEmail(
      submission.email,
      "Social Campaign Submission Approved - Bitcoin Yay",
      `<p>Hi,</p>
       <p>Your social media campaign submission has been approved.</p>
       <p>You have been granted <strong>${REWARD_DAYS} days of Turbo Mining Power</strong>.</p>
       <p>Thank you for participating!</p>
       <p>Regards,<br/>Bitcoin Yay Team</p>`
    ).catch((err: any) =>
      console.error("SocialCampaignService.approveSubmission email error:", err?.message || err)
    );

    const updated = await this.findOne({ _id: id });
    return { status: 200, data: { ...(updated as any).toObject(), turboTimeMinutes: (reward as any)?.turboTimeMinutes } };
  }

  async rejectSubmission(id: string, reviewerEmail: string, rejectionReason: string) {
    const reason = String(rejectionReason || "").trim();

    const submission = await this.findOne({ _id: id });
    if (!submission) {
      return { status: 404, data: { message: "Submission not found" } };
    }

    await this.updatePart(
      { _id: id },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason || undefined,
          reviewedAt: new Date(),
          reviewedBy: normalizeEmail(reviewerEmail),
        },
      }
    );

    this.notificationService
      .sendSocialCampaignRejected(submission.email, { reason })
      .catch((err: any) => console.error("SocialCampaignService.rejectSubmission notify error:", err?.message || err));

    const reasonContent = reason
      ? `<p><strong>Reason:</strong> ${this.escapeHtml(reason)}</p>`
      : "";
    this.sendCampaignEmail(
      submission.email,
      "Social Campaign Submission Update - Bitcoin Yay",
      `<p>Hi,</p>
       <p>Your social media campaign submission was not approved.</p>
       ${reasonContent}
       <p>You can upload a new submission after addressing the feedback above.</p>
       <p>Regards,<br/>Bitcoin Yay Team</p>`
    ).catch((err: any) =>
      console.error("SocialCampaignService.rejectSubmission email error:", err?.message || err)
    );

    const updated = await this.findOne({ _id: id });
    return { status: 200, data: updated };
  }
}
