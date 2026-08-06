import { getMessaging } from "firebase-admin/messaging";
import { UserService } from "./user.service";

export class NotificationPrefsService {
    constructor(private users = new UserService()) { }

    // Save/update user's fcmToken (login / token refresh) and optionally subscribe topics
    async registerUserToken(email: string, token: string, topics?: string[]) {
        const e = email.toLowerCase();
        await this.users.updatePart({ email: e }, { $set: { fcmToken: token } } as any);

        if (topics?.length) {
            for (const t of topics) {
                try {
                    await getMessaging().subscribeToTopic([token], t);
                } catch (err) {
                    console.error(`subscribeToTopic failed for ${t}`, err);
                }
            }
        }
    }

    async unregisterTokenForUser(email: string, token?: string, topics?: string[]) {
        const e = email.toLowerCase();
        // if token not provided, read user and use its token
        const u = await this.users.findOne({ email: e });
        const tok = token || (u as any)?.fcmToken;
        if (!tok) return { success: 0 };

        // clear DB token
        await this.users.updatePart({ email: e }, { $set: { fcmToken: null } } as any);

        // optional: unsubscribe from provided topics
        if (topics?.length) {
            for (const t of topics) {
                try {
                    await getMessaging().unsubscribeFromTopic([tok], t);
                } catch (err) {
                    console.error(`unsubscribeFromTopic failed for ${t}`, err);
                }
            }
        }

        return { success: 1 };
    }

    async subscribeUserToTopic(email: string, topic: string) {
        const u = await this.users.findOne({ email: email.toLowerCase() });
        if (!u) throw new Error("User not found");
        const tokens = this.extractTokens(u);
        if (tokens.length) await getMessaging().subscribeToTopic(tokens, topic);
        await this.users.updatePart({ email: u.email }, { $addToSet: { "notificationPrefs.topics": topic } });
        return { success: tokens.length };
    }

    async unsubscribeUserFromTopic(email: string, topic: string) {
        const u = await this.users.findOne({ email: email.toLowerCase() });
        if (!u) throw new Error("User not found");
        const tokens = this.extractTokens(u);
        if (tokens.length) await getMessaging().unsubscribeFromTopic(tokens, topic);
        await this.users.updatePart({ email: u.email }, { $pull: { "notificationPrefs.topics": topic } });
        return { success: tokens.length };
    }

    async unsubscribeUserFromAllTopics(email: string, topics?: string[]) {
        const u = await this.users.findOne({ email: email.toLowerCase() });
        if (!u) throw new Error("User not found");
        const token = (u as any)?.fcmToken;

        if (token && Array.isArray(topics) && topics.length) {
            for (const t of topics) await getMessaging().unsubscribeFromTopic([token], t);
            return { success: 1, topics };
        }
        // No stored topics → nothing to do
        return { success: token ? 1 : 0, topics: [] };
    }

    async setUserPushEnabled(email: string, enabled: boolean) {
        await this.users.updatePart({ email: email.toLowerCase() }, { $set: { "notificationPrefs.pushEnabled": enabled } });
    }

    async setUserCategory(email: string, category: "marketing" | "system" | "chat", enabled: boolean) {
        await this.users.updatePart({ email: email.toLowerCase() }, { $set: { [`notificationPrefs.categories.${category}`]: enabled } });
    }

    private extractTokens(user: any): string[] {
        const arr: string[] = [];
        if (user?.fcmToken) arr.push(user.fcmToken);
        if (Array.isArray(user?.fcmTokens)) arr.push(...user.fcmTokens);
        return [...new Set(arr.filter(Boolean))];
    }
}
