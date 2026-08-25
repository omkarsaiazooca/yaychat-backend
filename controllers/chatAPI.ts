// src/controllers/ChatController.ts
import { Request, Response } from "express";
import { ChatMessageService } from "../services/chatmessage.service";
import { UserService } from "../services/user.service";
import { ChatGroupService } from "../services/chatgroups.service";
import { ChatUserBlockService } from "../services/chatUserBlock.service";
import { ChatUserReportService } from "../services/chatUserReport.service";
import * as leoProfanity from "leo-profanity";
import { ChatSocketService, EVERYONE_GROUP_ID } from "../services/chatWebsocket.service";
import { NotificationService } from "../services/notification.service";
import { GroupReadStateService } from "../services/groupReadState.service";
import { BtcyChatGroupBonusService } from "../services/btcyChatGroupBonus.service";
import { subscribeTokensToTopic, unsubscribeTokensFromTopic } from "../helpers/notificationHelper";
import { UserRoleTypes } from "../data/user";
import { enqueueReferralMessageFanout } from "../services/referralMessageQueue.service";
import { deliverChatMessage } from "../services/notificationDelivery.service";
import {
  directConversationId,
  groupConversationId,
} from "../services/notifications/deepLinks";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Types } from "mongoose";
import { randomUUID } from "crypto";

const notificationService: NotificationService = new NotificationService();
const chatService = new ChatMessageService();
const userService = new UserService();
const chatGroupService = new ChatGroupService();
const groupRead = new GroupReadStateService();
const chatUserBlockService = new ChatUserBlockService();
const chatUserReportService = new ChatUserReportService();
const btcyChatGroupBonusService = new BtcyChatGroupBonusService();

// Match your public/global group naming
const DEFAULT_GLOBAL_GROUP_NAME = "Bitcoin Yay General";
const groupTopic = (gid: string) => `group_${gid}`;
type AttachmentFileType = 'image' | 'document' | 'video' | 'pdf' | 'word' | 'file';
const ALLOWED_FILE_TYPES = new Set<AttachmentFileType>(["image", "document", "video", "pdf", "word", "file"]);
const GROUP_MODERATION_SCOPE = "group_moderation";

function isAdminRole(role: any): boolean {
  return role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin;
}

// Helper function to resolve "everyone" groupId to actual UUID
async function resolveGroupId(groupId: string): Promise<{ resolvedId: string; isGlobal: boolean }> {
  if (groupId === EVERYONE_GROUP_ID) {
    const defaultGroup = await chatGroupService.findOne({ 
      isGlobal: true,
      name: DEFAULT_GLOBAL_GROUP_NAME 
    }) || await chatGroupService.findOne({ isGlobal: true });
    
    if (defaultGroup) {
      return { 
        resolvedId: String((defaultGroup as any).groupId),
        isGlobal: true
      };
    }
    // If no global group found, return the constant (fallback)
    return { resolvedId: EVERYONE_GROUP_ID, isGlobal: true };
  }
  
  // For non-everyone groupIds, check if they're global
  const group = await chatGroupService.findOne({ groupId, isGlobal: true });
  return { 
    resolvedId: groupId, 
    isGlobal: !!group 
  };
}

export class ChatController {

  constructor() {
    this.getPresignedUrl = this.getPresignedUrl.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.sendGroupMessage = this.sendGroupMessage.bind(this);
    this.sendReferralMessages = this.sendReferralMessages.bind(this);
    this.replyToMessage = this.replyToMessage.bind(this);
    // bind others you register directly on routes:
    this.setGroupMessagingBlock = this.setGroupMessagingBlock.bind(this);
    this.blockGroupMember = this.blockGroupMember.bind(this);
    this.unblockGroupMember = this.unblockGroupMember.bind(this);
    this.blockUser = this.blockUser.bind(this);
    this.unblockUser = this.unblockUser.bind(this);
    this.getBlockedUsers = this.getBlockedUsers.bind(this);
    this.blockUserDirect = this.blockUserDirect.bind(this);
    this.unblockUserDirect = this.unblockUserDirect.bind(this);
    this.getBlockedUsersDirect = this.getBlockedUsersDirect.bind(this);
    this.reportUser = this.reportUser.bind(this);
    this.getReportedUsers = this.getReportedUsers.bind(this);
    this.getGroupUnreadCount = this.getGroupUnreadCount.bind(this);
    this.markGroupRead = this.markGroupRead.bind(this);
    this.searchUsers = this.searchUsers.bind(this);
    this.getMessages = this.getMessages.bind(this);
    this.getMessagesPaged = this.getMessagesPaged.bind(this);
    this.getLatestMessages = this.getLatestMessages.bind(this);
    this.markAsRead = this.markAsRead.bind(this);
    this.getGroupMessageCount = this.getGroupMessageCount.bind(this);
    this.getMessageCount = this.getMessageCount.bind(this);
    this.getMessageUnreadCount = this.getMessageUnreadCount.bind(this);
    this.getGroupMessages = this.getGroupMessages.bind(this);
    this.getGroupMessagesPaged = this.getGroupMessagesPaged.bind(this);
    this.createReferralGroup = this.createReferralGroup.bind(this);
    this.createCustomGroup = this.createCustomGroup.bind(this);
    this.getUserGroups = this.getUserGroups.bind(this);
    this.joinReferralGroup = this.joinReferralGroup.bind(this);
    this.joinGroup = this.joinGroup.bind(this);
    this.leaveGroup = this.leaveGroup.bind(this);
    this.updateGroup = this.updateGroup.bind(this);
    this.deleteGroup = this.deleteGroup.bind(this);
    this.addGroupMembers = this.addGroupMembers.bind(this);
    this.removeGroupMembers = this.removeGroupMembers.bind(this);
    this.syncGroupMembers = this.syncGroupMembers.bind(this);
    this.getAdminGroupBonusRewards = this.getAdminGroupBonusRewards.bind(this);
    this.getUnreadSummary = this.getUnreadSummary.bind(this);
    this.muteChat = this.muteChat.bind(this);
    this.updateMessage = this.updateMessage.bind(this);
    this.deleteMessage = this.deleteMessage.bind(this);
    this.addReaction = this.addReaction.bind(this);
    this.removeReaction = this.removeReaction.bind(this);
  }

  async getPresignedUrl(req: Request, res: Response) {
    try {
      const fileType = (req.query.fileType as string) || "application/octet-stream";

      // ✅ Allowed prefixes or types
      const allowedPrefixes = ["image/", "video/", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      const isAllowed = allowedPrefixes.some(type => fileType.startsWith(type));

      if (!isAllowed) {
        return res.status(400).json({
          status: 400,
          message: "Invalid file type. Only images, videos, and documents (PDF, DOC, DOCX) are allowed.",
        });
      }

      const extension = fileType.split("/")[1] || "bin";
      const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${extension}`;

      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
        ContentType: fileType,
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return res.status(200).json({
        status: 200,
        data: {
          url, // signed upload URL
          key, // file path
          contentType: fileType,
        },
      });
    } catch (error) {
      console.error("Error generating S3 URL:", error);
      res.status(500).json({ message: "Failed to generate presigned URL" });
    }
  }

  async searchUsers(req: Request, res: Response) {
    try {
      const requesterEmail = String(req.query.email || "").trim().toLowerCase();
      const query = String(req.query.q || "").trim();
      const limitRaw = Number(req.query.limit || 25);
      const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 25, 50));

      if (!requesterEmail) {
        return res.status(400).json({
          status: 400,
          data: { message: "email is required" },
        });
      }

      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matcher = query
        ? {
            $or: [
              { email: { $regex: escaped, $options: "i" } },
              { username: { $regex: escaped, $options: "i" } },
              { firstName: { $regex: escaped, $options: "i" } },
              { lastName: { $regex: escaped, $options: "i" } },
            ],
          }
        : {};

      const users = await userService.findPaginated(
        limit,
        { _id: -1 },
        {
          ...matcher,
          email: { $ne: requesterEmail },
        },
        {
          email: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
          phone: 1,
          profilePic: 1,
        }
      );

      return res.status(200).json({
        status: 200,
        data: users,
      });
    } catch (error) {
      console.error("[chat.searchUsers] error", error);
      return res.status(500).json({
        status: 500,
        data: { message: "Failed to search users" },
      });
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const {
        email,
        message: originalMessage,
        fileUrl,
        fileType,
        replyToMessageId,
        clientId,
      } = req.body;
      let { to } = req.body;

      if (!email) return res.status(400).json({ message: "email is required" });

      const sender = await userService.findOneSelect({ email }, {});
      if (!sender) return res.status(400).json({ message: "Email not registered" });

      let replyMetadata: any;
      let replySourceMessage: any;
      if (replyToMessageId) {
        const originalMessageDoc = await this.findMessageByAnyId(String(replyToMessageId));
        if (!originalMessageDoc) {
          return res.status(404).json({ message: "Original message not found" });
        }
        if (originalMessageDoc.groupId) {
          return res.status(400).json({ message: "Cannot reply to a group message through direct messaging" });
        }

        const participants = [
          String(originalMessageDoc.email || "").trim().toLowerCase(),
          String(originalMessageDoc.receiverEmail || "").trim().toLowerCase(),
        ].filter(Boolean);

        const senderEmailLower = String(email || "").trim().toLowerCase();
        if (!participants.includes(senderEmailLower)) {
          return res.status(403).json({ message: "You do not have access to this conversation" });
        }

        const otherParticipant = participants.find(p => p !== senderEmailLower);
        if (!otherParticipant) {
          return res.status(400).json({ message: "Unable to determine conversation participant" });
        }

        if (to && String(to).trim().toLowerCase() !== otherParticipant) {
          return res.status(400).json({ message: "Reply must be sent to the original participant" });
        }

        to = otherParticipant;
        replySourceMessage = originalMessageDoc;
        replyMetadata = this.buildReplyMetadata(originalMessageDoc as any);
      }

      if (!to) return res.status(400).json({ message: "Recipient email is required" });

      const receiver = await userService.findOneSelect({ email: to }, {});
      if (!receiver) return res.status(400).json({ message: "Receiver not found" });

      const senderLower = String(sender.email || "").trim().toLowerCase();
      const receiverLower = String(receiver.email || "").trim().toLowerCase();
      const receiverBlockedSender = await chatUserBlockService.isBlocked(
        receiverLower,
        senderLower,
        null
      );

      const senderId = (sender as any).id ?? (sender as any)._id;
      const attachment = this.normalizeAttachment(fileUrl, fileType);
      const cleanMessage = leoProfanity.clean(originalMessage || "");
      const messagePayload: any = {
        email: sender.email,
        messageId: randomUUID(),
        clientId,
        receiverEmail: receiver.email,    // <-- make sure your model stores this
        userId: senderId,
        firstName: sender.firstName,
        lastName: sender.lastName,
        message: cleanMessage,
        groupId: undefined,               // direct message
        timestamp: new Date(),
        isRead: false,
        isDeleted: false,
        isUpdated: false,
        replyTo: replyMetadata,
      };

      if (attachment.fileUrl) messagePayload.fileUrl = attachment.fileUrl;
      if (attachment.fileType) messagePayload.fileType = attachment.fileType;

      const saved = await chatService.sendMessage(messagePayload);

      if (!saved) {
        console.error("[sendMessage] Failed to save message", {
          sender: sender.email,
          receiver: receiver.email
        });
        return res.status(500).json({ message: "Failed to save message to database" });
      }

      console.log("[sendMessage] Message saved successfully", {
        id: (saved as any)?._id || (saved as any)?.id,
        messageId: (saved as any)?.messageId,
        sender: sender.email,
        receiver: receiver.email,
        timestamp: (saved as any)?.timestamp
      });

      // realtime: always ack sender; only notify receiver if they have not blocked sender
      if (!receiverBlockedSender) {
        ChatSocketService.emitToUser(receiver.email, "message:new", saved);
      }
      ChatSocketService.emitToUser(sender.email, "message:sent", saved);

      setImmediate(async () => {
        try {
          if (!receiverBlockedSender) {
            try {
              const unreadForReceiverFromSender = await chatService.countDirectMessages(receiver.email, {
                peer: sender.email,
                unreadOnly: true,
              });

              ChatSocketService.emitToUser(receiver.email, "counts:direct", {
                peerEmail: sender.email,
                unread: unreadForReceiverFromSender,
              });
            } catch (countError) {
              console.error("[sendMessage] Failed to update direct unread count", countError);
            }

            try {
              const preview = cleanMessage?.slice(0, 120) || (attachment.fileType ? `[${attachment.fileType}]` : "[attachment]");

              // M6 delivery: reaches every device the receiver is signed in on,
              // honours their notification preferences and mutes, and carries the
              // deep link that opens this conversation on tap.
              const m6 = await deliverChatMessage({
                recipientEmail: receiver.email,
                senderEmail: sender.email,
                senderName: [sender.firstName, sender.lastName].filter(Boolean).join(" ").trim() || sender.email,
                preview,
                conversationId: directConversationId(sender.email),
                messageId: String((saved as any)?.messageId || (saved as any)?._id || ""),
              }).catch((error) => {
                console.error("[sendMessage] M6 delivery failed", error);
                return null;
              });

              // The legacy Indexx notification still owns the inbox row and the
              // `notificationId` stamped on the message. Suppress only its push
              // when M6 already reached a device, so nobody is notified twice.
              // `receiver` is a Mongoose document, so build the stand-in
              // explicitly rather than spreading it.
              const legacyReceiver =
                m6 && m6.delivered > 0
                  ? { _id: (receiver as any)._id, email: receiver.email, fcmToken: null }
                  : receiver;
              const notifRes = await notificationService.sendNotification(legacyReceiver, "chat_message", {
                from: sender.email,
                preview,
              });
              const notificationId = notifRes.notificationId;

              if (notificationId) {
                await chatService.updatePart({ _id: saved._id }, { $set: { notificationId } });
              }

              ChatSocketService.emitToUser(receiver.email, "notification:new", {
                type: "chat_message",
                title: "New message",
                body: preview,
                createdAt: new Date(),
              });
            } catch (notificationError) {
              console.error("[sendMessage] Failed to send notification", notificationError);
            }
          }

          if (replySourceMessage) {
            await chatService.appendReplySummary(
              { messageId: replySourceMessage.messageId, _id: replySourceMessage._id },
              this.buildReplySummary(saved)
            );
          }
        } catch (backgroundError) {
          console.error("[sendMessage] post-save background error", backgroundError);
        }
      });

      return res.status(201).json(saved);
    } catch (error) {
      console.error("Error sending message:", error);
      return res.status(500).json({ message: "Failed to send message" });
    }
  }

  async sendGroupMessage(req: Request, res: Response) {
    try {
      const {
        email,                 // sender (required)
        groupId,               // optional, preferred
        groupName,             // optional
        message: originalMsg,  // optional if fileUrl provided
        fileUrl,
        fileType,              // "image" | "document" | "video"
        replyToMessageId,
        clientId,
      } = req.body;

      if (!email) return res.status(400).json({ message: "email is required" });
      if (!originalMsg && !fileUrl)
        return res.status(400).json({ message: "message or fileUrl is required" });

      // 1) sender exists
      const user = await userService.findOneSelect(
        { email },
        { email: 1, firstName: 1, lastName: 1, role: 1 }
      );
      if (!user) return res.status(400).json({ message: "Email not registered" });

      // 2) resolve target group (id -> name -> default public)
      const targetGroup =
        (groupId && (await chatGroupService.findOne({ groupId }))) ||
        (groupName && (await chatGroupService.findOne({ name: groupName }))) ||
        (await chatGroupService.findOne({ name: DEFAULT_GLOBAL_GROUP_NAME })) ||
        (await chatGroupService.create({
          name: DEFAULT_GLOBAL_GROUP_NAME,
          isGlobal: true,
          groupId: EVERYONE_GROUP_ID,
        } as any));

      if (!targetGroup)
        return res.status(500).json({ message: "Unable to resolve target group" });

      const senderLower = String(user.email || "").trim().toLowerCase();

      // 3) Allow global groups OR groups the sender is a member of
      const isGlobalGroup = (targetGroup as any).isGlobal === true;
      const isMember = ((targetGroup as any).members || []).includes(senderLower) ||
        ((targetGroup as any).members || []).includes(user.email);
      if (!isGlobalGroup && !isMember) {
        return res.status(403).json({
          message: "You are not a member of this group."
        });
      }

      // 4) Check admin-only group permissions
      const senderIsAdmin = user.role === UserRoleTypes.Admin;
      if ((targetGroup as any).isAdminOnly && !senderIsAdmin) {
        return res.status(403).json({
          message: "Only admins can send messages to this group"
        });
      }

      if ((targetGroup as any).isMessagingBlocked && !senderIsAdmin) {
        return res.status(403).json({
          message: "Group messaging is currently blocked by an administrator",
        });
      }

      const resolvedGroupId = String((targetGroup as any).groupId);
      const blockedFromSending =
        await chatUserBlockService.hasPreventSendingGroupModerationBlock(
          user.email,
          resolvedGroupId
        );
      if (blockedFromSending) {
        return res.status(403).json({
          message: "You are blocked from sending messages in this group",
        });
      }

      await chatGroupService.ensureMemberEmail(resolvedGroupId, user.email);
      ChatSocketService.joinUserToGroup(user.email, resolvedGroupId);

      let replyMetadata: any;
      let replySourceMessage: any;
      if (replyToMessageId) {
        const originalMessageDoc = await this.findMessageByAnyId(String(replyToMessageId));
        if (!originalMessageDoc) {
          return res.status(404).json({ message: "Original message not found" });
        }
        if (!originalMessageDoc.groupId || String(originalMessageDoc.groupId) !== resolvedGroupId) {
          return res.status(400).json({ message: "Reply target must match the original message group" });
        }
        replySourceMessage = originalMessageDoc;
        replyMetadata = this.buildReplyMetadata(originalMessageDoc as any);
      }

      // 4) sanitize text
      const attachment = this.normalizeAttachment(fileUrl, fileType);
      const cleanMessage = originalMsg ? leoProfanity.clean(originalMsg) : undefined;

      // 4) persist the group message
      const message: any = {
        email: user.email,
        messageId: randomUUID(),
        clientId,
        userId: (user as any).id ?? (user as any)._id,
        firstName: user.firstName,
        lastName: user.lastName,
        message: cleanMessage,
        groupId: resolvedGroupId,
        timestamp: new Date(),
        isRead: false,
        isDeleted: false,
        isUpdated: false,
        replyTo: replyMetadata,
      };

      if (attachment.fileUrl) message.fileUrl = attachment.fileUrl;
      if (attachment.fileType) message.fileType = attachment.fileType;

      const savedMessage = await chatService.sendMessage(message);

      if (!savedMessage) {
        console.error("[sendGroupMessage] Failed to save message", {
          groupId: message.groupId,
          sender: user.email
        });
        return res.status(500).json({ message: "Failed to save message to database" });
      }

      console.log("[chat] saved message", {
        id: (savedMessage as any)?._id || (savedMessage as any)?.id,
        messageId: (savedMessage as any)?.messageId,
        groupId: message.groupId,
        sender: user.email,
        timestamp: (savedMessage as any)?.timestamp
      });

      // Respond immediately — client doesn’t wait for post-save work
      res.status(201).json(savedMessage);

      // Post-save work runs in background
      setImmediate(async () => {
        const roomGroupId = String((targetGroup as any).groupId);
        const exclude = ChatSocketService.getSocketIdsByEmail(user.email);

        try {
          // 5+6) update group lastMessage and get blocked list in parallel
          const [, blockedBySenders] = await Promise.all([
            chatGroupService.updatePart(
              { _id: (targetGroup as any)._id },
              {
                $set: {
                  lastMessage: cleanMessage || (attachment.fileType ? `[${attachment.fileType}]` : "[attachment]"),
                  lastMessageAt: new Date(),
                },
              }
            ),
            chatUserBlockService.getBlockerLowerListForBlockedInGroupOrDirect(
              senderLower,
              roomGroupId
            ).catch(() => [] as string[]),
          ]);

          const blockedBySocketIds = (blockedBySenders as string[]).flatMap((email) =>
            ChatSocketService.getSocketIdsByEmail(email)
          );
          const excludeSockets = Array.from(new Set([...(exclude || []), ...blockedBySocketIds]));

          // socket broadcast
          await ChatSocketService.emitToGroupExcept(roomGroupId, excludeSockets, "message:new", savedMessage);
          ChatSocketService.emitToGroupExcept(roomGroupId, excludeSockets, "counts:group:dirty", { groupId: roomGroupId });

          if (exclude?.length) {
            ChatSocketService.getIO()?.to(exclude).emit("message:sent", savedMessage);
          }

          // push notification — fire-and-forget, never sent to the sender
          try {
            const preview = (cleanMessage ?? (attachment.fileType ? `[${attachment.fileType}]` : "[attachment]")).slice(0, 120);
            let inboxEmails: string[] | undefined;
            if ((blockedBySenders as string[]).length) {
              try {
                const members = await chatGroupService.getMemberEmails(roomGroupId);
                inboxEmails = members.filter((email: string) => {
                  const lower = String(email || "").trim().toLowerCase();
                  if (!lower || lower === senderLower) return false;
                  if ((blockedBySenders as string[]).includes(lower)) return false;
                  return true;
                });
              } catch { }
            }

            // M6 delivery. The legacy path below pushes to an FCM *topic*, which
            // fans out inside Firebase and so cannot consult a member's mute
            // list or notification preferences. YaysApp devices are never
            // subscribed to topics; they are reached here, per member, with the
            // gates applied and a deep link into the group conversation.
            (async () => {
              try {
                const recipients =
                  inboxEmails ??
                  (await chatGroupService.getMemberEmails(roomGroupId)).filter((email: string) => {
                    const lower = String(email || "").trim().toLowerCase();
                    return Boolean(lower) && lower !== senderLower;
                  });
                const senderName =
                  [(user as any).firstName, (user as any).lastName].filter(Boolean).join(" ").trim() ||
                  user.email;
                const messageId = String(
                  (savedMessage as any)?.messageId || (savedMessage as any)?._id || ""
                );
                for (const recipient of recipients) {
                  await deliverChatMessage({
                    recipientEmail: recipient,
                    senderEmail: user.email,
                    senderName,
                    preview,
                    conversationId: groupConversationId(roomGroupId),
                    messageId,
                    groupName: (targetGroup as any)?.name || "Group",
                  });
                }
              } catch (error) {
                console.error("[sendGroupMessage] M6 delivery failed", error);
              }
            })();

            notificationService.sendToTopic(
              `group_${roomGroupId}`,
              "group_message",
              {
                groupId: roomGroupId,
                groupName: (targetGroup as any)?.name || "Group",
                preview,
                senderEmail: user.email,
              },
              inboxEmails
                ? { inboxTargets: { emails: inboxEmails } }
                : { inboxTargets: { groupId: roomGroupId, excludeEmail: user.email } }
            ).catch(() => {});
          } catch { }

          if (replySourceMessage) {
            chatService.appendReplySummary(
              { messageId: replySourceMessage.messageId, _id: replySourceMessage._id },
              this.buildReplySummary(savedMessage)
            ).catch((err: any) => console.error("Failed to append reply summary", err));
          }
        } catch (e) {
          console.error("[sendGroupMessage] post-save background error", e);
        }
      });
    } catch (error) {
      console.error("Error sending message:", error);
      return res.status(500).json({ message: "Failed to send message" });
    }
  }

  async sendReferralMessages(req: Request, res: Response) {
    try {
      const {
        email,
        message: originalMessage,
        fileUrl,
        fileType,
      } = req.body;

      if (!email) return res.status(400).json({ message: "email is required" });
      if (!originalMessage && !fileUrl) {
        return res.status(400).json({ message: "message or fileUrl is required" });
      }

      const sender = await userService.findOneSelect(
        { email: String(email).trim().toLowerCase() },
        { email: 1, firstName: 1, lastName: 1, referralCode: 1 }
      );
      if (!sender) return res.status(400).json({ message: "Email not registered" });

      const referralCode = String((sender as any).referralCode || "").trim();
      if (!referralCode) {
        return res.status(400).json({ message: "User has no referral code" });
      }

      const referrals = await userService.findSelect(
        { referralCodeUsed: referralCode },
        { email: 1, firstName: 1, lastName: 1, fcmToken: 1 }
      );

      const recipients = (referrals || [])
        .filter((referral: any) => String(referral?.email || "").trim().toLowerCase())
        .filter((referral: any) => {
          return String(referral.email).trim().toLowerCase() !== String(sender.email).trim().toLowerCase();
        });

      if (!recipients.length) {
        return res.status(200).json({
          message: "No referrals found for this email",
          sentCount: 0,
          failedCount: 0,
          recipients: [],
          failed: [],
        });
      }

      const senderLower = String(sender.email || "").trim().toLowerCase();
      const senderId = (sender as any).id ?? (sender as any)._id;
      const attachment = this.normalizeAttachment(fileUrl, fileType);
      const cleanMessage = originalMessage ? leoProfanity.clean(originalMessage) : undefined;
      const preview = (cleanMessage || (attachment.fileType ? `[${attachment.fileType}]` : "[attachment]")).slice(0, 120);
      const broadcastId = randomUUID();

      const blockedByRecipients = new Set(
        await chatUserBlockService.getBlockerLowerListForBlocked(senderLower, null)
      );
      const messages = recipients.map((receiver: any) => {
        const messagePayload: any = {
          email: sender.email,
          messageId: randomUUID(),
          receiverEmail: receiver.email,
          userId: senderId,
          firstName: sender.firstName,
          lastName: sender.lastName,
          message: cleanMessage,
          groupId: undefined,
          timestamp: new Date(),
          isRead: false,
          isDeleted: false,
          isUpdated: false,
        };

        if (attachment.fileUrl) messagePayload.fileUrl = attachment.fileUrl;
        if (attachment.fileType) messagePayload.fileType = attachment.fileType;

        return messagePayload;
      });

      const savedMessages = await chatService.createMany(messages);
      let queued = false;
      let queueJobId: any = null;

      try {
        const queueJob = await enqueueReferralMessageFanout({
          broadcastId,
          senderEmail: sender.email,
          preview,
          blockedRecipientEmails: Array.from(blockedByRecipients),
          recipients: recipients.map((receiver: any) => ({
            _id: receiver._id,
            email: receiver.email,
            fcmToken: receiver.fcmToken,
          })),
          messages: savedMessages.map((saved: any) => ({
            _id: saved._id,
            messageId: saved.messageId,
            receiverEmail: saved.receiverEmail,
            email: saved.email,
            firstName: saved.firstName,
            lastName: saved.lastName,
            message: saved.message,
            fileUrl: saved.fileUrl,
            fileType: saved.fileType,
            timestamp: saved.timestamp,
          })),
        });
        queued = true;
        queueJobId = queueJob.id;
      } catch (queueError) {
        console.error("[sendReferralMessages] failed to enqueue fanout job", {
          broadcastId,
          sender: sender.email,
          error: queueError,
        });
      }

      return res.status(201).json({
        message: queued
          ? "Referral messages queued for delivery"
          : "Referral messages saved, but fanout queueing failed",
        broadcastId,
        queueJobId,
        queued,
        sentCount: savedMessages.length,
        failedCount: 0,
        blockedNotificationCount: blockedByRecipients.size,
        recipients: savedMessages.map((saved: any) => ({
          email: saved.receiverEmail,
          messageId: saved.messageId,
          blockedNotification: blockedByRecipients.has(String(saved.receiverEmail || "").trim().toLowerCase()),
        })),
      });
    } catch (error) {
      console.error("Error sending referral messages:", error);
      return res.status(500).json({ message: "Failed to send referral messages" });
    }
  }

  async replyToMessage(req: Request, res: Response) {
    try {
      const { messageId: idParam } = req.params; // this is *messageId* now
      const { email, message: bodyMessage } = req.body;

      if (!idParam) return res.status(400).json({ message: "messageId is required" });
      if (!email) return res.status(400).json({ message: "email is required" });
      if (!bodyMessage) return res.status(400).json({ message: "message is required" });

      // Prefer messageId lookup; fallback to _id for old clients/links
      let originalMessageDoc =
        await chatService.findOne({ messageId: idParam });

      if (!originalMessageDoc && Types.ObjectId.isValid(idParam)) {
        originalMessageDoc = await chatService.findOne({ _id: idParam });
      }

      if (!originalMessageDoc) return res.status(404).json({ message: "Original message not found" });

      req.body.replyToMessageId = originalMessageDoc.messageId || String(originalMessageDoc._id);

      if (originalMessageDoc.groupId) {
        req.body.groupId = String(originalMessageDoc.groupId);
        return this.sendGroupMessage(req, res);
      }

      const senderLower = String(email || "").trim().toLowerCase();
      const participants = [
        String(originalMessageDoc.email || "").trim().toLowerCase(),
        String(originalMessageDoc.receiverEmail || "").trim().toLowerCase(),
      ].filter(Boolean);

      if (!participants.includes(senderLower))
        return res.status(403).json({ message: "You do not have access to this conversation" });

      const otherParticipant = participants.find(p => p !== senderLower);
      if (!otherParticipant)
        return res.status(400).json({ message: "Unable to determine conversation participant" });

      req.body.to = otherParticipant;
      return this.sendMessage(req, res);
    } catch (error) {
      console.error("Error replying to message:", error);
      return res.status(500).json({ message: "Failed to reply to message" });
    }
  }

  async setGroupMessagingBlock(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { block, reason, email: emailFromBody } = req.body;

      if (!groupId) return res.status(400).json({ message: "groupId is required" });

      let blockFlag: boolean | undefined;
      if (typeof block === "boolean") {
        blockFlag = block;
      } else if (typeof block === "string") {
        const normalized = block.trim().toLowerCase();
        if (["true", "false"].includes(normalized)) {
          blockFlag = normalized === "true";
        }
      }
      if (blockFlag === undefined) {
        return res.status(400).json({ message: "block must be a boolean value" });
      }

      const operatorEmail = req.user?.email || emailFromBody;
      if (!operatorEmail) {
        return res.status(400).json({ message: "Operator email is required" });
      }

      const operator = await userService.findOneSelect({ email: operatorEmail }, { email: 1, role: 1 });
      if (!operator) {
        return res.status(400).json({ message: "Operator email not found" });
      }

      const isAdmin =
        req.user?.role === UserRoleTypes.Admin ||
        operator.role === UserRoleTypes.Admin;

      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can update group messaging state" });
      }

      const updatedGroup = await chatGroupService.setMessagingBlocked(groupId, blockFlag, {
        by: operator.email,
        reason: typeof reason === "string" ? reason : undefined,
      });

      if (!updatedGroup) {
        return res.status(404).json({ message: "Group not found" });
      }

      const eventPayload = {
        groupId,
        reason: blockFlag ? (reason?.trim?.() || null) : null,
      };

      ChatSocketService.emitToGroup(groupId, blockFlag ? "group:messaging-blocked" : "group:messaging-unblocked", eventPayload);

      return res.json({
        message: blockFlag ? "Group messaging blocked" : "Group messaging unblocked",
        data: updatedGroup,
      });
    } catch (error) {
      console.error("Error updating group messaging state:", error);
      return res.status(500).json({ message: "Failed to update group messaging state" });
    }
  }

  async blockGroupMember(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { memberEmail, email: operatorEmailFromBody, reason } = req.body;

      if (!groupId) return res.status(400).json({ message: "groupId is required" });

      const normalizedMember = String(memberEmail || "").trim().toLowerCase();
      if (!normalizedMember) {
        return res.status(400).json({ message: "memberEmail is required" });
      }

      const operatorEmail = req.user?.email || operatorEmailFromBody;
      if (!operatorEmail) {
        return res.status(400).json({ message: "Operator email is required" });
      }

      const operator = await userService.findOneSelect({ email: operatorEmail }, { email: 1, role: 1 });
      if (!operator) {
        return res.status(400).json({ message: "Operator email not found" });
      }

      const isAdmin =
        req.user?.role === UserRoleTypes.Admin ||
        operator.role === UserRoleTypes.Admin;

      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can block group members" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const isMember = await chatGroupService.isGroupMember(groupId, undefined, normalizedMember);
      if (!isMember) {
        return res.status(404).json({ message: "User is not a member of this group" });
      }

      const memberUser = await userService.findOneSelect({ email: normalizedMember }, { role: 1 });
      if (memberUser?.role === UserRoleTypes.Admin) {
        return res.status(400).json({ message: "Admins cannot be blocked from messaging" });
      }

      const updatedGroup = await chatGroupService.blockMember(groupId, normalizedMember);

      ChatSocketService.emitToGroup(groupId, "group:member-blocked", {
        groupId,
        email: normalizedMember,
        reason: typeof reason === "string" ? reason.trim() || null : null,
      });
      ChatSocketService.emitToUser(normalizedMember, "group:member-blocked", {
        groupId,
        reason: typeof reason === "string" ? reason.trim() || null : null,
      });

      return res.json({
        message: "Member blocked from sending messages",
        data: updatedGroup,
      });
    } catch (error) {
      console.error("Error blocking group member:", error);
      return res.status(500).json({ message: "Failed to block member" });
    }
  }

  async unblockGroupMember(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { memberEmail, email: operatorEmailFromBody } = req.body;

      if (!groupId) return res.status(400).json({ message: "groupId is required" });

      const normalizedMember = String(memberEmail || "").trim().toLowerCase();
      if (!normalizedMember) {
        return res.status(400).json({ message: "memberEmail is required" });
      }

      const operatorEmail = req.user?.email || operatorEmailFromBody;
      if (!operatorEmail) {
        return res.status(400).json({ message: "Operator email is required" });
      }

      const operator = await userService.findOneSelect({ email: operatorEmail }, { email: 1, role: 1 });
      if (!operator) {
        return res.status(400).json({ message: "Operator email not found" });
      }

      const isAdmin =
        req.user?.role === UserRoleTypes.Admin ||
        operator.role === UserRoleTypes.Admin;

      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can unblock group members" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const updatedGroup = await chatGroupService.unblockMember(groupId, normalizedMember);

      ChatSocketService.emitToGroup(groupId, "group:member-unblocked", {
        groupId,
        email: normalizedMember,
      });
      ChatSocketService.emitToUser(normalizedMember, "group:member-unblocked", {
        groupId,
      });

      return res.json({
        message: "Member unblocked successfully",
        data: updatedGroup,
      });
    } catch (error) {
      console.error("Error unblocking group member:", error);
      return res.status(500).json({ message: "Failed to unblock member" });
    }
  }

  async blockUser(req: Request, res: Response) {
    try {
      const actorEmail = String(req.user?.email || req.body?.email || "").trim();
      const blockedEmail = String(req.body?.blockedEmail || "").trim();
      const groupId = String(req.body?.groupId || "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      const preventSending = req.body?.preventSending === true;
      const blockedByAdmin = req.body?.blockedByAdmin === true;
      const blockScope =
        typeof req.body?.blockScope === "string" ? req.body.blockScope.trim() : "";
      const isGroupModerationBlock =
        preventSending || blockedByAdmin || blockScope === GROUP_MODERATION_SCOPE;

      if (!actorEmail) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!blockedEmail) {
        return res.status(400).json({ message: "blockedEmail is required" });
      }
      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }

      const actorLower = actorEmail.toLowerCase();
      const blockedLower = blockedEmail.toLowerCase();

      if (actorLower === blockedLower) {
        return res.status(400).json({ message: "You cannot block yourself" });
      }

      const actor = await userService.findOneSelect({ email: actorLower }, { email: 1, role: 1 });
      if (!actor) {
        return res.status(400).json({ message: "Email not registered" });
      }
      const target = await userService.findOneSelect({ email: blockedLower }, { email: 1, fcmToken: 1 });
      if (!target) {
        return res.status(400).json({ message: "Blocked user not found" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const actorIsAdmin = isAdminRole(req.user?.role) || isAdminRole((actor as any).role);
      if (isGroupModerationBlock && !actorIsAdmin) {
        return res.status(403).json({
          message: "Only admins can create group moderation blocks",
        });
      }

      const updated = await chatUserBlockService.upsertOneAndGet(
        { blockerLower: actorLower, blockedLower, groupId },
        {
          $set: {
            blockerEmail: actorEmail,
            blockerLower: actorLower,
            blockedEmail,
            blockedLower,
            groupId,
            reason: reason || null,
            preventSending: actorIsAdmin && preventSending,
            blockedByAdmin: actorIsAdmin && blockedByAdmin,
            blockScope:
              actorIsAdmin && isGroupModerationBlock
                ? GROUP_MODERATION_SCOPE
                : null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        }
      );

      try {
        const token = (target as any)?.fcmToken;
        if (token) {
          await unsubscribeTokensFromTopic([token], groupTopic(groupId));
        }
        ChatSocketService.leaveUserFromGroup(blockedLower, groupId);
      } catch (e) {
        console.warn("Failed to unsubscribe/leave blocked user from group:", e);
      }

      return res.status(200).json({
        message: "User blocked successfully",
        data: updated,
      });
    } catch (error: any) {
      console.error("Error blocking user:", error);
      return res.status(500).json({ message: "Failed to block user" });
    }
  }

  async unblockUser(req: Request, res: Response) {
    try {
      const actorEmail = String(req.user?.email || req.body?.email || "").trim();
      const blockedEmail = String(req.body?.blockedEmail || "").trim();
      const groupId = String(req.body?.groupId || "").trim();

      if (!actorEmail) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!blockedEmail) {
        return res.status(400).json({ message: "blockedEmail is required" });
      }
      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }

      const actorLower = actorEmail.toLowerCase();
      const blockedLower = blockedEmail.toLowerCase();

      await chatUserBlockService.deleteOne({
        blockerLower: actorLower,
        blockedLower,
        groupId,
      });

      try {
        const target = await userService.findOneSelect(
          { email: blockedLower },
          { email: 1, fcmToken: 1 }
        );
        const token = (target as any)?.fcmToken;
        if (token) {
          await subscribeTokensToTopic([token], groupTopic(groupId));
        }
        ChatSocketService.joinUserToGroup(blockedLower, groupId);
      } catch (e) {
        console.warn("Failed to subscribe/join unblocked user to group:", e);
      }

      return res.status(200).json({
        message: "User unblocked successfully",
      });
    } catch (error: any) {
      console.error("Error unblocking user:", error);
      return res.status(500).json({ message: "Failed to unblock user" });
    }
  }

  async getBlockedUsers(req: Request, res: Response) {
    try {
      const actorEmail = String(req.user?.email || req.query?.email || "").trim();
      const groupId = String(req.query?.groupId || "").trim();
      if (!actorEmail) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const blocks = await chatUserBlockService.find({ groupId });

      const merged = new Map<string, {
        blockedEmail: string;
        blockedLower: string;
        blockedBy: string[];
        reasons: (string | null)[];
        preventSending: boolean;
        blockedByAdmin: boolean;
        blockScope: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
      }>();

      for (const b of blocks || []) {
        const blockedLower = String((b as any).blockedLower || "").trim().toLowerCase();
        if (!blockedLower) continue;
        const blockedEmail = String((b as any).blockedEmail || "").trim() || blockedLower;
        const blockedBy = String((b as any).blockerEmail || "").trim();
        const reason = (b as any).reason ?? null;
        const preventSending = (b as any).preventSending === true;
        const blockedByAdmin = (b as any).blockedByAdmin === true;
        const blockScope = (b as any).blockScope ?? null;
        const createdAt = (b as any).createdAt ?? null;
        const updatedAt = (b as any).updatedAt ?? null;

        const existing = merged.get(blockedLower);
        if (!existing) {
          merged.set(blockedLower, {
            blockedEmail,
            blockedLower,
            blockedBy: blockedBy ? [blockedBy] : [],
            reasons: reason ? [reason] : [],
            preventSending,
            blockedByAdmin,
            blockScope,
            createdAt,
            updatedAt,
          });
          continue;
        }

        if (blockedBy && !existing.blockedBy.includes(blockedBy)) {
          existing.blockedBy.push(blockedBy);
        }
        if (reason && !existing.reasons.includes(reason)) {
          existing.reasons.push(reason);
        }
        existing.preventSending = existing.preventSending || preventSending;
        existing.blockedByAdmin = existing.blockedByAdmin || blockedByAdmin;
        if (!existing.blockScope && blockScope) {
          existing.blockScope = blockScope;
        }
        if (createdAt && (!existing.createdAt || createdAt < existing.createdAt)) {
          existing.createdAt = createdAt;
        }
        if (updatedAt && (!existing.updatedAt || updatedAt > existing.updatedAt)) {
          existing.updatedAt = updatedAt;
        }
      }

      return res.status(200).json({
        message: "Blocked users fetched successfully",
        data: Array.from(merged.values()).map((entry) => ({
          blockedEmail: entry.blockedEmail,
          groupId,
          blockedBy: entry.blockedBy,
          reasons: entry.reasons,
          preventSending: entry.preventSending,
          blockedByAdmin: entry.blockedByAdmin,
          blockScope: entry.blockScope,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })),
      });
    } catch (error: any) {
      console.error("Error fetching blocked users:", error);
      return res.status(500).json({ message: "Failed to fetch blocked users" });
    }
  }

  async blockUserDirect(req: Request, res: Response) {
    try {
      const actorEmail = String(req.user?.email || req.body?.email || "").trim();
      const blockedEmail = String(req.body?.blockedEmail || "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

      if (!actorEmail) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!blockedEmail) {
        return res.status(400).json({ message: "blockedEmail is required" });
      }

      const actorLower = actorEmail.toLowerCase();
      const blockedLower = blockedEmail.toLowerCase();

      if (actorLower === blockedLower) {
        return res.status(400).json({ message: "You cannot block yourself" });
      }

      const actor = await userService.findOneSelect({ email: actorLower }, { email: 1 });
      if (!actor) {
        return res.status(400).json({ message: "Email not registered" });
      }
      const target = await userService.findOneSelect({ email: blockedLower }, { email: 1 });
      if (!target) {
        return res.status(400).json({ message: "Blocked user not found" });
      }

      const updated = await chatUserBlockService.upsertOneAndGet(
        { blockerLower: actorLower, blockedLower, groupId: null },
        {
          $set: {
            blockerEmail: actorEmail,
            blockerLower: actorLower,
            blockedEmail,
            blockedLower,
            groupId: null,
            reason: reason || null,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        }
      );

      return res.status(200).json({
        message: "User blocked successfully (direct chat)",
        data: updated,
      });
    } catch (error: any) {
      console.error("Error blocking user (direct):", error);
      return res.status(500).json({ message: "Failed to block user" });
    }
  }

  async unblockUserDirect(req: Request, res: Response) {
    try {
      const actorEmail = String(req.user?.email || req.body?.email || "").trim();
      const blockedEmail = String(req.body?.blockedEmail || "").trim();

      if (!actorEmail) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!blockedEmail) {
        return res.status(400).json({ message: "blockedEmail is required" });
      }

      const actorLower = actorEmail.toLowerCase();
      const blockedLower = blockedEmail.toLowerCase();

      await chatUserBlockService.deleteOne({
        blockerLower: actorLower,
        blockedLower,
        groupId: null,
      });

      return res.status(200).json({
        message: "User unblocked successfully (direct chat)",
      });
    } catch (error: any) {
      console.error("Error unblocking user (direct):", error);
      return res.status(500).json({ message: "Failed to unblock user" });
    }
  }

  async getBlockedUsersDirect(req: Request, res: Response) {
    try {
      const actorEmail = String(req.user?.email || req.query?.email || "").trim();
      if (!actorEmail) {
        return res.status(400).json({ message: "email is required" });
      }

      const actorLower = actorEmail.toLowerCase();
      const blocks = await chatUserBlockService.find({
        blockerLower: actorLower,
        groupId: null,
      });

      return res.status(200).json({
        message: "Blocked direct users fetched successfully",
        data: (blocks || []).map((b: any) => ({
          blockedEmail: b.blockedEmail,
          reason: b.reason ?? null,
          createdAt: b.createdAt ?? null,
          updatedAt: b.updatedAt ?? null,
        })),
      });
    } catch (error: any) {
      console.error("Error fetching blocked direct users:", error);
      return res.status(500).json({ message: "Failed to fetch blocked users" });
    }
  }

  async reportUser(req: Request, res: Response) {
    try {
      const reporterEmail = String(req.user?.email || req.body?.email || "").trim();
      const reportedEmail = String(req.body?.reportedEmail || "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      const messageId = typeof req.body?.messageId === "string" ? req.body.messageId.trim() : "";
      const groupId = typeof req.body?.groupId === "string" ? req.body.groupId.trim() : "";

      if (!reporterEmail) {
        return res.status(400).json({ message: "email is required" });
      }
      if (!reportedEmail) {
        return res.status(400).json({ message: "reportedEmail is required" });
      }

      const reporterLower = reporterEmail.toLowerCase();
      const reportedLower = reportedEmail.toLowerCase();

      if (reporterLower === reportedLower) {
        return res.status(400).json({ message: "You cannot report yourself" });
      }

      const reporter = await userService.findOneSelect({ email: reporterLower }, { email: 1 });
      if (!reporter) {
        return res.status(400).json({ message: "Email not registered" });
      }
      const target = await userService.findOneSelect({ email: reportedLower }, { email: 1 });
      if (!target) {
        return res.status(400).json({ message: "Reported user not found" });
      }

      const created = await chatUserReportService.create({
        reporterEmail,
        reporterLower,
        reportedEmail,
        reportedLower,
        reason: reason || null,
        messageId: messageId || null,
        groupId: groupId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      return res.status(201).json({
        message: "User reported successfully",
        data: created,
      });
    } catch (error: any) {
      console.error("Error reporting user:", error);
      return res.status(500).json({ message: "Failed to report user" });
    }
  }

  async getReportedUsers(req: Request, res: Response) {
    try {
      const requesterEmail = String(req.user?.email || req.query?.email || "").trim().toLowerCase();

      if (!requesterEmail) {
        return res.status(400).json({ message: "email is required" });
      }

      const requester = await userService.findOneSelect(
        { email: requesterEmail },
        { email: 1, role: 1 }
      );

      const requesterRole = String(req.user?.role || (requester as any)?.role || "");
      const isAdmin =
        requesterRole === UserRoleTypes.Admin ||
        requesterRole === UserRoleTypes.SuperAdmin;

      if (!requester || !isAdmin) {
        return res.status(403).json({ message: "Only admins can view reported users" });
      }

      const page = Math.max(parseInt(String(req.query?.page || "1"), 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(String(req.query?.limit || "50"), 10) || 50, 1),
        200
      );
      const skip = (page - 1) * limit;
      const reportedEmail = String(req.query?.reportedEmail || "").trim().toLowerCase();
      const reporterEmail = String(req.query?.reporterEmail || "").trim().toLowerCase();
      const groupId = String(req.query?.groupId || "").trim();

      const query: any = {};
      if (reportedEmail) query.reportedLower = reportedEmail;
      if (reporterEmail) query.reporterLower = reporterEmail;
      if (groupId) query.groupId = groupId;

      const [reports, total] = await Promise.all([
        chatUserReportService.findPaginatedSkip(
          limit,
          skip,
          { createdAt: -1 },
          query,
          {
            reporterEmail: 1,
            reporterLower: 1,
            reportedEmail: 1,
            reportedLower: 1,
            reason: 1,
            messageId: 1,
            groupId: 1,
            createdAt: 1,
            updatedAt: 1,
          }
        ),
        chatUserReportService.findCount(query),
      ]);

      const messageIds = Array.from(
        new Set(
          (reports || [])
            .map((report: any) => String(report?.messageId || "").trim())
            .filter(Boolean)
        )
      );
      const groupIds = Array.from(
        new Set(
          (reports || [])
            .map((report: any) => String(report?.groupId || "").trim())
            .filter(Boolean)
        )
      );

      const [messages, groups] = await Promise.all([
        messageIds.length
          ? chatService.find({
              $or: [
                { messageId: { $in: messageIds } },
                ...(messageIds
                  .filter((id) => Types.ObjectId.isValid(id))
                  .map((id) => ({ _id: id }))),
              ],
            })
          : Promise.resolve([]),
        groupIds.length
          ? chatGroupService.find({ groupId: { $in: groupIds } })
          : Promise.resolve([]),
      ]);

      const messagesById = new Map<string, any>();
      for (const msg of messages || []) {
        const messageIdValue = String((msg as any)?.messageId || "").trim();
        const objectIdValue = String((msg as any)?._id || "").trim();
        if (messageIdValue) messagesById.set(messageIdValue, msg);
        if (objectIdValue) messagesById.set(objectIdValue, msg);
      }

      const groupNameById = new Map<string, string>();
      for (const group of groups || []) {
        const gid = String((group as any)?.groupId || "").trim();
        const name = String((group as any)?.name || "").trim();
        if (gid && name) groupNameById.set(gid, name);
      }

      const enrichedReports = (reports || []).map((report: any) => {
        const reportObject =
          typeof report?.toObject === "function" ? report.toObject() : report;
        const msg = messagesById.get(String(reportObject?.messageId || "").trim());
        const reportGroupId = String(reportObject?.groupId || "").trim();

        return {
          ...reportObject,
          message: msg?.message ?? null,
          groupName: reportGroupId
            ? groupNameById.get(reportGroupId) ?? null
            : null,
        };
      });

      return res.status(200).json({
        message: "Reported users fetched successfully",
        data: enrichedReports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Error fetching reported users:", error);
      return res.status(500).json({ message: "Failed to fetch reported users" });
    }
  }

  async getGroupUnreadCount(req: Request, res: Response) {
    try {
      let { groupId } = req.params;
      const me = String(req.query.email || "").trim().toLowerCase();
      if (!groupId || !me) return res.status(400).json({ message: "groupId and email are required" });

      // Resolve "everyone" to actual groupId
      const { resolvedId: resolvedGroupId, isGlobal: isGlobalGroup } = await resolveGroupId(groupId);
      console.log("[getGroupUnreadCount] Resolved groupId", { original: groupId, resolved: resolvedGroupId, isGlobal: isGlobalGroup });

      const user = await userService.findOneSelect({ email: me }, { _id: 1, email: 1, role: 1 });
      if (!user) return res.status(400).json({ message: "Email not registered" });
      
      // Only check membership for non-global groups
      if (!isGlobalGroup && user.role !== UserRoleTypes.Admin) {
        const isMember = await chatGroupService.isGroupMember(resolvedGroupId, String((user as any).id), me);
        if (!isMember) return res.status(403).json({ message: "Not authorized to view this group" });
      }

      const last = await groupRead.getLastRead(me, resolvedGroupId);
      const unread = await chatService.countGroupUnreadForUser(resolvedGroupId, me, last);
      return res.json({ groupId: resolvedGroupId, email: me, count: unread });
    } catch (e: any) {
      console.error("getGroupUnreadCount error:", e);
      return res.status(500).json({ message: e.message || "Failed to get unread count" });
    }
  }

  async markGroupRead(req: Request, res: Response) {
    try {
      let groupId = String(req.params.groupId || "");
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!groupId || !email) return res.status(400).json({ message: "groupId and email are required" });

      // Resolve "everyone" to actual groupId
      const { resolvedId: resolvedGroupId } = await resolveGroupId(groupId);
      console.log("[markGroupRead] Resolved groupId", { original: groupId, resolved: resolvedGroupId });

      // pick a robust "when": min(now, providedAt), but not earlier than latest message
      const now = new Date();
      const provided = req.body?.at ? new Date(req.body.at) : null;
      let when = provided && !isNaN(provided.getTime()) ? provided : now;
      if (when > now) when = now;

      const latestTs = await chatService.getLatestGroupTimestamp(resolvedGroupId);
      if (latestTs && latestTs > when) when = latestTs;

      const groupDoc = await chatGroupService.findOne({ groupId: resolvedGroupId });
      const lastReadAt = await groupRead.markRead(email, resolvedGroupId, when, (groupDoc as any)?.name);
      const unread = await chatService.countGroupUnreadForUser(resolvedGroupId, email, lastReadAt);

      ChatSocketService.emitToUser(email, "counts:group", { groupId: resolvedGroupId, unread, lastReadAt });
      return res.json({ groupId: resolvedGroupId, email, unread, lastReadAt });
    } catch (e: any) {
      console.error("markGroupRead error:", e);
      return res.status(500).json({ message: e.message || "Failed to mark group read" });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const { email } = req.params;
      const user = await userService.findOneSelect({ email }, {});
      if (!user) return res.status(400).json({ message: "Email not registered" });
      const blocked = await this.getDirectBlockedList(user.email);
      const messages = await chatService.getMessagesForUser(user.email, {
        excludeSenderEmails: blocked,
      });
      return res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  }

  async getMessagesPaged(req: Request, res: Response) {
    try {
      const { email } = req.params;
      const peer = String(req.query.with || "").trim().toLowerCase();
      const rawLimit = Number(req.query.limit ?? 50);
      const limit = Math.max(1, Math.min(rawLimit, 200));
      const beforeId = (req.query.beforeId as string) || undefined;
      const afterId = (req.query.afterId as string) || undefined;

      const user = await userService.findOneSelect({ email }, { email: 1 });
      if (!user) return res.status(400).json({ message: "Email not registered" });

      const blocked = await this.getDirectBlockedList(user.email);
      const page = await chatService.getDirectMessagesPaged(user.email, {
        peer,
        limit,
        beforeId,
        afterId,
        excludeSenderEmails: blocked,
      });
      return res.json(page);
    } catch (error: any) {
      console.error("Error fetching paged direct messages:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  }

  async getLatestMessages(req: Request, res: Response) {
    try {
      const { email } = req.params;
      const limit = Math.min(20, Math.max(1, Number(req.query.limit || 5)));
      const user = await userService.findOneSelect({ email }, {});
      if (!user) return res.status(400).json({ message: "Email not registered" });
      const blocked = await this.getDirectBlockedList(user.email);
      const messages = await chatService.getLastMessages(user.email, {
        excludeSenderEmails: blocked,
        limit,
      });
      return res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  }

  async markAsRead(req: Request, res: Response) {
    try {
      const { messageIds, userId, email } = req.body || {};
      if (!Array.isArray(messageIds) || !messageIds.length) {
        return res.status(400).json({ message: "messageIds[] required" });
      }
      if (!userId && !email) {
        return res.status(400).json({ message: "userId or email required" });
      }

      const reader = email
        ? await userService.findOneSelect({ email: String(email).trim().toLowerCase() }, { email: 1 })
        : await userService.findOneSelect({ id: userId }, { email: 1 });
      if (!reader?.email) {
        return res.status(400).json({ message: "Reader not found" });
      }
      const { matchedCount, modifiedCount } = email
        ? await chatService.markDirectMessagesAsReadForEmail(messageIds, reader.email)
        : await chatService.markMessagesAsRead(messageIds, userId);
      const msgs = await chatService.findWithNotifications(messageIds, userId, reader.email);
      const notificationIds = msgs
        .filter((m: any) => m.receiverEmail === reader.email && !!m.notificationId)
        .map((m: any) => m.notificationId as string);

      // 3) mark those notifications as read
      let notificationsUpdated = 0;
      if (notificationIds.length) {
        const notifRes: any = await notificationService.bulkMarkAsRead(notificationIds, reader.email);
        notificationsUpdated = notifRes?.modifiedCount ?? notifRes?.nModified ?? 0;
      }
      return res.json({ success: true, matchedCount, modifiedCount });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      return res.status(500).json({ message: "Failed to mark messages as read" });
    }
  }

  async getGroupMessageCount(req: Request, res: Response) {
    try {
      let { groupId } = req.params;
      if (!groupId) return res.status(400).json({ message: "groupId is required" });

      // Resolve "everyone" to actual groupId
      const { resolvedId: resolvedGroupId } = await resolveGroupId(groupId);
      console.log("[getGroupMessageCount] Resolved groupId", { original: groupId, resolved: resolvedGroupId });

      const unreadOnly = String(req.query.unreadOnly ?? "false") === "true";
      const me = String(req.query.email || "").trim().toLowerCase();

      if (unreadOnly) {
        if (!me) return res.status(400).json({ message: "email is required for unreadOnly=true" });

        // membership check (accept everyone group)
        const user = await userService.findOneSelect({ email: me }, { _id: 1, email: 1 });
        if (!user) return res.status(400).json({ message: "Email not registered" });

        // supports either userId or email stored as members
        const isMember = await chatGroupService.isGroupMember(resolvedGroupId, String((user as any).id), me);
        if (!isMember) return res.status(403).json({ message: "Not authorized to view this group" });

        const last = await groupRead.getLastRead(me, resolvedGroupId);
        const blocked = await this.getGroupBlockedList(me, resolvedGroupId);
        const unread = await chatService.countGroupUnreadForUser(resolvedGroupId, me, last, {
          excludeSenderEmails: blocked,
        });
        return res.json({ groupId: resolvedGroupId, count: unread });
      }

      const total = await chatService.findCount({ groupId: resolvedGroupId });
      return res.json({ groupId: resolvedGroupId, count: total });
    } catch (e: any) {
      console.error("getGroupMessageCount error:", e);
      return res.status(500).json({ message: e.message || "Failed to get group count" });
    }
  }

  async getMessageCount(req: Request, res: Response) {
    try {
      const me = (req.query.email as string) || "";
      if (!me) return res.status(400).json({ message: "email is required" });

      const peer = (req.query.with as string) || "";
      const unreadOnly = String(req.query.unreadOnly ?? "false") === "true";

      const blocked = await this.getDirectBlockedList(me);
      const count = await chatService.countDirectMessages(me, {
        peer,
        unreadOnly,
        excludeSenderEmails: blocked,
      });
      return res.json({ email: me, with: peer || null, count });
    } catch (e: any) {
      console.error("getMessageCount error:", e);
      return res.status(500).json({ message: e.message || "Failed to get message count" });
    }
  }

  async getMessageUnreadCount(req: Request, res: Response) {
    try {
      const me = (req.query.email as string) || "";
      if (!me) return res.status(400).json({ message: "email is required" });

      const peer = (req.query.with as string) || "";

      const blocked = await this.getDirectBlockedList(me);
      const count = await chatService.countDirectMessages(me, {
        peer,
        unreadOnly: true,
        excludeSenderEmails: blocked,
      });
      return res.json({ email: me, with: peer || null, count });
    } catch (e: any) {
      console.error("getMessageCount error:", e);
      return res.status(500).json({ message: e.message || "Failed to get message count" });
    }
  }

  async getGroupMessages(req: Request, res: Response) {
    try {
      let { groupId } = req.params;
      const email = String(req.query.email || "");
      
      if (!email) {
        console.error("[getGroupMessages] Email is required");
        return res.status(400).json({ message: "Email is required" });
      }

      if (!groupId) {
        console.error("[getGroupMessages] groupId is required");
        return res.status(400).json({ message: "groupId is required" });
      }

      // Resolve "everyone" to actual groupId
      const { resolvedId: resolvedGroupId, isGlobal: isGlobalGroup } = await resolveGroupId(groupId);
      console.log("[getGroupMessages] Request", { originalGroupId: groupId, resolvedGroupId, isGlobalGroup, email });

      const user = await userService.findOneSelect({ email }, { _id: 1, email: 1, role: 1 });
      if (!user) {
        console.error("[getGroupMessages] User not found", { email });
        return res.status(400).json({ message: "Email not registered" });
      }

      // Public/global groups are always allowed, or if user is admin
      // Only check membership for non-global, non-admin groups
      if (!isGlobalGroup && user.role !== UserRoleTypes.Admin) {
        const isMember = await chatGroupService.isGroupMember(resolvedGroupId, user.id, user.email);
        if (!isMember) {
          console.error("[getGroupMessages] User not authorized", { resolvedGroupId, email, role: user.role, isGlobal: isGlobalGroup });
          return res.status(403).json({ message: "Not authorized to view this group" });
        }
      }

      console.log("[getGroupMessages] Fetching messages", { resolvedGroupId, email, isGlobalGroup });
      const blocked = await this.getGroupBlockedList(email, resolvedGroupId);
      const messages = await chatService.getMessagesByGroup(resolvedGroupId, 50, {
        excludeSenderEmails: blocked,
      });
      
      console.log("[getGroupMessages] Returning messages", { 
        resolvedGroupId, 
        messageCount: messages?.length || 0 
      });

      return res.json({ messages: messages || [] });
    } catch (error: any) {
      console.error("[getGroupMessages] Error fetching messages:", error);
      return res.status(500).json({ 
        message: "Failed to fetch messages",
        error: error?.message || String(error)
      });
    }
  }

  async getGroupMessagesPaged(req: Request, res: Response) {
    try {
      let { groupId } = req.params;
      const me = String(req.query.email || "");
      if (!me) return res.status(400).json({ message: "email is required" });

      // Resolve "everyone" to actual groupId
      const { resolvedId: resolvedGroupId, isGlobal: isGlobalGroup } = await resolveGroupId(groupId);
      console.log("[getGroupMessagesPaged] Resolved groupId", { original: groupId, resolved: resolvedGroupId, isGlobal: isGlobalGroup });

      const user = await userService.findOneSelect({ email: me }, { _id: 1, email: 1, role: 1 });
      if (!user) return res.status(400).json({ message: "Email not registered" });

      // Public/global groups are always allowed, or if user is admin
      if (!isGlobalGroup && user.role !== UserRoleTypes.Admin) {
        console.log("user.role", user.role);
        const isMember = await chatGroupService.isGroupMember(resolvedGroupId, String((user as any).id), me);
        if (!isMember) return res.status(403).json({ message: "Not authorized to view this group" });
      }

      const rawLimit = Number(req.query.limit ?? 200);
      const limit = Math.max(1, Math.min(rawLimit, 200));
      const beforeId = (req.query.beforeId as string) || undefined;
      const afterId = (req.query.afterId as string) || undefined;

      const blocked = await this.getGroupBlockedList(me, resolvedGroupId);
      const page = await chatService.getGroupMessagesPaged(resolvedGroupId, {
        limit,
        beforeId,
        afterId,
        excludeSenderEmails: blocked,
      });
      return res.json(page);
    } catch (e: any) {
      console.error("getGroupMessagesPaged error:", e);
      return res.status(500).json({ message: e.message || "Failed to fetch messages" });
    }
  }

  async createReferralGroup(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const user = await userService.findOneSelect({ email }, {});
      if (!user) return res.status(400).json({ message: "Email not registered" });
      if (!user.referralCode) return res.status(400).json({ message: "User has no referral code" });

      const group = await chatGroupService.createReferralGroup(
        user.id,
        user.referralCode,
        req.body.groupName
      );

      return res.status(201).json(group);
    } catch (error) {
      console.error("Error creating referral group:", error);
      return res.status(500).json({ message: "Failed to create referral group" });
    }
  }

  async createCustomGroup(req: Request, res: Response) {
    try {
      const { creatorEmail, groupName, memberEmails } = req.body;

      if (!creatorEmail || !groupName || !Array.isArray(memberEmails)) {
        return res.status(400).json({
          message: "creatorEmail, groupName, and memberEmails array are required"
        });
      }

      const user = await userService.findOneSelect({ email: creatorEmail }, {});
      if (!user) return res.status(400).json({ message: "Creator email not registered" });

      const group = await chatGroupService.createCustomGroup(
        creatorEmail,
        groupName,
        memberEmails
      );

      const groupIdStr = String((group as any)?.groupId || "");
      if (groupIdStr) {
        const normalizedMembers = Array.from(
          new Set([creatorEmail, ...memberEmails].map((m: string) => String(m || "").trim().toLowerCase()))
        );
        normalizedMembers.forEach((memberEmail) => {
          ChatSocketService.joinUserToGroup(memberEmail, groupIdStr);
          ChatSocketService.emitToUser(memberEmail, "group:joined", {
            groupId: groupIdStr,
            groupName: (group as any)?.name ?? groupName,
          });
        });
      }

      const bonusResult = await btcyChatGroupBonusService.evaluateGroup(group);

      const groupResponse = group;
      return res.status(201).json({
        ...groupResponse,
        btcyChatGroupBonus: bonusResult,
      });
    } catch (error: any) {
      console.error("Error creating custom group:", error);
      return res.status(500).json({
        message: error.message || "Failed to create custom group"
      });
    }
  }

  async getUserGroups(req: Request, res: Response) {
    try {
      const { email } = req.query;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await userService.findOneSelect({ email }, { email: 1 });
      if (!user) return res.status(400).json({ message: "Email not registered" });

      const groups = await chatGroupService.getUserGroups(user.email);

      // Return global groups AND groups the user is a member of
      const globalGroups = groups.filter((group: any) =>
        group.isGlobal === true || (group.members || []).includes(user.email)
      );

      const sanitizedGroups = await Promise.all(
        globalGroups.map(async (group: any) => {
          const plain = group?.toObject ? group.toObject() : group;
          const gid = String(plain?.groupId || "").trim();
          if (!gid) return plain;

          const blockedForGroup = await this.getGroupBlockedList(user.email, gid);
          if (!blockedForGroup.length) return plain;

          const latest = await chatService.findPaginated(
            1,
            { timestamp: -1, _id: -1 },
            { groupId: gid },
            {}
          );
          const latestMsg = latest?.[0] as any;
          const latestSender = String(latestMsg?.email || "").trim().toLowerCase();

          if (latestSender && blockedForGroup.includes(latestSender)) {
            return {
              ...plain,
              lastMessage: null,
              lastMessageAt: null,
            };
          }
          return plain;
        })
      );

      console.log(`[getUserGroups] Filtered groups for ${email}: ${globalGroups.length} visible groups (global + member) out of ${groups.length} total`);

      return res.json(sanitizedGroups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      return res.status(500).json({ message: "Failed to fetch user groups" });
    }
  }

  async joinReferralGroup(req: Request, res: Response) {
    try {
      const { referralCode } = req.params;
      const { email } = req.body;

      const user = await userService.findOneSelect({ email }, {});
      if (!user) return res.status(400).json({ message: "Email not registered" });

      const group = await chatGroupService.getGroupByReferralCode(referralCode);
      if (!group) return res.status(404).json({ message: "Referral group not found" });

      if (group.members.includes(user.id)) {
        return res.status(200).json({ message: "User already in group", group });
      }

      const updatedGroup = await chatGroupService.addMemberToGroup(group.name, user.id);
      return res.json(updatedGroup);
    } catch (error) {
      console.error("Error joining referral group:", error);
      return res.status(500).json({ message: "Failed to join referral group" });
    }
  }

  async joinGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { email } = req.body; // the current user
      if (!groupId || !email) return res.status(400).json({ message: "groupId and email are required" });

      // Check if the group is a global/common group
      const normalizedGroupId = String(groupId);
      const group = await chatGroupService.findOne({ groupId: normalizedGroupId });
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const isGlobalGroup = (group as any).isGlobal === true;
      if (!isGlobalGroup) {
        return res.status(403).json({
          message: "Only global/common groups are available for group chat. This group cannot be joined."
        });
      }

      // persist membership by email
      await chatGroupService.ensureMemberEmail(normalizedGroupId, email);

      // subscribe this user's device token (if any) to the topic
      const user = await userService.findOneSelect({ email }, { fcmToken: 1, email: 1 });
      if (user?.fcmToken) {
        await subscribeTokensToTopic([user.fcmToken], groupTopic(normalizedGroupId));
      }

      ChatSocketService.joinUserToGroup(email, normalizedGroupId);

      // Ask the client to join the socket room too (client will also emit "group:join")
      // Optionally, emit acks:
      ChatSocketService.emitToUser(email, "group:joined", { groupId: normalizedGroupId });

      return res.json({ ok: true });
    } catch (e: any) {
      console.error("joinGroup error:", e);
      return res.status(500).json({ message: e.message || "Failed to join group" });
    }
  }

  async leaveGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { email } = req.body;
      if (!groupId || !email) return res.status(400).json({ message: "groupId and email are required" });

      const normalizedGroupId = String(groupId);
      await chatGroupService.removeMemberByEmail(normalizedGroupId, email);

      const user = await userService.findOneSelect({ email }, { fcmToken: 1, email: 1 });
      if (user?.fcmToken) {
        await unsubscribeTokensFromTopic([user.fcmToken], groupTopic(normalizedGroupId));
      }

      ChatSocketService.leaveUserFromGroup(email, normalizedGroupId);
      ChatSocketService.emitToUser(email, "group:left", { groupId: normalizedGroupId });
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("leaveGroup error:", e);
      return res.status(500).json({ message: e.message || "Failed to leave group" });
    }
  }

  async updateGroup(req: Request, res: Response) {
    try {
      const groupId = String(req.params.groupId || "");
      const requestedName = String(req.body?.name || "").trim();
      const actorEmail = String(req.user?.email || "").trim().toLowerCase();

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }
      if (!actorEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      if (!requestedName) {
        return res.status(400).json({ message: "Group name is required" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const actor = await userService.findOneSelect(
        { email: actorEmail },
        { email: 1, id: 1, _id: 1 }
      );
      if (!actor) {
        return res.status(400).json({ message: "Actor email not registered" });
      }

      const actorRole = req.user?.role as UserRoleTypes;
      const isAdmin = actorRole === UserRoleTypes.Admin || actorRole === UserRoleTypes.SuperAdmin;
      const createdBy = String((group as any)?.createdBy || "").toLowerCase();
      const actorId = String((actor as any)?.id || (actor as any)?._id || "");
      const isCreator = createdBy === actorEmail || (!!actorId && createdBy === actorId.toLowerCase());

      if ((group as any)?.isAdminOnly && !isAdmin) {
        return res.status(403).json({ message: "Only admins can update this group" });
      }

      if (!isAdmin && !isCreator) {
        return res.status(403).json({ message: "Not authorized to update this group" });
      }

      const existingWithName = await chatGroupService.findOne({ name: requestedName });
      if (
        existingWithName &&
        String((existingWithName as any)?.groupId) !== groupId
      ) {
        return res.status(409).json({ message: "Another group with this name already exists" });
      }

      const updatedGroup = await chatGroupService.updateGroupMetadata(groupId, { name: requestedName });
      return res.json({
        message: "Group updated successfully",
        group: updatedGroup,
      });
    } catch (error: any) {
      console.error("Error updating group:", error);
      return res.status(500).json({
        message: error.message || "Failed to update group",
      });
    }
  }

  async deleteGroup(req: Request, res: Response) {
    try {
      const groupId = String(req.params.groupId || "");
      const actorEmail = String(req.user?.email || "").trim().toLowerCase();

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }
      if (!actorEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      if ((group as any)?.isGlobal) {
        return res.status(400).json({ message: "Global groups cannot be deleted" });
      }

      const actor = await userService.findOneSelect(
        { email: actorEmail },
        { email: 1, id: 1, _id: 1, fcmToken: 1 }
      );
      if (!actor) {
        return res.status(400).json({ message: "Actor email not registered" });
      }

      const actorRole = req.user?.role as UserRoleTypes;
      const isAdmin = actorRole === UserRoleTypes.Admin || actorRole === UserRoleTypes.SuperAdmin;
      const createdBy = String((group as any)?.createdBy || "").toLowerCase();
      const actorId = String((actor as any)?.id || (actor as any)?._id || "");
      const isCreator = createdBy === actorEmail || (!!actorId && createdBy === actorId.toLowerCase());

      if ((group as any)?.isAdminOnly && !isAdmin) {
        return res.status(403).json({ message: "Only admins can delete this group" });
      }

      if (!isAdmin && !isCreator) {
        return res.status(403).json({ message: "Not authorized to delete this group" });
      }

      const memberValues = Array.isArray((group as any)?.members) ? (group as any).members : [];
      const normalizedMembers: string[] = memberValues
        .map((m: unknown) => String(m ?? "").trim())
        .filter((value: string) => value.length > 0);
      const memberEmails: string[] = Array.from(
        new Set<string>(
          normalizedMembers
            .filter((value: string) => value.includes("@"))
            .map((value: string) => value.toLowerCase())
        )
      );

      let memberUsers: any[] = [];
      if (memberEmails.length) {
        memberUsers = await userService.findSelect(
          { email: { $in: memberEmails } },
          { email: 1, fcmToken: 1 }
        ) as any[];
      }

      await chatGroupService.deleteGroupByGroupId(groupId);

      const tokensToUnsubscribe = memberUsers
        .map((user: any) => user?.fcmToken)
        .filter((token: any): token is string => Boolean(token));

      if (tokensToUnsubscribe.length) {
        await unsubscribeTokensFromTopic(tokensToUnsubscribe, groupTopic(groupId));
      }

      memberEmails.forEach((email: string) => {
        ChatSocketService.leaveUserFromGroup(email, groupId);
        ChatSocketService.emitToUser(email, "group:deleted", { groupId });
      });

      ChatSocketService.emitToGroup(groupId, "group:deleted", { groupId });

      return res.json({ message: "Group deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting group:", error);
      return res.status(500).json({
        message: error.message || "Failed to delete group",
      });
    }
  }

  async addGroupMembers(req: Request, res: Response) {
    try {
      const groupId = String(req.params.groupId || "");
      const actorEmail = String(req.user?.email || "").trim().toLowerCase();
      const memberEmailsInput: unknown[] = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails : [];

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }
      if (!actorEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      if (!memberEmailsInput.length) {
        return res.status(400).json({ message: "memberEmails array is required" });
      }

      const normalizedEmails: string[] = Array.from(
        new Set<string>(
          memberEmailsInput
            .map((email: unknown) => String(email ?? "").trim().toLowerCase())
            .filter((email: string) => email.length > 0)
        )
      );
      if (!normalizedEmails.length) {
        return res.status(400).json({ message: "No valid email addresses provided" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const actor = await userService.findOneSelect(
        { email: actorEmail },
        { email: 1, id: 1, _id: 1 }
      );
      if (!actor) {
        return res.status(400).json({ message: "Actor email not registered" });
      }

      const actorRole = req.user?.role as UserRoleTypes;
      const isAdmin = actorRole === UserRoleTypes.Admin || actorRole === UserRoleTypes.SuperAdmin;
      const createdBy = String((group as any)?.createdBy || "").toLowerCase();
      const actorId = String((actor as any)?.id || (actor as any)?._id || "");
      const isCreator = createdBy === actorEmail || (!!actorId && createdBy === actorId.toLowerCase());

      if ((group as any)?.isAdminOnly && !isAdmin) {
        return res.status(403).json({ message: "Only admins can manage members for this group" });
      }

      if (!isAdmin && !isCreator) {
        return res.status(403).json({ message: "Not authorized to manage members for this group" });
      }

      const existingMemberValues = Array.isArray((group as any)?.members) ? (group as any).members : [];
      const existingMembers = new Set<string>(
        existingMemberValues
          .map((value: unknown) => String(value ?? "").trim().toLowerCase())
          .filter((value: string) => value.length > 0)
      );

      const users = (await userService.findSelect(
        { email: { $in: normalizedEmails } },
        { email: 1, fcmToken: 1, id: 1, _id: 1 }
      )) as any[];

      const foundEmailSet = new Set<string>(
        users.map((user) => String(user?.email || "").toLowerCase()).filter((email) => email.length)
      );

      const missing = normalizedEmails.filter((email) => !foundEmailSet.has(email));

      const emailsToAdd = normalizedEmails.filter(
        (email: string) => !existingMembers.has(email) && foundEmailSet.has(email)
      );
      const emailsToAddSet = new Set<string>(emailsToAdd);

      if (!emailsToAdd.length) {
        return res.status(200).json({
          message: "No new members were added",
          group,
          added: [],
          notFound: missing,
        });
      }

      const identifiersToAdd = new Set<string>();
      users.forEach((user: any) => {
        const email: string = String(user?.email || "").toLowerCase();
        if (emailsToAddSet.has(email)) {
          identifiersToAdd.add(email);
          const userId = String(user?.id || user?._id || "");
          if (userId) {
            identifiersToAdd.add(userId);
          }
        }
      });

      const updatedGroup = await chatGroupService.addMembers(groupId, Array.from(identifiersToAdd));

      const tokensToSubscribe = users
        .filter((user) => emailsToAddSet.has(String(user?.email || "").toLowerCase()) && Boolean(user?.fcmToken))
        .map((user) => String(user.fcmToken));

      if (tokensToSubscribe.length) {
        await subscribeTokensToTopic(tokensToSubscribe, groupTopic(groupId));
      }

      emailsToAddSet.forEach((email: string) => {
        ChatSocketService.joinUserToGroup(email, groupId);
        ChatSocketService.emitToUser(email, "group:joined", {
          groupId,
          groupName: (updatedGroup as any)?.name || (group as any)?.name,
        });
      });

      const bonusResult = await btcyChatGroupBonusService.evaluateGroup(updatedGroup);

      return res.json({
        message: "Members added successfully",
        group: updatedGroup,
        added: Array.from(emailsToAddSet),
        notFound: missing,
        btcyChatGroupBonus: bonusResult,
      });
    } catch (error: any) {
      console.error("Error adding members to group:", error);
      return res.status(500).json({
        message: error.message || "Failed to add members",
      });
    }
  }

  async removeGroupMembers(req: Request, res: Response) {
    try {
      const groupId = String(req.params.groupId || "");
      const actorEmail = String(req.user?.email || "").trim().toLowerCase();
      const memberEmailsInput: unknown[] = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails : [];

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }
      if (!actorEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      if (!memberEmailsInput.length) {
        return res.status(400).json({ message: "memberEmails array is required" });
      }

      const normalizedEmails: string[] = Array.from(
        new Set<string>(
          memberEmailsInput
            .map((email: unknown) => String(email ?? "").trim().toLowerCase())
            .filter((email: string) => email.length > 0)
        )
      );
      if (!normalizedEmails.length) {
        return res.status(400).json({ message: "No valid email addresses provided" });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const actor = await userService.findOneSelect(
        { email: actorEmail },
        { email: 1, id: 1, _id: 1 }
      );
      if (!actor) {
        return res.status(400).json({ message: "Actor email not registered" });
      }

      const actorRole = req.user?.role as UserRoleTypes;
      const isAdmin = actorRole === UserRoleTypes.Admin || actorRole === UserRoleTypes.SuperAdmin;
      const createdBy = String((group as any)?.createdBy || "").toLowerCase();
      const actorId = String((actor as any)?.id || (actor as any)?._id || "");
      const isCreator = createdBy === actorEmail || (!!actorId && createdBy === actorId.toLowerCase());

      if ((group as any)?.isAdminOnly && !isAdmin) {
        return res.status(403).json({ message: "Only admins can manage members for this group" });
      }

      if (!isAdmin && !isCreator) {
        return res.status(403).json({ message: "Not authorized to manage members for this group" });
      }

      const existingMemberValues = Array.isArray((group as any)?.members) ? (group as any).members : [];
      const existingMembers = new Set<string>(
        existingMemberValues
          .map((value: unknown) => String(value ?? "").trim().toLowerCase())
          .filter((value: string) => value.length > 0)
      );

      const emailsToRemove = normalizedEmails.filter((email: string) => existingMembers.has(email));
      const emailsToRemoveSet = new Set<string>(emailsToRemove);
      const notInGroup = normalizedEmails.filter((email: string) => !existingMembers.has(email));

      if (!emailsToRemove.length) {
        return res.status(200).json({
          message: "No matching members were found in the group",
          group,
          removed: [],
          notInGroup,
        });
      }

      const users = (await userService.findSelect(
        { email: { $in: emailsToRemove } },
        { email: 1, fcmToken: 1, id: 1, _id: 1 }
      )) as any[];

      const identifiersToRemove = new Set<string>(emailsToRemove);
      users.forEach((user: any) => {
        const userId = String(user?.id || user?._id || "");
        if (userId) {
          identifiersToRemove.add(userId);
        }
      });

      const updatedGroup = await chatGroupService.removeMembers(groupId, Array.from(identifiersToRemove));

      const tokensToUnsubscribe = users
        .map((user) => user?.fcmToken)
        .filter((token: any): token is string => Boolean(token));

      if (tokensToUnsubscribe.length) {
        await unsubscribeTokensFromTopic(tokensToUnsubscribe, groupTopic(groupId));
      }

      emailsToRemoveSet.forEach((email: string) => {
        ChatSocketService.leaveUserFromGroup(email, groupId);
        ChatSocketService.emitToUser(email, "group:removed", { groupId });
      });

      return res.json({
        message: "Members removed successfully",
        group: updatedGroup,
        removed: Array.from(emailsToRemoveSet),
        notInGroup,
      });
    } catch (error: any) {
      console.error("Error removing members from group:", error);
      return res.status(500).json({
        message: error.message || "Failed to remove members",
      });
    }
  }

  async syncGroupMembers(req: Request, res: Response) {
    try {
      const groupId = String(req.params.groupId || "");
      const actorEmail = String(req.user?.email || "").trim().toLowerCase();
      const addInput: unknown[] = Array.isArray(req.body?.addMemberEmails) ? req.body.addMemberEmails : [];
      const removeInput: unknown[] = Array.isArray(req.body?.removeMemberEmails) ? req.body.removeMemberEmails : [];

      if (!groupId) {
        return res.status(400).json({ message: "groupId is required" });
      }
      if (!actorEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const normalize = (entries: unknown[]): string[] =>
        Array.from(
          new Set(
            entries
              .map((value: unknown) => String(value ?? "").trim().toLowerCase())
              .filter((value: string) => value.length > 0)
          )
        );

      const addEmails = normalize(addInput);
      const removeEmails = normalize(removeInput);

      if (!addEmails.length && !removeEmails.length) {
        return res.status(400).json({ message: "No member changes requested" });
      }

      const removalCandidates = new Set(removeEmails);
      const conflicts = addEmails.filter((email) => removalCandidates.has(email));
      if (conflicts.length) {
        return res.status(400).json({
          message: "Cannot add and remove the same members in a single request",
          conflicts,
        });
      }

      const group = await chatGroupService.findOne({ groupId });
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const actor = await userService.findOneSelect(
        { email: actorEmail },
        { email: 1, id: 1, _id: 1 }
      );
      if (!actor) {
        return res.status(400).json({ message: "Actor email not registered" });
      }

      const actorRole = req.user?.role as UserRoleTypes;
      const isAdmin = actorRole === UserRoleTypes.Admin || actorRole === UserRoleTypes.SuperAdmin;
      const createdBy = String((group as any)?.createdBy || "").toLowerCase();
      const actorId = String((actor as any)?.id || (actor as any)?._id || "");
      const isCreator = createdBy === actorEmail || (!!actorId && createdBy === actorId.toLowerCase());

      if ((group as any)?.isAdminOnly && !isAdmin) {
        return res.status(403).json({ message: "Only admins can manage members for this group" });
      }

      if (!isAdmin && !isCreator) {
        return res.status(403).json({ message: "Not authorized to manage members for this group" });
      }

      const toMemberSet = (grp: any): Set<string> =>
        new Set(
          (Array.isArray(grp?.members) ? grp.members : [])
            .map((value: unknown) => String(value ?? "").trim().toLowerCase())
            .filter((value: string) => value.length > 0)
        );

      const added: Set<string> = new Set();
      const removed: Set<string> = new Set();
      const alreadyMembers: Set<string> = new Set();
      const notFound: Set<string> = new Set();
      const notInGroup: Set<string> = new Set();

      let updatedGroup: any = group;

      if (removeEmails.length) {
        const currentMembers = toMemberSet(updatedGroup);
        const emailsToRemove = removeEmails.filter((email) => currentMembers.has(email));
        removeEmails
          .filter((email) => !currentMembers.has(email))
          .forEach((email) => notInGroup.add(email));

        if (emailsToRemove.length) {
          const users = (await userService.findSelect(
            { email: { $in: emailsToRemove } },
            { email: 1, fcmToken: 1, id: 1, _id: 1 }
          )) as any[];

          const identifiersToRemove = new Set<string>(emailsToRemove);
          users.forEach((user: any) => {
            const userId = String(user?.id || user?._id || "");
            if (userId) {
              identifiersToRemove.add(userId);
            }
          });

          const removedGroup = await chatGroupService.removeMembers(groupId, Array.from(identifiersToRemove));
          if (removedGroup) {
            updatedGroup = removedGroup;
          }
          emailsToRemove.forEach((email) => removed.add(email));

          const tokensToUnsubscribe = users
            .map((user) => user?.fcmToken)
            .filter((token: any): token is string => Boolean(token));
          if (tokensToUnsubscribe.length) {
            await unsubscribeTokensFromTopic(tokensToUnsubscribe, groupTopic(groupId));
          }

          emailsToRemove.forEach((email) => {
            ChatSocketService.leaveUserFromGroup(email, groupId);
            ChatSocketService.emitToUser(email, "group:removed", { groupId });
          });
        }
      }

      if (addEmails.length) {
        const currentMembers = toMemberSet(updatedGroup);
        addEmails
          .filter((email) => currentMembers.has(email))
          .forEach((email) => alreadyMembers.add(email));

        const candidates = addEmails.filter((email) => !currentMembers.has(email));

        if (candidates.length) {
          const users = (await userService.findSelect(
            { email: { $in: candidates } },
            { email: 1, fcmToken: 1, id: 1, _id: 1 }
          )) as any[];

          const foundEmails = new Set<string>(
            users.map((user) => String(user?.email || "").toLowerCase()).filter((email) => email.length)
          );

          candidates
            .filter((email) => !foundEmails.has(email))
            .forEach((email) => notFound.add(email));

          const emailsToAdd = candidates.filter((email) => foundEmails.has(email));

          if (emailsToAdd.length) {
            const identifiersToAdd = new Set<string>();
            users.forEach((user: any) => {
              const email = String(user?.email || "").toLowerCase();
              if (emailsToAdd.includes(email)) {
                identifiersToAdd.add(email);
                const userId = String(user?.id || user?._id || "");
                if (userId) {
                  identifiersToAdd.add(userId);
                }
              }
            });

            const addedGroup = await chatGroupService.addMembers(groupId, Array.from(identifiersToAdd));
            if (addedGroup) {
              updatedGroup = addedGroup;
            }
            emailsToAdd.forEach((email) => added.add(email));

            const tokensToSubscribe = users
              .filter((user) => emailsToAdd.includes(String(user?.email || "").toLowerCase()) && Boolean(user?.fcmToken))
              .map((user) => String(user.fcmToken));
            if (tokensToSubscribe.length) {
              await subscribeTokensToTopic(tokensToSubscribe, groupTopic(groupId));
            }

            emailsToAdd.forEach((email) => {
              ChatSocketService.joinUserToGroup(email, groupId);
              ChatSocketService.emitToUser(email, "group:joined", {
                groupId,
                groupName: (updatedGroup as any)?.name || (group as any)?.name,
              });
            });
          }
        }
      }

      const finalGroup = (await chatGroupService.findOne({ groupId })) || updatedGroup;
      const bonusResult = added.size
        ? await btcyChatGroupBonusService.evaluateGroup(finalGroup)
        : { granted: false, reason: "no-members-added" };

      return res.json({
        message: "Group members updated successfully",
        group: finalGroup,
        added: Array.from(added),
        removed: Array.from(removed),
        alreadyMembers: Array.from(alreadyMembers),
        notFound: Array.from(notFound),
        notInGroup: Array.from(notInGroup),
        btcyChatGroupBonus: bonusResult,
      });
    } catch (error: any) {
      console.error("Error syncing group members:", error);
      return res.status(500).json({
        message: error.message || "Failed to update group members",
      });
    }
  }

  // src/controllers/ChatController.ts  (add two methods inside ChatController)
  async getUnreadSummary(req: Request, res: Response) {
    try {
      const me = String(req.query.email || "").trim().toLowerCase();
      if (!me) return res.status(400).json({ message: "email is required" });

      // 1) DMs (one aggregation)
      const blocked = await this.getDirectBlockedList(me);
      const dm = await chatService.directUnreadSummary(me, {
        excludeSenderEmails: blocked,
      });

      // 2) Groups (per group using lastReadAt)
      const groups = await chatGroupService.getUserGroups(me);
      const groupIds = (groups || []).map((g: any) => String(g.groupId)).filter(Boolean);

      const perGroup = await Promise.all(
        groupIds.map(async (gid) => {
          const last = await groupRead.getLastRead(me, gid);
          const blockedForGroup = await this.getGroupBlockedList(me, gid);
          const count = await chatService.countGroupUnreadForUser(gid, me, last, {
            excludeSenderEmails: blockedForGroup,
          });
          return { groupId: gid, count };
        })
      );
      const groupsTotal = perGroup.reduce((s, x) => s + x.count, 0);

      const total = dm.total + groupsTotal;
      return res.json({ total, direct: dm, groups: { total: groupsTotal, perGroup } });
    } catch (e: any) {
      console.error("getUnreadSummary error:", e);
      return res.status(500).json({ message: e.message || "Failed to get unread summary" });
    }
  }


  private buildReplyMetadata(msg: any) {
    const attachment = this.normalizeAttachment(msg?.fileUrl, msg?.fileType);
    return {
      messageId: msg.messageId || String((msg as any)._id),
      email: msg.email,
      firstName: msg.firstName,
      lastName: msg.lastName,
      message: (msg.message ?? '').slice(0, 200),
      ...(attachment.fileUrl ? { fileUrl: attachment.fileUrl } : {}),
      ...(attachment.fileType ? { fileType: attachment.fileType } : {}),
      timestamp: msg.timestamp ?? new Date(),
    };
  }

  private async getDirectBlockedList(email: string): Promise<string[]> {
    const lower = String(email || "").trim().toLowerCase();
    if (!lower) return [];
    try {
      return await chatUserBlockService.getBlockedLowerList(lower, null);
    } catch {
      return [];
    }
  }

  private async getGroupBlockedList(email: string, groupId: string): Promise<string[]> {
    const lower = String(email || "").trim().toLowerCase();
    const gid = String(groupId || "").trim();
    if (!lower || !gid) return [];
    try {
      return await chatUserBlockService.getBlockedLowerListForGroupOrDirect(lower, gid);
    } catch {
      return [];
    }
  }

  private buildReplySummary(msg: any) {
    const attachment = this.normalizeAttachment(msg?.fileUrl, msg?.fileType);
    return {
      messageId: msg.messageId || String((msg as any)._id),
      email: msg.email,
      firstName: msg.firstName,
      lastName: msg.lastName,
      message: (msg.message ?? '').slice(0, 200),
      ...(attachment.fileUrl ? { fileUrl: attachment.fileUrl } : {}),
      ...(attachment.fileType ? { fileType: attachment.fileType } : {}),
      timestamp: msg.timestamp ?? new Date(),
    };
  }

  private async findMessageByAnyId(id: string) {
    // 1) try UUID messageId
    const byMessageId = await chatService.findOne({ messageId: id });
    if (byMessageId) return byMessageId;

    // 2) fallback to Mongo _id only if valid
    if (Types.ObjectId.isValid(id)) {
      return await chatService.findOne({ _id: new Types.ObjectId(id) });
    }
    return null;
  }


  // after saving a DM (inside sendMessage, after `const saved = await chatService.sendMessage(...)`)
  private async emitDirectUnreadBump(receiverEmail: string, senderEmail: string) {
    try {
      const blocked = await this.getDirectBlockedList(receiverEmail);
      const perPeerCount = await chatService.directUnreadForPeer(receiverEmail, senderEmail, {
        excludeSenderEmails: blocked,
      });
      ChatSocketService.emitToUser(receiverEmail, "counts:direct", {
        peerEmail: senderEmail,
        unread: perPeerCount,
      });
    } catch { }
  }

  private normalizeAttachment(
    fileUrl: any,
    fileType: any
  ): { fileUrl?: string; fileType?: AttachmentFileType } {
    const normalizedUrl =
      typeof fileUrl === "string" && fileUrl.trim().length > 0
        ? fileUrl.trim()
        : undefined;

    const normalizedType = this.normalizeFileType(fileType);

    return {
      fileUrl: normalizedUrl,
      fileType: normalizedType,
    };
  }

  private normalizeFileType(value: any): AttachmentFileType | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;
    if (ALLOWED_FILE_TYPES.has(trimmed as AttachmentFileType)) {
      return trimmed as AttachmentFileType;
    }
    return undefined;
  }

  // after saving a GROUP message (inside sendGroupMessage, after save)
  // You already emit "message:new". For counts, you can keep your existing
  // GET /groups/:groupId/unread/count usage. If you want push, emit a
  // light event (clients re-pull the one group to keep server cheap):
  private emitGroupBump(groupId: string) {
    ChatSocketService.emitToGroup(groupId, "counts:group:dirty", { groupId });
  }

  // Admin-only group management endpoints
  async createAdminOnlyGroup(req: Request, res: Response) {
    try {
      const { email, name } = req.body;

      if (!email || !name) {
        return res.status(400).json({ message: "email and name are required" });
      }

      // Check if user is admin
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Email not registered" });
      }

      const isAdmin = req.user.role === UserRoleTypes.Admin;
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can create admin-only groups" });
      }

      const group = await chatGroupService.createAdminOnlyGroup(name, user.email);
      return res.status(201).json(group);
    } catch (error: any) {
      console.error("Error creating admin-only group:", error);
      return res.status(500).json({
        message: error.message || "Failed to create admin-only group"
      });
    }
  }

  async updateAdminOnlyGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { email, name } = req.body;

      if (!email || !groupId) {
        return res.status(400).json({ message: "email and groupId are required" });
      }

      // Check if user is admin
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Email not registered" });
      }

      const isAdmin = req.user.role === UserRoleTypes.Admin;
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can update admin-only groups" });
      }

      const updatedGroup = await chatGroupService.updateAdminOnlyGroup(groupId, { name });
      if (!updatedGroup) {
        return res.status(404).json({ message: "Admin-only group not found" });
      }

      return res.json(updatedGroup);
    } catch (error: any) {
      console.error("Error updating admin-only group:", error);
      return res.status(500).json({
        message: error.message || "Failed to update admin-only group"
      });
    }
  }

  async getAdminOnlyGroups(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "email is required" });
      }

      // Check if user is admin
      const user = await userService.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Email not registered" });
      }

      const isAdmin = req.user.role === UserRoleTypes.Admin;
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can view admin-only group management" });
      }

      const groups = await chatGroupService.getAdminOnlyGroups();
      return res.json(groups);
    } catch (error: any) {
      console.error("Error fetching admin-only groups:", error);
      return res.status(500).json({
        message: error.message || "Failed to fetch admin-only groups"
      });
    }
  }

  async getAdminGroupBonusRewards(req: Request, res: Response) {
    try {
      const requesterRole = req.user?.role as UserRoleTypes;
      if (!isAdminRole(requesterRole)) {
        return res.status(403).json({ message: "Only admins can view BTCY Chat group bonus rewards" });
      }

      const result = await btcyChatGroupBonusService.getAdminDashboard({
        from: String(req.query.from || req.query.startDate || "").trim(),
        to: String(req.query.to || req.query.endDate || "").trim(),
        ownerEmail: String(req.query.owner || req.query.ownerEmail || "").trim(),
        groupId: String(req.query.groupId || "").trim(),
        status: String(req.query.status || req.query.rewardStatus || "").trim(),
        page: Number(req.query.page ?? 0),
        pageSize: Number(req.query.pageSize ?? req.query.limit ?? 25),
      });

      return res.status(result.status).json(result);
    } catch (error: any) {
      console.error("Error fetching BTCY Chat group bonus rewards:", error);
      return res.status(500).json({
        status: 500,
        data: {
          message: error.message || "Failed to fetch BTCY Chat group bonus rewards",
        },
      });
    }
  }

  // Chat muting functionality
  async muteChat(req: Request, res: Response) {
    try {
      const { email, chatId, newState } = req.body;

      if (!email || !chatId) {
        return res.status(400).json({ message: "email and chatId are required" });
      }

      // Verify user exists
      const user = await userService.findOneSelect({ email }, { email: 1 });
      if (!user) {
        return res.status(400).json({ message: "Email not registered" });
      }
      const update = await userService.muteChat(email, chatId, newState);
      return res.json({
        message: "Chat muted/unmuted successfully",
      });
    } catch (error: any) {
      console.error("Error muting chat:", error);
      return res.status(500).json({ message: error.message || "Failed to mute chat" });
    }
  }

  // Update message functionality
  async updateMessage(req: Request, res: Response) {
    try {
      const { messageId, newMessage } = req.body;

      if (!messageId || !newMessage) {
        return res
          .status(400)
          .json({ message: "messageId and newMessage are required" });
      }

      // Get user from token
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res
          .status(401)
          .json({ message: "Error while authenticating. Please login again" });
      }
      const updatedMessage = await chatService.updateMessage(
        messageId,
        userEmail,
        newMessage
      );
      return res.json({
        message: "Message updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating message:", error.message);
      return res.status(500).json({
        message: error.message || "Failed to update message"
      });
    }
  }

  // Delete message functionality
  async deleteMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.body;

      if (!messageId) {
        return res.status(400).json({ message: "messageId is required" });
      }

      // Get user from token
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Delete the message
      const deletedMessage = await chatService.deleteMessage(
        messageId,
        userEmail
      );
      return res.json({
        message: "Message deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting message:", error.message);
      return res.status(500).json({
        message: error.message || "Failed to delete message",
      });
    }
  }

  // Realtime fan-out for reaction changes: group rooms for group chats,
  // both participants' user rooms for direct messages.
  private broadcastReactionUpdate(message: any) {
    if (!message) return;
    try {
      const payload = {
        messageId: message.messageId,
        _id: message._id,
        groupId: message.groupId,
        reactions: message.reactions ?? [],
      };
      if (message.groupId) {
        ChatSocketService.emitToGroup(message.groupId, "reaction:update", payload);
      } else {
        if (message.email) {
          ChatSocketService.emitToUser(message.email, "reaction:update", payload);
        }
        if (message.receiverEmail) {
          ChatSocketService.emitToUser(message.receiverEmail, "reaction:update", payload);
        }
      }
    } catch (err: any) {
      console.error("Error broadcasting reaction update:", err?.message);
    }
  }

  // Add reaction functionality
  async addReaction(req: Request, res: Response) {
    try {
      const { messageId, name } = req.body;

      if (!messageId || !name) {
        return res.status(400).json({ message: "messageId and name are required" });
      }

      // Get user from token
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Add the reaction
      const updatedMessage = await chatService.addReaction(
        messageId,
        userEmail,
        name
      );

      this.broadcastReactionUpdate(updatedMessage);

      return res.json({
        message: "Reaction added successfully",
        data: updatedMessage
      });
    } catch (error: any) {
      console.error("Error adding reaction:", error.message);
      return res.status(500).json({
        message: error.message || "Failed to add reaction",
      });
    }
  }

  // Remove reaction functionality
  async removeReaction(req: Request, res: Response) {
    try {
      const { messageId, name } = req.body;

      if (!messageId || !name) {
        return res.status(400).json({ message: "messageId and name are required" });
      }

      // Get user from token
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Remove the reaction
      const updatedMessage = await chatService.removeReaction(
        messageId,
        userEmail,
        name
      );

      this.broadcastReactionUpdate(updatedMessage);

      return res.json({
        message: "Reaction removed successfully",
        data: updatedMessage
      });
    } catch (error: any) {
      console.error("Error removing reaction:", error.message);
      return res.status(500).json({
        message: error.message || "Failed to remove reaction",
      });
    }
  }
}
