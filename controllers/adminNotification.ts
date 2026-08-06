import { Request, Response } from "express";
import { z } from "zod";
import { NotificationPrefsService } from "../services/notificationPrefs.service";
import { TemplateNotifyService } from "../services/templateNotify.service";
import { sendAdminNotification } from "../services/adminNotification.service";
import { UserService } from "../services/user.service";
import {
    ENFORCE_TEST_GUARD,
    TEST_TOPIC,
    TEST_ALLOWED_EMAILS,
    isTestAllowed,
} from "../config/notifyTestGuard";

const prefsSvc = new NotificationPrefsService();
const templateSvc = new TemplateNotifyService();
const dataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const notifSchema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    imageUrl: z.string().url().optional(),
    data: z.record(z.string(), dataValueSchema).optional(),
    clickAction: z.string().optional(),
    ttlSeconds: z.number().int().positive().optional(),
    androidChannelId: z.string().optional(),
}).strict();

const topicBody = z.object({ email: z.string().email(), topic: z.string().min(1) });
const emailOnly = z.object({ email: z.string().email() });
const pushBody = z.object({ email: z.string().email(), enabled: z.boolean() });
const catBody = z.object({
    email: z.string().email(),
    category: z.enum(["marketing", "system", "chat"]),
    enabled: z.boolean(),
});

const registerSchema = z.object({
    token: z.string().min(10),
    topics: z.array(z.string()).optional(),
    email: z.string().email().optional(),
});
const unregisterSchema = z.object({
    token: z.string().min(10).optional(),
    topics: z.array(z.string()).optional(),
    email: z.string().email().optional(),
});

const audienceSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("topic"), topic: z.string().min(1) }),
    z.object({
        type: z.literal("tokens"),
        tokens: z.array(z.string()).optional(),
        emails: z.array(z.string().email()).optional(),
    }),
]);

const valueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const overridesSchema = z.object({
    title: z.string().optional(),
    body: z.string().optional(),
    imageUrl: z.string().url().optional(),
    clickAction: z.string().optional(),
    data: z.record(z.string(), valueSchema).optional(),
}).partial();


const bodySchema = z.object({
    templateType: z.string().min(1),
    vars: z.record(z.string(), valueSchema).optional(),   // variables to fill {{placeholders}}
    overrides: overridesSchema.optional(),                 // optional per-send override
    audience: audienceSchema,
    ttlSeconds: z.number().int().positive().optional(),
    androidChannelId: z.string().optional(),
    dryRun: z.boolean().optional(),
});

function getActorEmail(req: Request, fallback?: string) {
    const fromAuth = (req as any)?.user?.email || (req as any)?.auth?.email;
    return String(fromAuth || fallback || "").toLowerCase();
}

function denyIfNotAllowed(res: Response, email: string | undefined | null) {
    if (ENFORCE_TEST_GUARD && !isTestAllowed(email)) {
        res.status(403).json({ ok: false, error: "not allowed for test recipients" });
        return true;
    }
    return false;
}

// ---------- USER-FACING ----------
export async function registerToken(req: Request, res: Response) {
    const { token, topics, email } = registerSchema.parse(req.body);
    const actor = getActorEmail(req, email);
    if (denyIfNotAllowed(res, actor)) return;

    // Force register to TEST_TOPIC when guard is on
    const defaultTopics = ENFORCE_TEST_GUARD
        ? [TEST_TOPIC]
        : (topics ?? [process.env.NOTIFY_ALL_TOPIC || "all-users"]);

    await prefsSvc.registerUserToken(actor, token, defaultTopics);
    res.json({ ok: true, topics: defaultTopics });
}

export async function unregisterToken(req: Request, res: Response) {
    const { token, topics, email } = unregisterSchema.parse(req.body);
    const actor = getActorEmail(req, email);
    if (denyIfNotAllowed(res, actor)) return;

    // If guarded, only unsubscribe from TEST_TOPIC (ignore others)
    const t = ENFORCE_TEST_GUARD ? [TEST_TOPIC] : topics;
    const out = await prefsSvc.unregisterTokenForUser(actor, token, t);
    res.json({ ok: true, ...out });
}

// Topic + prefs (keep but guard emails; and force topic to TEST_TOPIC if guard on)
export async function subscribeTopic(req: Request, res: Response) {
    const { email, topic } = topicBody.parse(req.body);
    if (denyIfNotAllowed(res, email)) return;

    const t = ENFORCE_TEST_GUARD ? TEST_TOPIC : topic;
    const out = await prefsSvc.subscribeUserToTopic(email, t);
    res.json({ ok: true, topic: t, ...out });
}

export async function unsubscribeTopic(req: Request, res: Response) {
    const { email, topic } = topicBody.parse(req.body);
    if (denyIfNotAllowed(res, email)) return;

    const t = ENFORCE_TEST_GUARD ? TEST_TOPIC : topic;
    const out = await prefsSvc.unsubscribeUserFromTopic(email, t);
    res.json({ ok: true, topic: t, ...out });
}

export async function unsubscribeAllTopics(req: Request, res: Response) {
    const body = z.object({
        email: z.string().email(),
        topics: z.array(z.string()).optional()
    }).parse(req.body);

    const topics = ENFORCE_TEST_GUARD ? [TEST_TOPIC] : body.topics;

    const out = await prefsSvc.unsubscribeUserFromAllTopics(body.email, topics);

    const { topics: _ignored, ...rest } = out;   // drop out.topics if present

    return res.json({ ok: true, topics, ...rest });
}


export async function setPushEnabled(req: Request, res: Response) {
    const { email, enabled } = pushBody.parse(req.body);
    if (denyIfNotAllowed(res, email)) return;

    await prefsSvc.setUserPushEnabled(email, enabled);
    res.json({ ok: true });
}

export async function setCategoryPref(req: Request, res: Response) {
    const { email, category, enabled } = catBody.parse(req.body);
    if (denyIfNotAllowed(res, email)) return;

    await prefsSvc.setUserCategory(email, category, enabled);
    res.json({ ok: true });
}

// ---------- ADMIN-ONLY ----------
const ALL_TOPIC = process.env.NOTIFY_ALL_TOPIC || "all-users";

export async function adminNotifyAllController(req: Request, res: Response) {
    const notif = notifSchema.parse(req.body);
    const mode = (String(req.query.mode || "topic").toLowerCase() as "topic" | "tokens");
    const dryRun = String(req.query.dryRun || "false").toLowerCase() === "true";

    if (mode === "topic") {
        // Force test topic in guard mode
        const topic = ENFORCE_TEST_GUARD ? TEST_TOPIC : ALL_TOPIC;
        const result = await sendAdminNotification({ type: "topic", topic }, notif, { dryRun });
        return res.status(200).json({ ok: true, mode, topic, result });
    }

    // tokens mode: when guarded, fetch only allowed users
    const userService = new UserService();
    const users = ENFORCE_TEST_GUARD
        ? await userService.findSelect({ email: { $in: Array.from(TEST_ALLOWED_EMAILS) } }, { fcmToken: 1 } as any)
        : await userService.findSelect({}, { fcmToken: 1 } as any);

    const tokens = users.map((u: any) => u?.fcmToken).filter(Boolean);

    if (!tokens.length) {
        return res.status(200).json({
            ok: true,
            mode,
            requested: 0,
            message: ENFORCE_TEST_GUARD
                ? "No tokens found for allowed test emails."
                : "No tokens found.",
        });
    }

    const result = await sendAdminNotification({ type: "tokens", tokens }, notif, { dryRun });
    return res.status(200).json({ ok: true, mode, requested: tokens.length, result });
}

export async function adminNotifyByTemplate(req: Request, res: Response) {
    try {
        const { templateType, vars = {}, overrides = {}, audience, ttlSeconds, androidChannelId, dryRun } = bodySchema.parse(req.body);

        const safeOverrides = {
            ...overrides,
            data: overrides?.data
                ? Object.fromEntries(
                    Object.entries(overrides.data).map(([k, v]) => [k, String(v ?? "")])
                )
                : undefined,
        };

        // Build notification content by rendering template with vars and overrides
        const notifBase = await templateSvc.buildFromType(templateType, vars, safeOverrides);

        // Optional runtime fields (not part of template)
        const notif = { ...notifBase, ttlSeconds, androidChannelId };

        // Apply test guard if enabled
        if (ENFORCE_TEST_GUARD) {
            if (audience.type === "topic") {
                const result = await sendAdminNotification({ type: "topic", topic: TEST_TOPIC }, notif, { dryRun });
                return res.status(200).json({ ok: true, guard: true, topic: TEST_TOPIC, result });
            } else {
                const userService = new UserService();
                const allowedEmails = (audience.emails ?? []).map((e) => e.toLowerCase()).filter((e) => TEST_ALLOWED_EMAILS.has(e));
                const emailUsers = allowedEmails.length
                    ? await userService.findSelect({ email: { $in: allowedEmails } }, { fcmToken: 1 } as any)
                    : await userService.findSelect({ email: { $in: Array.from(TEST_ALLOWED_EMAILS) } }, { fcmToken: 1 } as any);

                const tokensFromEmails = emailUsers.map((u: any) => u?.fcmToken).filter(Boolean);
                const tokens = Array.from(new Set([...(audience.tokens ?? []), ...tokensFromEmails]));
                if (!tokens.length) return res.status(200).json({ ok: true, guard: true, requested: 0, message: "No tokens for test emails." });

                const result = await sendAdminNotification({ type: "tokens", tokens }, notif, { dryRun });
                return res.status(200).json({ ok: true, guard: true, requested: tokens.length, result });
            }
        }

        // Normal flow (no guard)
        const result = await sendAdminNotification(audience, notif, { dryRun });
        return res.status(200).json({ ok: true, result });
    } catch (err: any) {
        console.error("adminNotifyByTemplate error:", err);
        return res.status(400).json({ ok: false, error: err?.message ?? String(err) });
    }
}