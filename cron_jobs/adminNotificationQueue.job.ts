import { Queue } from "bull";
import { AdminNotificationJobService } from "../services/adminNotificationJob.service";
import { NotificationService } from "../services/notification.service";
import { UserService } from "../services/user.service";

// Helper function to chunk array
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const setupAdminNotificationQueueProcessor = (notificationQueue: Queue) => {
  const adminNotificationJobService: AdminNotificationJobService = new AdminNotificationJobService();
  const notificationService: NotificationService = new NotificationService();
  const uservice: UserService = new UserService();
  notificationQueue.process('send-admin-notification', async (job) => {
    const { jobId, notificationData, emails, sendToAll } = job.data;

    try {
      await adminNotificationJobService.updateJobProgress(jobId, {
        status: 'processing',
        startedAt: new Date()
      });

      if (sendToAll) {
        await notificationService.sendToAllUsersViaTopic(notificationData);

        // Get total user count
        const totalUsers = await uservice.findCount({});

        await adminNotificationJobService.updateJobProgress(jobId, {
          status: 'completed',
          totalRecipients: totalUsers,
          processedCount: totalUsers,
          successCount: totalUsers,
          completedAt: new Date()
        });
      } else {
        // Process in batches
        const batchSize = 100;
        const batches = chunkArray(emails, batchSize);
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        const allErrors: string[] = [];

        for (const batch of batches) {
          const users = await uservice.find({ email: { $in: batch } });
          const result = await notificationService.sendAdminNotificationBatch(users, notificationData);

          totalProcessed += batch.length;
          totalSuccess += result.successCount;
          totalFailed += result.failedCount;
          allErrors.push(...result.errors);

          // Update progress after each batch
          await adminNotificationJobService.updateJobProgress(jobId, {
            processedCount: totalProcessed,
            successCount: totalSuccess,
            failedCount: totalFailed,
            errorMessages: allErrors
          });

          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        await adminNotificationJobService.updateJobProgress(jobId, {
          status: 'completed',
          completedAt: new Date()
        });
      }
    } catch (error: any) {
      await adminNotificationJobService.updateJobProgress(jobId, {
        status: 'failed',
        errorMessages: [error.message],
        completedAt: new Date()
      });
    }
  });

  notificationQueue.on("completed", (job, result) => {
    console.log(`Admin notification job ${job.id} completed`);
  });

  notificationQueue.on("failed", (job, err) => {
    console.error(`Admin notification job ${job.id} failed:`, err.message);
  });
};
