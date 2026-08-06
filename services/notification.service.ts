import mongoose from "mongoose";
import { Notification, } from "../data/notifications";
import { notificationSchema, NotificationModel } from "../models/notifications";
import { NotificationTemplateService } from "./notificationTemplate.service";
import { ServiceBase } from "./base";
import { v1 as uuidv1 } from "uuid";
import { sendFirebaseNotification, sendFirebaseTopicNotification, subscribeTokensToTopic } from "../helpers/notificationHelper";
import { UserService } from "./user.service";
import { ChatGroupService } from "./chatgroups.service";
const userService: UserService = new UserService();
const chatGroupService: ChatGroupService = new ChatGroupService();
type InboxTarget =
    | { emails: string[] }              // supply emails
    | { emailSet: Set<string> }
    | { groupId?: string }
    | { excludeEmail?: string }

const GROUP_TOPIC = (groupId: string) => `group_${groupId}`;
export const AUTOMATION_NOTIFICATION_TYPES = [
    "mining_start_reminder",
    "mining_session_ending",
    "mining_session_ended",
    "mining_first_session_welcome",
    "mining_power_activated",
    "daily_ads_reminder",
    "daily_ads_almost_done",
    "daily_ads_reset_warning",
    "btcy_milestone_10k",
    "btcy_milestone_100k",
    "app_inactive_recovery",
    "btcy_follow_bonus_granted",
    "btcy_daily_ads_bonus_granted",
    "btcy_chat_group_bonus_granted",
];

export class NotificationService extends ServiceBase<Notification, NotificationModel> {
    private templateService: NotificationTemplateService;

    constructor() {
        super(notificationSchema, "Notification");
        this.templateService = new NotificationTemplateService();
    }

    private defaultImage =
        "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png";

    private normalizeEmail(email: string) {
        return String(email || "").trim().toLowerCase();
    }

    async hasNotificationSince(email: string, type: string, since: Date) {
        const emailL = this.normalizeEmail(email);
        const count = await this.findCount({
            email: emailL,
            type,
            createdAt: { $gte: since },
        });
        return count > 0;
    }

    async countNotificationsSince(email: string, type: string, since: Date) {
        const emailL = this.normalizeEmail(email);
        return this.findCount({
            email: emailL,
            type,
            createdAt: { $gte: since },
        });
    }

    private async sendDirectNotification(opts: {
        email: string;
        type: string;
        title: string;
        body: string;
        user?: any;
        betaOnly?: boolean;
        throttleMs?: number;
        since?: Date;
        imageUrl?: string;
        data?: Record<string, any>;
        dedupeKey?: string;
    }) {
        const {
            email,
            type,
            title,
            body,
            betaOnly = false,
            throttleMs,
            since,
            imageUrl,
            data = {},
            dedupeKey,
        } = opts;

        const lowerEmail = this.normalizeEmail(email);

        if (!lowerEmail) {
            return { status: 400, data: "missing-email" };
        }

        if (throttleMs && throttleMs > 0) {
            const windowStart = new Date(Date.now() - throttleMs);
            if (await this.hasNotificationSince(lowerEmail, type, windowStart)) {
                return { status: 200, data: "throttled" };
            }
        }

        if (since) {
            if (await this.hasNotificationSince(lowerEmail, type, since)) {
                return { status: 200, data: "already-sent" };
            }
        }

        const user = opts.user ?? (await userService.findOne({ email: lowerEmail } as any));
        if (!user) {
            return { status: 404, data: "user-not-found" };
        }

        const now = new Date();
        let effectiveDedupeKey: string | null = dedupeKey ? String(dedupeKey) : null;
        if (!effectiveDedupeKey) {
            if (since) {
                effectiveDedupeKey = `since:${new Date(since).toISOString()}`;
            } else if (throttleMs && throttleMs > 0) {
                const bucket = Math.floor(now.getTime() / throttleMs) * throttleMs;
                effectiveDedupeKey = `throttle:${bucket}`;
            }
        }

        const notification: Notification = {
            userId: user?._id ? String(user._id) : (undefined as any),
            email: lowerEmail,
            notificationId: uuidv1(),
            type,
            title,
            body,
            read: false,
            pushed: false,
            createdAt: now,
            dedupeKey: effectiveDedupeKey,
        } as any;

        let created: any = null;
        if (effectiveDedupeKey) {
            const upsertRes: any = await this.upsertOne(
                { email: lowerEmail, type, dedupeKey: effectiveDedupeKey },
                { $setOnInsert: notification }
            );
            const inserted = !!upsertRes?.upsertedId || (upsertRes?.upsertedCount ?? 0) > 0;
            if (!inserted) {
                return { status: 200, data: "already-sent" };
            }
            created = await this.findOne({ email: lowerEmail, type, dedupeKey: effectiveDedupeKey } as any);
        } else {
            created = await this.create(notification);
        }

        if (!user.fcmToken) {
            console.warn(`No FCM token for ${lowerEmail}, storing inbox only: ${type}`);
            return { status: 200, data: "inbox-only", notificationId: created.notificationId };
        }

        try {
            const claimRes: any = await this.updatePart(
                { _id: (created as any)._id, pushed: false },
                {
                    $set: {
                        pushed: true,
                        pushedLottoAirdrop: true,
                        pushedLottoAirdropDate: new Date(),
                    },
                }
            );
            const claimed = claimRes && (claimRes.modifiedCount > 0 || (claimRes as any).nModified > 0);
            if (!claimed) {
                return { status: 200, data: "already-pushed", notificationId: created.notificationId };
            }

            await sendFirebaseNotification(
                user.fcmToken,
                title,
                body,
                imageUrl || this.defaultImage,
                {
                    type,
                    ...data,
                }
            );
            return { status: 200, data: "pushed", notificationId: created.notificationId };
        } catch (err: any) {
            await this.updatePart(
                { _id: (created as any)._id, pushed: true },
                {
                    $set: { pushed: false, pushedLottoAirdrop: false },
                    $unset: { pushedLottoAirdropDate: "" },
                }
            );
            console.error(`❌ Error sending notification ${type} to ${lowerEmail}:`, err);
            return { status: 500, data: err.message || String(err), notificationId: created.notificationId };
        }
    }

    async sendMiningStartReminder(email: string, opts: { user?: any; idleMinutes?: number } = {}) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "mining_start_reminder",
            title: "⛏️ Start Mining",
            body: "Your BTCY isn’t mining right now. Tap to start a new session and keep earning.",
            betaOnly: true,
            throttleMs: 60 * 60 * 1000,
            data: { action: "start_mining" },
        });
    }

    async sendMiningSessionEndingSoon(email: string, opts: { user?: any; sessionStart?: Date; minutesLeft?: number; sessionLengthHours?: number } = {}) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "mining_session_ending",
            title: "⏳ Mining Session Ending",
            body: "⏳ 10 minutes left in your mining session. Don’t miss a second of BTCY.",
            betaOnly: true,
            since: opts.sessionStart,
            data: {
                action: "resume_mining",
                minutesLeft: opts.minutesLeft ?? 10,
                sessionLengthHours: opts.sessionLengthHours ?? null,
            },
        });
    }

    async sendMiningSessionEnded(
        email: string,
        opts: { user?: any; sessionLengthHours?: number; sessionStart?: Date } = {}
    ) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "mining_session_ended",
            title: "⛏️ Session Ended",
            body: "Your mining session just ended. Tap to restart and keep earning.",
            betaOnly: true,
            since: opts.sessionStart,
            throttleMs: opts.sessionStart ? undefined : 10 * 60 * 1000,
            data: {
                action: "restart_mining",
                sessionLengthHours: opts.sessionLengthHours ?? null,
            },
        });
    }

    async sendFirstTimeMiningWelcome(email: string, opts: { user?: any } = {}) {
        const alreadySent = await this.hasNotificationSince(email, "mining_first_session_welcome", new Date(0));
        if (alreadySent) return { status: 200, data: "already-notified" };

        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "mining_first_session_welcome",
            title: "🎉 Welcome to Bitcoin Yay",
            body: "Welcome to Bitcoin Yay mining. Keep mining daily to unlock your Indexx Wallet at 10k.",
            betaOnly: true,
            data: { action: "start_mining" },
        });
    }

    async sendPowerActivated(email: string, opts: { user?: any; powerName?: string } = {}) {
        const powerName = opts.powerName || "Power";
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "mining_power_activated",
            title: "⚡ Power Activated",
            body: `⚡ Your ${powerName} boost is live. Your mining is now upgraded.`,
            betaOnly: true,
            throttleMs: 10 * 60 * 1000,
            data: { action: "view_subscription", powerName },
        });
    }

    async sendEmmmFirstBetTurboUnlocked(email: string, opts: { user?: any; days?: number; source?: string } = {}) {
        const days = Number(opts.days || 7);
        const source = String(opts.source || "EMMM_BTCY_FIRST_BET_TURBO_7D").trim();
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "emmm_btcy_first_bet_turbo_unlocked",
            title: "⚡ Turbo Mining Unlocked",
            body: `Your first BTCY bet on Eeny Meeny Miny Moe unlocked ${days} days of turbo mining on Bitcoin Yay.`,
            betaOnly: true,
            dedupeKey: source,
            data: { action: "view_subscription", source, days },
        });
    }

    async sendSocialCampaignApproved(email: string, opts: { user?: any; days?: number } = {}) {
        const days = Number(opts.days || 14);
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "social_campaign_approved",
            title: "🎉 Campaign Submission Approved",
            body: `Your social media campaign submission has been approved! You've been granted ${days} days of Turbo Mining Power.`,
            data: { action: "view_subscription", days },
        });
    }

    async sendSocialCampaignRejected(email: string, opts: { user?: any; reason?: string } = {}) {
        const reason = String(opts.reason || "").trim();
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "social_campaign_rejected",
            title: "Campaign Submission Rejected",
            body: reason
                ? `Your social media campaign submission was rejected: ${reason}. You can upload a new submission.`
                : "Your social media campaign submission was rejected. You can upload a new submission.",
            data: { action: "resubmit_social_campaign", reason },
        });
    }

    async sendDailyAdsReminder(email: string, opts: { user?: any; since?: Date; remaining?: number } = {}) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "daily_ads_reminder",
            title: "⚡ Earn Today’s Power",
            body: "⚡ Earn today’s bonus power. Watch your daily ads and claim your reward.",
            betaOnly: true,
            since: opts.since,
            data: { action: "open_daily_ads", remaining: opts.remaining ?? null },
        });
    }

    async sendDailyAdsCloseReminder(email: string, opts: { user?: any; since?: Date; remaining?: number } = {}) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "daily_ads_almost_done",
            title: "🚀 You’re Almost Done",
            body: "Only a few ads left. Finish your 25 today to lock in your power reward.",
            betaOnly: true,
            since: opts.since,
            data: { action: "open_daily_ads", remaining: opts.remaining ?? null },
        });
    }

    async sendDailyAdsResetReminder(email: string, opts: { user?: any; since?: Date; remaining?: number } = {}) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "daily_ads_reset_warning",
            title: "⏰ Daily Reset Coming",
            body: "Last chance to earn today’s reward. Finish your ads before reset.",
            betaOnly: true,
            since: opts.since,
            data: { action: "open_daily_ads", remaining: opts.remaining ?? null },
        });
    }

    async sendMilestoneUnlocked(email: string, milestone: 10000 | 100000, opts: { user?: any } = {}) {
        const type = milestone === 100000 ? "btcy_milestone_100k" : "btcy_milestone_10k";
        const already = await this.hasNotificationSince(email, type, new Date(0));
        if (already) return { status: 200, data: "already-notified" };

        const body =
            milestone === 100000
                ? "You’re eligible for Alchemy soon. Convert BTCY to tradable balance when your account is ready."
                : "You’ve unlocked Indexx Wallet utility. Withdraw your BTCY and start using it in the ecosystem.";

        const title = milestone === 100000 ? "🎯 100K BTCY Milestone" : "🎉 Indexx Wallet Unlocked";

        return this.sendDirectNotification({
            email,
            user: opts.user,
            type,
            title,
            body,
            betaOnly: true,
            data: { action: "view_wallet", milestone },
        });
    }

    async sendInactiveRecovery(email: string, opts: { user?: any; lastActive?: Date } = {}) {
        return this.sendDirectNotification({
            email,
            user: opts.user,
            type: "app_inactive_recovery",
            title: "⛏️ Come Back to Mining",
            body: "Your BTCY isn’t growing right now. Come back and restart mining.",
            betaOnly: true,
            throttleMs: 48 * 60 * 60 * 1000,
            data: {
                action: "open_app",
                lastActive: opts.lastActive ? new Date(opts.lastActive).toISOString() : null,
            },
        });
    }

    /**
     * Send a push + inbox notification based on a predefined template
     */
    async sendNotification0(user: any, type: string, data: any) {
        const template = await this.templateService.getTemplateByType(type);
        if (!template) throw new Error("Template not found");

        const title = this.renderTemplate(template.title, data);
        const body = this.renderTemplate(template.body, data);
        const imageUrl = template.imageUrl || "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png";

        // Save to inbox
        await this.create({
            userId: user._id,
            email: user.email,
            notificationId: uuidv1(),
            type,
            title,
            body,
            read: false,
            pushed: false,
            createdAt: new Date(),
        } as Notification);

        // Send push via FCM
        if (user.fcmToken) {
            await sendFirebaseNotification(user.fcmToken, title, body, imageUrl);
            await this.updatePart({ email: user.email }, {
                $set: {
                    pushedLottoAirdrop: true,
                    pushedLottoAirdropDate: new Date()
                }
            });
        } else {
            console.warn(`No FCM token found for user ${user.email}.`);
        }
    }

    async bulkMarkAsRead(notificationIds: string[], email: string) {
        const res: any = await this.updateMany(
            {
                email,
                read: false,
                $or: [
                    { notificationId: { $in: notificationIds } },
                ],
            },
            { $set: { read: true, readAt: new Date() } }
        );

        return { matchedCount: res?.matchedCount ?? res?.n ?? 0, modifiedCount: res?.modifiedCount ?? res?.nModified ?? 0 };
    }

    async sendNotification(user: any, type: string, data: any) {
        const template = await this.templateService.getTemplateByType(type);
        if (!template) throw new Error("Template not found");

        const title = this.renderTemplate(template.title, data);
        const body = this.renderTemplate(template.body, data);
        const imageUrl =
            template.imageUrl ||
            "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png";

        // 1) create a new inbox row
        let notif = await this.create({
            userId: user._id,
            email: user.email,
            notificationId: uuidv1(),
            type,
            title,
            body,
            read: false,
            pushed: false,
            createdAt: new Date(),
            // pushedLottoAirdrop / pushedLottoAirdropDate will be set on successful push
        } as Notification);

        const notificationId = notif.notificationId;
        // 2) If no token, keep it in inbox only (don’t attempt push)
        if (!user.fcmToken) {
            console.warn(`No FCM token found for user ${user.email}.`);
            return { status: 200, data: "no-token", notificationId };
        }

        // 3) Atomically "claim" this notification for sending by flipping pushed:false → true
        //    If another worker already claimed/sent it, modifiedCount will be 0 and we skip.
        const claimRes: any = await this.updatePart(
            { _id: notif._id, pushed: false }, // CAS guard: only if still unpushed
            {
                $set: {
                    pushed: true,
                    pushedLottoAirdrop: true,
                    pushedLottoAirdropDate: new Date(),
                },
            }
        );

        const claimed =
            claimRes && (claimRes.modifiedCount > 0 || (claimRes as any).nModified > 0);

        if (!claimed) {
            // Someone else already sent/claimed this notification
            return { status: 200, data: "already-pushed", notificationId };
        }

        // 4) We won the claim → send once
        try {
            await sendFirebaseNotification(user.fcmToken, title, body, imageUrl);
            // success: DB already marked pushed:true above
            return { status: 200, data: "pushed" };
        } catch (err: any) {
            // 5) Send failed → roll back pushed so it can be retried later
            await this.updatePart(
                { _id: notif._id, pushed: true },
                {
                    $set: { pushed: false, pushedLottoAirdrop: false },
                    $unset: { pushedLottoAirdropDate: "" },
                }
            );
            console.error("❌ Error sending FCM notification:", err);
            return { status: 500, data: err.message || String(err), notificationId };
        }
    }


    get(obj: any, path: string) {
        return String(path)
            .split(".")
            .reduce((o: any, k: string) => (o == null ? o : o[k]), obj);
    }

    renderTemplate(input: string, data: any) {
        if (!input) return "";

        // 1) normalize `{var}` → `{{var}}`
        const normalized = input.replace(/\{(\s*[\w.]+\s*)\}/g, "{{$1}}");

        // 2) render `{{var}}`
        return normalized.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
            const val = this.get(data, key);
            return val === undefined || val === null ? "" : String(val);
        });
    }

    async sendToTopic(
        topic: string,
        type: string,
        data: any,
        opts?: { imageUrl?: string; inboxTargets?: InboxTarget & { excludeEmail?: string } }
    ) {
        const tpl = await this.templateService.getTemplateByType(type);
        if (!tpl) throw new Error("Template not found");

        const title = this.renderTemplate(tpl.title, data);
        const body = this.renderTemplate(tpl.body, data);
        const imageUrl =
            opts?.imageUrl ||
            tpl.imageUrl ||
            "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png";

        // FCM topic name must be URL-safe; sanitize and lowercase
        const safeTopic = String(topic)
            .toLowerCase()
            .replace(/[^a-z0-9-_.~%]/g, "_");

        // 1) Topic push (single call, FCM fans out)
        try {
            await sendFirebaseTopicNotification(
                safeTopic,
                title,
                body,
                imageUrl,
                {
                    senderEmail: String(data?.senderEmail || "").toLowerCase(),
                    groupId: String(data?.groupId || ""),
                    type,
                }
            );
            console.log(`[notif] topic sent`, { topic: safeTopic, type });
        } catch (e) {
            console.error("❌ FCM topic push failed:", e);
            // continue to inbox creation regardless
        }

        // 2) Optional inbox fan-in (store per-user)
        if (opts?.inboxTargets) {
            let emails: string[] = [];

            if ("groupId" in opts.inboxTargets && opts.inboxTargets.groupId) {
                emails = await this.fetchGroupMemberEmails(opts.inboxTargets.groupId);
            } else if ("emailSet" in opts.inboxTargets && opts.inboxTargets.emailSet) {
                emails = Array.from(opts.inboxTargets.emailSet);
            } else if ("emails" in opts.inboxTargets && opts.inboxTargets.emails?.length) {
                emails = opts.inboxTargets.emails;
            }
            // NEW: filter out the sender
            const ex = opts.inboxTargets.excludeEmail
                ? String(opts.inboxTargets.excludeEmail).toLowerCase().trim()
                : "";
            if (ex) {
                emails = emails.filter(e => String(e).toLowerCase().trim() !== ex);
            }

            if (emails.length) {
                await this.addInboxForEmailsBulk(type, title, body, emails);
            }
        }

        return { status: 200, data: "topic-ok" };
    }

    // helper to unify email resolution
    private async _resolveEmailsFromTargets(targets?: InboxTarget & { emailSet?: Set<string> }): Promise<string[]> {
        if (!targets) return [];
        if ("groupId" in targets && targets.groupId) {
            return await this.fetchGroupMemberEmails(targets.groupId);
        } else if ("emailSet" in targets && targets.emailSet) {
            return Array.from(targets.emailSet).map(e => e.toLowerCase());
        } else if ("emails" in targets && targets.emails?.length) {
            return targets.emails.map(e => e.toLowerCase());
        }
        return [];
    }

    private async fetchGroupMemberEmails(groupId: string): Promise<string[]> {
        const g = await chatGroupService.findOne({ groupId });
        if (!g) return [];

        const members: any[] = (g as any).members || [];

        // If members look like emails, return them directly
        const looksLikeEmail = (s: string) => /@/.test(s);
        if (members.length && looksLikeEmail(String(members[0] || ""))) {
            return members.map((e: string) => String(e).trim().toLowerCase());
        }

        // Else assume they are user IDs → resolve to emails in batches
        const ids: string[] = members.map(String);
        const CHUNK = 1000;
        const emails: string[] = [];
        for (let i = 0; i < ids.length; i += CHUNK) {
            const slice = ids.slice(i, i + CHUNK);
            const rows = await userService.findSelect(
                { id: { $in: slice } } as any,
                { email: 1 }
            );
            emails.push(
                ...rows
                    .map((r: any) => r.email)
                    .filter(Boolean)
                    .map((e: string) => e.toLowerCase())
            );
        }
        return emails;
    }

    private async addInboxForEmailsBulk(type: string, title: string, body: string, emails: string[]) {
        if (!emails.length) return;

        // fetch users once (id+email)
        const users = await userService.findSelect(
            { email: { $in: emails } as any },
            { _id: 1, email: 1 }
        );

        if (!users?.length) return;

        // chunked insert to avoid large packet issues
        const CHUNK = 1000;
        const now = new Date();

        for (let i = 0; i < users.length; i += CHUNK) {
            const slice = users.slice(i, i + CHUNK);
            const docs: Notification[] = slice.map((u: any) => ({
                userId: String(u._id),
                email: String(u.email).toLowerCase(),
                notificationId: uuidv1(),
                type,
                title,
                body,
                read: false,
                pushed: false,       // inbox row; topic push is already done
                createdAt: now,
            })) as any;

            // use the underlying mongoose model for bulk insert
            await (notificationSchema as any).insertMany(docs, { ordered: false });
        }
    }

    async subscribeGroupMembersToTopic(groupId: string) {
        const groupService = new ChatGroupService();

        const group = await groupService.findOne({ groupId });
        if (!group) throw new Error("Group not found");

        // group.members may be userIds or emails in your DB; handle both
        const members = Array.isArray((group as any).members) ? (group as any).members : [];
        const userIds: string[] = [];
        const emails: string[] = [];

        for (const m of members) {
            if (typeof m === "string" && /^[0-9a-fA-F]{24}$/.test(m)) userIds.push(m);
            else if (m) emails.push(String(m).toLowerCase());
        }

        const $or: any[] = [];
        if (userIds.length) $or.push({ _id: { $in: userIds as any } });
        if (emails.length) $or.push({ email: { $in: emails } });

        const users = $or.length
            ? await userService.findSelect({ $or }, { email: 1, fcmToken: 1 })
            : [];

        const tokens = Array.from(
            new Set((users as any[]).map(u => u.fcmToken).filter(Boolean))
        ) as string[];

        if (!tokens.length) return { topic: GROUP_TOPIC(groupId), subscribed: 0 };

        await subscribeTokensToTopic(tokens, GROUP_TOPIC(groupId));
        return { topic: GROUP_TOPIC(groupId), subscribed: tokens.length };
    }

    /**
     * 🔔 Social follow reward granted (no template dependency)
     * Sends inbox + push when ALL social follows are approved
     */
    async sendFollowAllApprovedReward(email: string, opts: { days?: number; minutes?: number } = {}) {
        const user = await userService.findOne({ email: String(email).toLowerCase().trim() } as any);

        const grantedDays = opts.days ?? 0;
        const grantedMinutes = opts.minutes ?? 0;

        const humanGrant =
            grantedDays > 0
                ? `${grantedDays} day${grantedDays === 1 ? "" : "s"}`
                : `${grantedMinutes} minute${grantedMinutes === 1 ? "" : "s"}`;

        const title = "🎉 Social Follow Bonus Granted";
        const body = `Thanks for completing all social follows! You’ve been granted ${humanGrant} of Turbo Power. Enjoy the boost. 🚀`;

        // Always create an inbox entry
        const now = new Date();
        const notif: Notification = {
            userId: user?._id ? String(user._id) : undefined as any,
            email: String(email).toLowerCase(),
            notificationId: uuidv1(),
            type: "btcy_follow_bonus_granted",
            title,
            body,
            read: false,
            pushed: false,
            createdAt: now,
        } as any;

        const created = await this.create(notif);

        // Push if we have a token
        if (user?.fcmToken) {
            try {
                // claim (idempotency guard)
                const claimRes: any = await this.updatePart(
                    { _id: (created as any)._id, pushed: false },
                    {
                        $set: {
                            pushed: true,
                            pushedLottoAirdrop: true,
                            pushedLottoAirdropDate: new Date(),
                        },
                    }
                );
                const claimed = claimRes && (claimRes.modifiedCount > 0 || (claimRes as any).nModified > 0);
                if (!claimed) return { status: 200, data: "already-pushed", notificationId: created.notificationId };

                await sendFirebaseNotification(
                    user.fcmToken,
                    title,
                    body,
                    "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png"
                );
                return { status: 200, data: "pushed", notificationId: created.notificationId };
            } catch (err: any) {
                // roll back pushed flag so it can be retried later
                await this.updatePart(
                    { _id: (created as any)._id, pushed: true },
                    {
                        $set: { pushed: false, pushedLottoAirdrop: false },
                        $unset: { pushedLottoAirdropDate: "" },
                    }
                );
                return { status: 500, data: err.message, notificationId: created.notificationId };
            }
        }

        // no token: inbox only
        return { status: 200, data: "inbox-only", notificationId: created.notificationId };
    }


    async sendDailyAdsCompletedReward(
        email: string,
        opts: { days?: number; minutes?: number } = {}
    ) {
        const user = await userService.findOne({ email: String(email).toLowerCase().trim() } as any);

        const grantedDays = opts.days ?? 0;
        const grantedMinutes = opts.minutes ?? 0;

        const humanGrant =
            grantedDays > 0
                ? `${grantedDays} day${grantedDays === 1 ? "" : "s"}`
                : `${grantedMinutes} minute${grantedMinutes === 1 ? "" : "s"}`;

        const title = "🎉 Daily Ads Bonus Granted";
        const body = `Awesome work—25 ads watched today! You’ve been granted ${humanGrant} of Electric Power. Keep the streak going. 🚀`;

        // Always create an inbox entry
        const now = new Date();
        const notif: Notification = {
            userId: user?._id ? String(user._id) : (undefined as any),
            email: String(email).toLowerCase(),
            notificationId: uuidv1(),
            type: "btcy_daily_ads_bonus_granted",
            title,
            body,
            read: false,
            pushed: false,
            createdAt: now,
        } as any;

        const created = await this.create(notif);

        if (user?.fcmToken) {
            try {
                // claim (idempotency guard)
                const claimRes: any = await this.updatePart(
                    { _id: (created as any)._id, pushed: false },
                    {
                        $set: {
                            pushed: true,
                            pushedLottoAirdrop: true,        // keep same audit fields if you want
                            pushedLottoAirdropDate: new Date(),
                        },
                    }
                );
                const claimed =
                    claimRes && (claimRes.modifiedCount > 0 || (claimRes as any).nModified > 0);
                if (!claimed)
                    return { status: 200, data: "already-pushed", notificationId: created.notificationId };

                await sendFirebaseNotification(
                    user.fcmToken,
                    title,
                    body,
                    "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png"
                );
                return { status: 200, data: "pushed", notificationId: created.notificationId };
            } catch (err: any) {
                // roll back pushed flag so it can be retried later
                await this.updatePart(
                    { _id: (created as any)._id, pushed: true },
                    {
                        $set: { pushed: false, pushedLottoAirdrop: false },
                        $unset: { pushedLottoAirdropDate: "" },
                    }
                );
                return { status: 500, data: err.message, notificationId: created.notificationId };
            }
        }

        // no token: inbox only
        return { status: 200, data: "inbox-only", notificationId: created.notificationId };
    }

    async sendBtcyChatGroupBonusReward(
        email: string,
        opts: {
            days: number;
            groupId: string;
            groupName?: string;
            memberCount?: number;
            dedupeKey?: string;
        }
    ) {
        const days = Math.max(1, Math.floor(Number(opts.days || 0)));
        const groupName = String(opts.groupName || "your BTCY Chat group").trim();

        return this.sendDirectNotification({
            email,
            type: "btcy_chat_group_bonus_granted",
            title: "Congrats, Group Bonus Unlocked",
            body: `Congrats! You created ${groupName} with ${opts.memberCount ?? "5+"} joined members and earned ${days} days of Turbo Power mining.`,
            dedupeKey: opts.dedupeKey || `btcy_chat_group_bonus:${opts.groupId}`,
            data: {
                action: "open_mining",
                groupId: opts.groupId,
                groupName,
                memberCount: opts.memberCount ?? null,
                rewardDays: days,
            },
        });
    }

    /**
     * Send a templated message to the group's topic, and (optionally)
     * create inbox rows for the group members (fan-in).
     */
    async notifyGroupByTopic(
        groupId: string,
        templateType: string,        // e.g. "chat_group_message"
        data: any,                    // { groupName, from, preview, ... }
        opts?: { inboxEmails?: string[] }
    ) {
        const tpl = await this.templateService.getTemplateByType(templateType);
        if (!tpl) throw new Error("Template not found");

        const title = this.renderTemplate(tpl.title, data);
        const body = this.renderTemplate(tpl.body, data);
        const topic = GROUP_TOPIC(groupId);

        await sendFirebaseTopicNotification(topic, title, body, tpl.imageUrl);

        if (opts?.inboxEmails?.length) {
            await this.addInboxForEmailsBulk(templateType, title, body,
                opts.inboxEmails.map(e => String(e).toLowerCase())
            );
        }
    }


    /**
     * 📥 Get paginated notifications for a user
     */
    async getUserNotifications(email: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const notifications = await this.findPaginatedSkip(
            limit,
            skip,
            { createdAt: -1 },
            { email },
            null
        );
        const total = await this.findCount({ email });

        return { total, notifications };
    }

    /**
     * Get paginated automation notifications delivered to users
     */
    async getAutomationNotifications(opts: {
        page?: number;
        limit?: number;
        email?: string;
        from?: Date;
        to?: Date;
        types?: string[];
        deliveredOnly?: boolean;
        cursor?: { createdAt: Date; id: string };
    }) {
        const page = Math.max(1, Number(opts.page) || 1);
        const MAX_AUTOMATION_LIMIT = 1000;
        const DEFAULT_AUTOMATION_LIMIT = 1000;
        const limit = Math.min(
            MAX_AUTOMATION_LIMIT,
            Math.max(1, Number(opts.limit) || DEFAULT_AUTOMATION_LIMIT)
        );
        const useCursor = Boolean(opts.cursor);
        const skip = useCursor ? 0 : (page - 1) * limit;
        const sort = { createdAt: -1, _id: -1 };

        const types =
            opts.types && opts.types.length ? opts.types : (AUTOMATION_NOTIFICATION_TYPES as unknown as string[]);

        const cond: any = { type: { $in: types } };

        if (opts.email) {
            cond.email = this.normalizeEmail(opts.email);
        }

        if (opts.deliveredOnly !== false) {
            cond.pushed = true;
        }

        if (opts.from || opts.to) {
            cond.createdAt = {};
            if (opts.from) cond.createdAt.$gte = opts.from;
            if (opts.to) cond.createdAt.$lte = opts.to;
        }

        if (opts.cursor?.createdAt && opts.cursor?.id) {
            const cursorId = mongoose.Types.ObjectId.isValid(opts.cursor.id)
                ? new mongoose.Types.ObjectId(opts.cursor.id)
                : undefined;

            if (cursorId) {
                cond.$or = [
                    { createdAt: { $lt: opts.cursor.createdAt } },
                    { createdAt: opts.cursor.createdAt, _id: { $lt: cursorId } },
                ];
            }
        }

        const notifications = await this.findPaginatedSkip(
            limit,
            skip,
            sort,
            cond,
            null
        );
        const total = await this.findCount(cond);

        let nextCursor: string | undefined;
        if (notifications.length === limit) {
            const last = notifications[notifications.length - 1] as any;
            if (last?.createdAt && last?._id) {
                const createdAt =
                    last.createdAt instanceof Date ? last.createdAt : new Date(last.createdAt);
                if (!Number.isNaN(createdAt.getTime())) {
                    nextCursor = `${createdAt.toISOString()}|${last._id.toString()}`;
                }
            }
        }

        return { total, notifications, nextCursor };
    }

    async getAutomationNotificationSummary(opts: {
        email?: string;
        from?: Date;
        to?: Date;
        types?: string[];
        deliveredOnly?: boolean;
    }) {
        const types =
            opts.types && opts.types.length
                ? opts.types
                : (AUTOMATION_NOTIFICATION_TYPES as unknown as string[]);

        const cond: any = { type: { $in: types } };

        if (opts.email) {
            cond.email = this.normalizeEmail(opts.email);
        }

        if (opts.deliveredOnly !== false) {
            cond.pushed = true;
        }

        if (opts.from || opts.to) {
            cond.createdAt = {};
            if (opts.from) cond.createdAt.$gte = opts.from;
            if (opts.to) cond.createdAt.$lte = opts.to;
        }

        const rows = await this.findAggregate<{
            _id: string;
            count: number;
            title?: string;
            lastCreatedAt?: Date;
        }>([
            { $match: cond },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 },
                    title: { $first: "$title" },
                    lastCreatedAt: { $first: "$createdAt" },
                },
            },
            { $sort: { count: -1 } },
        ]);

        const channels = rows.map((row) => ({
            channel: row._id,
            count: row.count,
            title: row.title || "",
            lastCreatedAt: row.lastCreatedAt || null,
        }));

        return { total: channels.reduce((sum, item) => sum + item.count, 0), channels };
    }

    /**
     * 🔢 Total count of notifications
     */
    async countUserNotifications(email: string): Promise<number> {
        return await this.findCount({ email });
    }

    /**
     * 🔘 Mark single notification as read
     */
    async markAsRead(notificationId: string, email: string) {
        return this.updatePart({ notificationId: notificationId, email }, { $set: { read: true } });
    }

    /**
     * ✅ Mark all as read
     */
    async markAllAsRead(email: string) {
        return this.updateMany({ email, read: false }, { $set: { read: true } });
    }

    /**
     * ❌ Delete one notification
     */
    async deleteNotification(notificationId: string, email: string) {
        return this.deleteOne({ notificationId: notificationId, email });
    }

    /**
     * 🔔 Count unread notifications
     */
    async getUnreadCount(email: string) {
        return this.findCount({ email, read: false });
    }

    async getElectricReward(email: string) {
        return this.findOne({ email, type: "rewards_electric" });
    }

    async getNewReferralCode(email: string) {
        return this.findOne({ email, type: "new_referral_notification" });
    }

    async getNewReferralCode2(email: string) {
        return this.findOne({ email, type: "new_referral_notification_1" });
    }

    async getNewReferralCodeDate(email: string) {
        const now = new Date();
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);        // 00:00:00.000 UTC today
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1); // 00:00:00.000 UTC tomorrow

        return this.findOne({
            email,
            type: "new_referral_notification_1",
            createdAt: { $gte: start, $lt: end },
        });
    }

    /**
     * Admin notification methods
     */
    async sendAdminNotificationBatch(users: any[], notificationData: any): Promise<any> {
        const results = await Promise.allSettled(
            users.map(user => this.sendAdminNotificationDirect(user, notificationData))
        );
        console.log("Results", results);

        return {
            successCount: results.filter(r => r.status === 'fulfilled').length,
            failedCount: results.filter(r => r.status === 'rejected').length,
            errors: results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason?.message)
        };
    }

    async sendAdminNotificationDirect(user: any, notificationData: any): Promise<any> {
        const title = notificationData.title;
        const body = notificationData.body;
        const imageUrl = notificationData.imageUrl || "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/Push+Notification+Graphics.png";
        // 1) create a new inbox row

        let notif = await this.create({
            userId: user._id,
            email: user.email,
            notificationId: uuidv1(),
            type: notificationData.type || 'admin_announcement',
            title,
            body,
            read: false,
            pushed: false,
            createdAt: new Date(),
        } as Notification);

        const notificationId = notif.notificationId;

        // 2) If no token, keep it in inbox only (don't attempt push)
        if (!user.fcmToken) {
            console.warn(`No FCM token found for user ${user.email}.`);
            return { status: 200, data: "no-token", notificationId };
        }

        // 3) Atomically "claim" this notification for sending by flipping pushed:false → true
        const claimRes: any = await this.updatePart(
            { _id: notif._id, pushed: false }, // CAS guard: only if still unpushed
            {
                $set: {
                    pushed: true,
                    pushedLottoAirdrop: true,
                    pushedLottoAirdropDate: new Date(),
                },
            }
        );


        const claimed = claimRes && (claimRes.modifiedCount > 0 || (claimRes as any).nModified > 0);

        if (!claimed) {
            // Someone else already sent/claimed this notification
            return { status: 200, data: "already-sent", notificationId };
        }

        // 4) Send the actual push notification
        try {
            await sendFirebaseNotification(user.fcmToken, title, body, imageUrl);
            return { status: 200, data: "sent", notificationId };
        } catch (error: any) {
            // 5) Send failed → roll back pushed so it can be retried later
            await this.updatePart(
                { _id: notif._id, pushed: true },
                {
                    $set: { pushed: false, pushedLottoAirdrop: false },
                    $unset: { pushedLottoAirdropDate: "" },
                }
            );
            console.error(`Failed to send notification to ${user.email}:`, error);
            return { status: 500, data: error.message, notificationId };
        }
    }

    async sendToAllUsersViaTopic(notificationData: any): Promise<void> {
        const topic = 'all-users';
        await sendFirebaseTopicNotification(
            topic,
            notificationData.title,
            notificationData.body,
            notificationData.imageUrl,
            { type: notificationData.type }
        );
    }

}
