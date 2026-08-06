import { ChatMessage } from "../data/ChatMessage";
import CharMessageSchema, { ChatMessageModel } from "../models/ChatMessage";
import { UserService } from "./user.service";
import { ServiceBase } from "./base";
import mongoose from 'mongoose';
import { UserRoleTypes } from "../data/user";
import { randomUUID } from "crypto";
const MSG_TIME_EXPR = { $ifNull: ["$timestamp", { $toDate: "$_id" }] };
const userService = new UserService();
export class ChatMessageService extends ServiceBase<ChatMessage, ChatMessageModel> {
    constructor() {
        super(CharMessageSchema, "ChatMessage");
    }

    private getDateFromObjectId(id: any): Date | null {
        if (!id) return null;
        try {
            // Mongoose ObjectId has getTimestamp()
            if (typeof id.getTimestamp === "function") return id.getTimestamp();
        } catch { }
        const s = typeof id === "string" ? id : id?.toString?.();
        if (s && /^[a-fA-F0-9]{24}$/.test(s)) {
            const seconds = parseInt(s.substring(0, 8), 16);
            return new Date(seconds * 1000);
        }
        return null;
    }

    private objectIdFromDate(d: Date): mongoose.Types.ObjectId {
        // Build an ObjectId whose time = d (seconds precision)
        const secs = Math.floor(d.getTime() / 1000).toString(16).padStart(8, "0");
        return new mongoose.Types.ObjectId(secs + "0000000000000000");
    }

    private normalizeLowerList(list?: string[]): string[] {
        if (!Array.isArray(list)) return [];
        const lowered = list
            .map((v) => String(v || "").trim().toLowerCase())
            .filter(Boolean);
        return Array.from(new Set(lowered));
    }

    private buildBlockedIncomingFilter(meLower: string, excludeSenders: string[]) {
        if (!excludeSenders.length) return null;
        return {
            $or: [
                { receiverEmail: { $ne: meLower } },
                { email: { $nin: excludeSenders } },
            ],
        };
    }

    // Message methods
    async sendMessage(message: ChatMessage): Promise<ChatMessage> {
        try {
            if (!message) {
                console.error("[sendMessage] Message payload is required");
                throw new Error("Message payload is required");
            }

            // Ensure required fields are present
            if (!message.email) {
                console.error("[sendMessage] Sender email is required");
                throw new Error("Sender email is required");
            }

            // Ensure messageId is set
            if (!message.messageId) {
                message.messageId = randomUUID();
            }

            if (message.clientId) {
                const existing = await this.findOne({
                    email: message.email,
                    clientId: message.clientId,
                });
                if (existing) {
                    return existing;
                }
            }

            // Ensure timestamp is set
            if (!message.timestamp) {
                message.timestamp = new Date();
            }

            console.log("[sendMessage] Creating message", {
                messageId: message.messageId,
                email: message.email,
                receiverEmail: message.receiverEmail,
                groupId: message.groupId,
                hasMessage: !!message.message,
                hasFile: !!message.fileUrl
            });

            const newMessage = message;
            let saved: ChatMessage | undefined;
            try {
                saved = await this.create(newMessage);
            } catch (error: any) {
                if (message.clientId && error?.code === 11000) {
                    const existing = await this.findOne({
                        email: message.email,
                        clientId: message.clientId,
                    });
                    if (existing) {
                        return existing;
                    }
                }
                throw error;
            }

            if (!saved) {
                console.error("[sendMessage] Failed to create message in database");
                throw new Error("Failed to save message to database");
            }

            console.log("[sendMessage] Message saved successfully", {
                _id: (saved as any)?._id,
                messageId: (saved as any)?.messageId || message.messageId,
                email: (saved as any)?.email,
                groupId: (saved as any)?.groupId
            });

            return saved;
        } catch (error: any) {
            console.error("[sendMessage] Error saving message:", error);
            throw error;
        }
    }

    async appendReplySummary(
        original: Pick<ChatMessage, "messageId" | "_id">,
        reply: {
            messageId: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            message?: string;
            fileUrl?: string;
            fileType?: ChatMessage["fileType"];
            timestamp?: Date;
        }
    ) {
        if (!original) return;
        const filter: any = original?.messageId
            ? { messageId: original.messageId }
            : { _id: original._id };

        if (!filter?.messageId && !filter?._id) return;

        await this.updatePart(
            filter,
            {
                $push: { replies: reply },
                $inc: { replyCount: 1 },
            }
        );
    }

    async getMessagesByGroup(
        groupId: string,
        limit = 50,
        opts?: { excludeSenderEmails?: string[] }
    ): Promise<ChatMessage[]> {
        try {
            if (!groupId) {
                console.error("[getMessagesByGroup] groupId is required");
                return [];
            }

            // Use a more robust sort: prefer timestamp, fallback to _id
            const sort: any = { 
                timestamp: -1,  // Sort by timestamp descending
                _id: -1        // Fallback to _id for messages without timestamp
            };

            const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);

            // Ensure groupId is a string and matches exactly
            const condition: any = {
                groupId: String(groupId).trim()
            };
            if (excludeSenders.length) {
                condition.email = { $nin: excludeSenders };
            }

            console.log("[getMessagesByGroup] Fetching messages", { groupId, limit, condition });

            const messages = await this.findPaginated(
                limit,
                sort,
                condition,
                {}                // Select all fields (empty select query)
            );

            console.log("[getMessagesByGroup] Found messages", { 
                groupId, 
                count: messages?.length || 0,
                sampleIds: messages?.slice(0, 3).map((m: any) => m._id || m.messageId)
            });

            return this.processMessagesForResponse(messages || []);
        } catch (error) {
            console.error("[getMessagesByGroup] Error fetching group messages:", error);
            return [];
        }
    }

    async markMessagesAsRead(messageIds: string[], userId: string) {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return { matchedCount: 0, modifiedCount: 0 };

        // Only mark as read the messages I RECEIVED (i.e., not sent by me), and only unread ones
        const filter: any = {
            _id: { $in: messageIds },
            userId: { $ne: userId },
            isRead: false,
        };

        // If you want to avoid touching group messages here (DMs only), uncomment:
        // filter.groupId = { $exists: false };

        // Use the repo's bulk update
        const result = await (this as any).updateMany(filter, { $set: { isRead: true } });
        // If your repo returns the raw Mongo result:
        return {
            matchedCount: result?.matchedCount ?? result?.n ?? 0,
            modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0,
        };
    }

    async markDirectMessagesAsReadForEmail(messageIds: string[], email: string) {
        if (!Array.isArray(messageIds) || messageIds.length === 0) return { matchedCount: 0, modifiedCount: 0 };
        const me = String(email || "").trim().toLowerCase();
        if (!me) return { matchedCount: 0, modifiedCount: 0 };
        const objectIds = messageIds
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));
        const idFilter: any = objectIds.length
            ? { $or: [{ _id: { $in: objectIds } }, { messageId: { $in: messageIds } }] }
            : { messageId: { $in: messageIds } };

        const result = await (this as any).updateMany(
            {
                ...idFilter,
                receiverEmail: me,
                isRead: false,
            },
            { $set: { isRead: true } }
        );
        return {
            matchedCount: result?.matchedCount ?? result?.n ?? 0,
            modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0,
        };
    }

    async findWithNotifications(messageIds: string[], readerUserId: string) {
        return this.find(
            {
                _id: { $in: messageIds },
                userId: { $ne: readerUserId },                // only messages the reader received
                notificationId: { $exists: true, $ne: null }, // only those that have notifications
            }
        );
    }

    async countGroupMessages(
        groupId: string,
        opts?: { unreadOnly?: boolean; me?: string }
    ): Promise<number> {
        const condition: any = { groupId };

        if (opts?.unreadOnly) {
            condition.isRead = false;
            if (opts?.me) {
                // don't count my own messages as "unread for me"
                condition.email = { $ne: opts.me };
            }
        }

        return this.findCount(condition);
    }

    async countGroupUnreadForUser(
        groupId: string,
        email: string,
        lastReadAt: Date,
        opts?: { excludeSenderEmails?: string[] }
    ): Promise<number> {
        const me = String(email || "").trim().toLowerCase();
        const cutoffOid = this.objectIdFromDate(lastReadAt);
        const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);
        const emailCond: any = { $ne: me };
        if (excludeSenders.length) {
            emailCond.$nin = excludeSenders;
        }

        const cond: any = {
            groupId,
            email: emailCond,
            $or: [
                { timestamp: { $gt: lastReadAt } },
                {
                    $and: [
                        { $or: [{ timestamp: { $exists: false } }, { timestamp: null }] },
                        { _id: { $gt: cutoffOid } },
                    ],
                },
            ],
        };

        return this.findCount(cond);
    }

    async countDirectMessages(
        me: string,
        opts?: { peer?: string; unreadOnly?: boolean; excludeSenderEmails?: string[] }
    ): Promise<number> {
        const meL = String(me || "").trim().toLowerCase();
        const peerL = String(opts?.peer || "").trim().toLowerCase();
        const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);

        // DM-only (covers: missing, null, empty)
        const dmOnly = {
            $or: [
                { groupId: { $exists: false } },
                { groupId: null },
                { groupId: "" }
            ]
        };

        const clauses: any[] = [dmOnly];

        if (peerL) {
            clauses.push({
                $or: [
                    { email: meL, receiverEmail: peerL },
                    { email: peerL, receiverEmail: meL }
                ]
            });
        } else {
            clauses.push({ $or: [{ email: meL }, { receiverEmail: meL }] });
        }

        if (opts?.unreadOnly) {
            const unreadCond: any = { isRead: false, receiverEmail: meL };
            if (peerL) unreadCond.email = peerL;
            clauses.push(unreadCond);
        }

        const blockFilter = this.buildBlockedIncomingFilter(meL, excludeSenders);
        if (blockFilter) clauses.push(blockFilter);

        const query = clauses.length === 1 ? clauses[0] : { $and: clauses };
        const count = await this.findCount(query);
        return count;
    }


    async getMessagesForUser(
        email: string,
        opts?: { excludeSenderEmails?: string[] }
    ): Promise<ChatMessage[]> {
        const meL = String(email || "").trim().toLowerCase();
        const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);
        const dmOnly = {
            $or: [
                { groupId: { $exists: false } },
                { groupId: null },
                { groupId: "" }
            ]
        };

        const clauses: any[] = [
            dmOnly,
            {
                $or: [
                    { email: meL },
                    { receiverEmail: meL }
                ]
            }
        ];

        const blockFilter = this.buildBlockedIncomingFilter(meL, excludeSenders);
        if (blockFilter) clauses.push(blockFilter);

        const condition = clauses.length === 1 ? clauses[0] : { $and: clauses };
        const sort = { timestamp: -1 };

        const messages = await this.findPaginated(100, sort, condition, null); // null = no select projection
        return this.processMessagesForResponse(messages);
    }

    async getLastMessages(
        currentUserEmail: string,
        opts?: { excludeSenderEmails?: string[]; limit?: number }
    ) {
        try {
            const meL = String(currentUserEmail || "").trim().toLowerCase();
            const limit = Math.min(20, Math.max(1, Number(opts?.limit || 5)));
            const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);
            const dmOnly = {
                $or: [
                    { groupId: { $exists: false } },
                    { groupId: null },
                    { groupId: "" }
                ]
            };
            const clauses: any[] = [
                dmOnly,
                {
                    $or: [
                        { email: meL },
                        { receiverEmail: meL }
                    ]
                }
            ];
            const blockFilter = this.buildBlockedIncomingFilter(meL, excludeSenders);
            if (blockFilter) clauses.push(blockFilter);
            const condition = clauses.length === 1 ? clauses[0] : { $and: clauses };

            const recentWindowSize = Math.max(limit * 10, limit);
            const recentMessages = await this.findPaginated(
                recentWindowSize,
                { timestamp: -1 },
                condition,
                null
            );

            // Group messages by conversation (groupId)
            const conversations = new Map<string, any>();

            recentMessages.forEach(msg => {
                const groupId = [msg.email, msg.receiverEmail].sort().join('_');

                // If conversation doesn't exist in map OR current message is newer
                if (!conversations.has(groupId)) {
                    conversations.set(groupId, msg);
                } else {
                    const existing = conversations.get(groupId);
                    const existingTimestamp = new Date(existing.timestamp);
                    let msgTimestamp = msg.timestamp || new Date(0);
                    const currentTimestamp = new Date(msgTimestamp);

                    if (currentTimestamp > existingTimestamp) {
                        conversations.set(groupId, msg);
                    }
                }
            });

            const lastMessages = Array.from(conversations.values())
                .sort((left, right) => {
                    const leftTime = new Date(left?.timestamp || 0).getTime();
                    const rightTime = new Date(right?.timestamp || 0).getTime();
                    return rightTime - leftTime;
                })
                .slice(0, limit);
            return this.processMessagesForResponse(lastMessages);
        } catch (error) {
            return [];
        }
    }

    // src/services/chatmessage.service.ts (inside ChatMessageService)
    async countGroupReadForUser(groupId: string, email: string, lastReadAt: Date): Promise<number> {
        const me = String(email || "").trim().toLowerCase();
        const cutoffOid = this.objectIdFromDate(lastReadAt);

        // "Read" means: messages in this group, sent by others, that are NOT newer than lastReadAt.
        // i.e., timestamp <= lastReadAt OR (no timestamp) AND _id <= cutoff
        const cond: any = {
            groupId,
            email: { $ne: me },
            $or: [
                { timestamp: { $lte: lastReadAt } },
                {
                    $and: [
                        { $or: [{ timestamp: { $exists: false } }, { timestamp: null }] },
                        { _id: { $lte: cutoffOid } },
                    ],
                },
            ],
        };

        return this.findCount(cond);
    }


    async getGroupMessagesPaged(
        groupId: string,
        opts: { limit: number; beforeId?: string; afterId?: string; excludeSenderEmails?: string[] }
    ): Promise<{ messages: ChatMessage[]; nextBeforeId?: string; nextAfterId?: string; hasMoreOlder: boolean; hasMoreNewer: boolean; }> {
        const { limit, beforeId, afterId, excludeSenderEmails } = opts;
        const excludeSenders = this.normalizeLowerList(excludeSenderEmails);

        const cond: any = { groupId };
        if (excludeSenders.length) {
            cond.email = { $nin: excludeSenders };
        }
        const toId = (id: string) => {
            try { return new mongoose.Types.ObjectId(id); } catch { return null; }
        };

        let sort: any = { _id: -1 }; // newest-first by default
        if (beforeId) {
            const oid = toId(beforeId);
            if (oid) cond._id = { $lt: oid };
        } else if (afterId) {
            // when fetching newer messages, we collect ascending then flip
            const oid = toId(afterId);
            if (oid) cond._id = { $gt: oid };
            sort = { _id: 1 };
        }

        // fetch +1 to detect "has more"
        const rows = await this.findPaginated(limit + 1, sort, cond, {});
        let messages = rows;

        // reverse if we fetched ascending
        const fetchedAscending = !!afterId;
        if (fetchedAscending) messages = [...rows].reverse();

        // trim to requested limit
        const over = messages.length > limit;
        if (over) messages = messages.slice(0, limit);

        // Process messages to replace deleted content
        const processedMessages = this.processMessagesForResponse(messages);

        // cursors
        const oldest = messages[messages.length - 1];
        const newest = messages[0];

        return {
            messages: processedMessages,
            nextBeforeId: oldest?._id?.toString(),
            nextAfterId: newest?._id?.toString(),
            // "over" indicates there are more records beyond this page.
            hasMoreOlder: over,
            hasMoreNewer: over
        };
    }

    async getDirectMessagesPaged(
        me: string,
        opts: {
            limit: number;
            peer?: string;
            beforeId?: string;
            afterId?: string;
            excludeSenderEmails?: string[];
        }
    ): Promise<{ messages: ChatMessage[]; nextBeforeId?: string; nextAfterId?: string; hasMoreOlder: boolean; hasMoreNewer: boolean; }> {
        const { limit, peer, beforeId, afterId, excludeSenderEmails } = opts;
        const meL = String(me || "").trim().toLowerCase();
        const peerL = String(peer || "").trim().toLowerCase();
        const excludeSenders = this.normalizeLowerList(excludeSenderEmails);

        const dmOnly = {
            $or: [
                { groupId: { $exists: false } },
                { groupId: null },
                { groupId: "" },
            ],
        };
        const participants = peerL
            ? {
                $or: [
                    { email: meL, receiverEmail: peerL },
                    { email: peerL, receiverEmail: meL },
                ],
            }
            : { $or: [{ email: meL }, { receiverEmail: meL }] };

        const cond: any = { $and: [dmOnly, participants] };
        const blockFilter = this.buildBlockedIncomingFilter(meL, excludeSenders);
        if (blockFilter) {
            cond.$and.push(blockFilter);
        }

        const toId = (id: string) => {
            try { return new mongoose.Types.ObjectId(id); } catch { return null; }
        };

        let sort: any = { _id: -1 };
        if (beforeId) {
            const oid = toId(beforeId);
            if (oid) cond._id = { $lt: oid };
        } else if (afterId) {
            const oid = toId(afterId);
            if (oid) cond._id = { $gt: oid };
            sort = { _id: 1 };
        }

        const rows = await this.findPaginated(limit + 1, sort, cond, {});
        let messages = rows;
        const fetchedAscending = !!afterId;
        if (fetchedAscending) messages = [...rows].reverse();

        const over = messages.length > limit;
        if (over) messages = messages.slice(0, limit);

        const processedMessages = this.processMessagesForResponse(messages);
        const oldest = messages[messages.length - 1];
        const newest = messages[0];

        return {
            messages: processedMessages,
            nextBeforeId: oldest?._id?.toString(),
            nextAfterId: newest?._id?.toString(),
            hasMoreOlder: over,
            hasMoreNewer: over,
        };
    }

    async getLatestGroupTimestamp(groupId: string): Promise<Date | null> {
        // 1) newest doc with a timestamp
        const withTs = await this.findPaginated(
            1,
            { timestamp: -1, _id: -1 },
            { groupId, timestamp: { $exists: true, $ne: null } },
            { timestamp: 1, _id: 1 }
        );
        const ts = withTs?.[0]?.timestamp;
        if (ts) return new Date(ts);

        // 2) fallback: newest by _id
        const newestById = await this.findPaginated(1, { _id: -1 }, { groupId }, { _id: 1 });
        const id = newestById?.[0]?._id ?? (newestById?.[0] as any)?.id;
        return this.getDateFromObjectId(id);
    }

    async directUnreadSummary(
        me: string,
        opts?: { excludeSenderEmails?: string[] }
    ): Promise<{ total: number; perPeer: { peerEmail: string; count: number }[] }> {
        const meL = String(me || "").trim().toLowerCase();
        const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);
        const match: any = {
            receiverEmail: meL,
            isRead: false,
            $or: [
                { groupId: { $exists: false } },
                { groupId: null },
                { groupId: "" },
            ],
        };
        if (excludeSenders.length) {
            match.email = { $nin: excludeSenders };
        }
        const rows = await (this as any).aggregate([
            { $match: match },
            { $group: { _id: "$email", count: { $sum: 1 } } },
        ]);

        const perPeer = rows.map((r: any) => ({ peerEmail: r._id, count: r.count }));
        const total = perPeer.reduce((s: any, r: any) => s + r.count, 0);
        return { total, perPeer };
    }

    async directUnreadForPeer(
        me: string,
        peer: string,
        opts?: { excludeSenderEmails?: string[] }
    ): Promise<number> {
        const meL = String(me || "").trim().toLowerCase();
        const peerL = String(peer || "").trim().toLowerCase();
        const excludeSenders = this.normalizeLowerList(opts?.excludeSenderEmails);
        if (excludeSenders.includes(peerL)) return 0;
        return this.findCount({
            groupId: { $exists: false },
            receiverEmail: meL,
            email: peerL,
            isRead: false,
        });
    }


    public processMessagesForResponse(messages: ChatMessage[]): ChatMessage[] {
        return messages.map(message => {
            const plain = (message as any).toObject ? (message as any).toObject() : message;
            if (plain.isDeleted) {
                return {
                    ...plain,
                    message: "This message was deleted"
                };
            }
            return plain;
        });
    }
    

    async updateMessage(messageId: string, userEmail: string, newMessage: string): Promise<ChatMessage | null> {
        try {
            // Find the message and verify ownership
            const message = await this.findOne({ _id: messageId });
            if (!message || message.isDeleted) {
                throw new Error("Message not found");
            }

            // Check if user owns this message
            if (message.email !== userEmail) {
                throw new Error("You don't have permission to update this message");
            }

            // Update the message
            const updatedMessage = await this.updatePart(
                { _id: messageId },
                {
                    $set: {
                        message: newMessage,
                        isUpdated: true
                    }
                }
            );

            return updatedMessage;
        } catch (error) {
            console.error("Error updating message:", error);
            throw new Error("Failed to update message");
        }
    }

    async deleteMessage(messageId: string, userEmail: string): Promise<ChatMessage | null> {
        try {
            // Find the message
            const message = await this.findOne({ _id: messageId });
            if (!message) {
                throw new Error("Message not found");
            }

            // check if user is admin
            const user = await userService.findOneSelect({ email: userEmail }, { role: 1 });
            if (!user) {
                throw new Error("User not found");
            }

            // Check if user can delete this message (owner or admin)
            const canDelete = message.email == userEmail || user.role == UserRoleTypes.Admin;
            if (!canDelete) {
                throw new Error("You don't have permission to delete this message");
            }

            // Mark as deleted instead of actually deleting
            const deletedMessage = await this.updatePart(
                { _id: messageId },
                {
                    $set: {
                        isDeleted: true,
                    }
                }
            );

            return deletedMessage;
        } catch (error) {
            console.error("Error deleting message:", error);
            throw new Error("Failed to delete message");
        }
    }

    async addReaction(messageId: string, userEmail: string, reactionName: string): Promise<ChatMessage | null> {
        try {
            // Find the message
            const message = await this.findOne({ _id: messageId });
            if (!message) {
                throw new Error("Message not found");
            }

            // Initialize reactions array if it doesn't exist
            const reactions = message.reactions || [];

            // Find existing reaction with the same name
            const existingReactionIndex = reactions.findIndex(r => r.name === reactionName);

            if (existingReactionIndex !== -1) {
                // Reaction exists, check if user already reacted
                const existingReaction = reactions[existingReactionIndex];
                if (existingReaction.users.includes(userEmail)) {
                    throw new Error("You have already reacted with this emoji");
                }

                // Add user to the reaction
                existingReaction.users.push(userEmail);
                existingReaction.count = existingReaction.users.length;
            } else {
                // Create new reaction
                reactions.push({
                    name: reactionName,
                    users: [userEmail],
                    count: 1
                });
            }

            // Update the message with new reactions
            const updatedMessage = await this.updatePart(
                { _id: messageId },
                {
                    $set: {
                        reactions: reactions
                    }
                }
            );

            return updatedMessage;
        } catch (error) {
            console.error("Error adding reaction:", error);
            throw new Error("Failed to add reaction");
        }
    }

    async removeReaction(messageId: string, userEmail: string, reactionName: string): Promise<ChatMessage | null> {
        try {
            // Find the message
            const message = await this.findOne({ _id: messageId });
            if (!message) {
                throw new Error("Message not found");
            }

            // Initialize reactions array if it doesn't exist
            const reactions = message.reactions || [];

            // Find existing reaction with the same name
            const existingReactionIndex = reactions.findIndex(r => r.name === reactionName);

            if (existingReactionIndex === -1) {
                throw new Error("Reaction not found");
            }

            const existingReaction = reactions[existingReactionIndex];

            // Remove user from the reaction
            existingReaction.users = existingReaction.users.filter(email => email !== userEmail);
            existingReaction.count = existingReaction.users.length;

            // Drop reactions nobody is using anymore
            const remainingReactions = reactions.filter(r => r.users.length > 0);

            // Update the message with updated reactions
            const updatedMessage = await this.updatePart(
                { _id: messageId },
                {
                    $set: {
                        reactions: remainingReactions
                    }
                }
            );

            return updatedMessage;
        } catch (error) {
            console.error("Error removing reaction:", error);
            throw new Error("Failed to remove reaction");
        }
    }

}
