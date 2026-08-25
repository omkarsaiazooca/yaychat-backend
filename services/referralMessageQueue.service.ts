import Queue1, { Queue } from "bull";
import { ChatMessageService } from "./chatmessage.service";
import { NotificationService } from "./notification.service";
import { ChatSocketService } from "./chatWebsocket.service";

const REDIS_HOST =
  process.env.REDIS_HOST || "redis-11678.c289.us-west-1-2.ec2.cloud.redislabs.com";
const REDIS_PORT = Number(process.env.REDIS_PORT || 11678);
const REDIS_PASSWORD =
  process.env.REDIS_PASSWORD;

const REFERRAL_MESSAGE_FANOUT_JOB = "fanout-referral-messages";

type ReferralMessageRecipient = {
  _id?: any;
  email: string;
  fcmToken?: string;
};

type ReferralSavedMessage = {
  _id?: any;
  messageId: string;
  receiverEmail: string;
  email: string;
  firstName?: string;
  lastName?: string;
  message?: string;
  fileUrl?: string;
  fileType?: string;
  timestamp?: Date | string;
};

export type ReferralMessageFanoutJob = {
  broadcastId: string;
  senderEmail: string;
  preview: string;
  blockedRecipientEmails: string[];
  recipients: ReferralMessageRecipient[];
  messages: ReferralSavedMessage[];
};

const chatService = new ChatMessageService();
const notificationService = new NotificationService();

export const referralMessageQueue: Queue = new Queue1("referral-message-fanout", {
  redis: {
    port: REDIS_PORT,
    host: REDIS_HOST,
    password: REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 1000 },
  },
});

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const pool = new Set<Promise<void>>();

  for (const item of items) {
    const task = worker(item)
      .catch((err) => {
        console.error("[referral-message-fanout] recipient worker failed", err);
      })
      .finally(() => {
        pool.delete(task);
      });

    pool.add(task);

    if (pool.size >= limit) {
      await Promise.race(pool);
    }
  }

  await Promise.all(pool);
}

export async function enqueueReferralMessageFanout(data: ReferralMessageFanoutJob) {
  return referralMessageQueue.add(REFERRAL_MESSAGE_FANOUT_JOB, data, {
    jobId: data.broadcastId,
  });
}

export function setupReferralMessageQueueProcessor() {
  referralMessageQueue.on("error", (err) => {
    console.error("[referral-message-fanout] queue error:", err);
  });

  referralMessageQueue.on("failed", (job, err) => {
    console.error(
      `[referral-message-fanout] job ${job?.id} failed:`,
      err?.message || err
    );
  });

  referralMessageQueue.on("completed", (job, result) => {
    console.log("[referral-message-fanout] job completed", {
      jobId: job?.id,
      result,
    });
  });

  referralMessageQueue.process(2, async (job) => {
    const data = job.data as ReferralMessageFanoutJob;
    const blocked = new Set(
      (data.blockedRecipientEmails || [])
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const recipientByEmail = new Map(
      (data.recipients || []).map((recipient) => [
        String(recipient.email || "").trim().toLowerCase(),
        recipient,
      ])
    );

    let notified = 0;
    let skippedBlocked = 0;

    await runWithConcurrency(data.messages || [], 20, async (saved) => {
      const receiverEmail = String(saved.receiverEmail || "").trim().toLowerCase();
      const receiver = recipientByEmail.get(receiverEmail);
      if (!receiver) return;

      if (blocked.has(receiverEmail)) {
        skippedBlocked++;
        return;
      }

      ChatSocketService.emitToUser(receiver.email, "message:new", saved);

      try {
        const unreadForReceiverFromSender = await chatService.countDirectMessages(receiver.email, {
          peer: data.senderEmail,
          unreadOnly: true,
        });

        ChatSocketService.emitToUser(receiver.email, "counts:direct", {
          peerEmail: data.senderEmail,
          unread: unreadForReceiverFromSender,
        });
      } catch { }

      try {
        const notifRes = await notificationService.sendNotification(receiver, "chat_message", {
          from: data.senderEmail,
          preview: data.preview,
        });
        const notificationId = notifRes.notificationId;

        if (notificationId) {
          await chatService.updatePart({ _id: saved._id }, { $set: { notificationId } });
          (saved as any).notificationId = notificationId;
        }

        ChatSocketService.emitToUser(receiver.email, "notification:new", {
          type: "chat_message",
          title: "New message",
          body: data.preview,
          createdAt: new Date(),
        });
        notified++;
      } catch (notificationError) {
        console.error("[referral-message-fanout] notification failed", {
          sender: data.senderEmail,
          receiver: receiver.email,
          error: notificationError,
        });
      }
    });

    ChatSocketService.emitToUser(data.senderEmail, "messages:referrals:sent", {
      broadcastId: data.broadcastId,
      sentCount: data.messages?.length || 0,
      notifiedCount: notified,
      blockedNotificationCount: skippedBlocked,
    });

    return {
      broadcastId: data.broadcastId,
      sentCount: data.messages?.length || 0,
      notifiedCount: notified,
      blockedNotificationCount: skippedBlocked,
    };
  });
}
