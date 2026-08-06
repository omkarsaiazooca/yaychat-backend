import { P2PTradeService } from "../services/p2p.service";
import { EscrowService } from "../services/escrow.service";
import { P2PTradeStatus } from "../data/p2p";

export class P2PCronService {
  private p2pTradeService: P2PTradeService;
  private escrowService: EscrowService;

  constructor() {
    this.p2pTradeService = new P2PTradeService();
    this.escrowService = new EscrowService();
  }

  // Process expired trades
  async processExpiredTrades(): Promise<void> {
    try {
      console.log("🔄 Processing expired P2P trades...");
      
      // Get expired trades
      const expiredTrades = await this.p2pTradeService.getExpiredTrades();
      
      if (expiredTrades.length === 0) {
        console.log("✅ No expired trades found");
        return;
      }

      console.log(`📊 Found ${expiredTrades.length} expired trades`);

      for (const trade of expiredTrades) {
        try {
          // Refund escrow if trade was paid but not confirmed
          if (trade.status === P2PTradeStatus.Paid) {
            await this.escrowService.refundFromEscrow(
              trade.buyerEmail,
              trade.cryptoCurrency,
              trade.cryptoNetwork,
              trade.cryptoAmount,
              trade.tradeId
            );
            console.log(`💰 Refunded escrow for trade ${trade.tradeId}`);
          }

          // Mark trade as expired
          await this.p2pTradeService.updateTradeStatus(trade.tradeId, P2PTradeStatus.Expired);

          // Restore offer availability
          await this.restoreOfferAvailability(trade);

          console.log(`⏰ Expired trade ${trade.tradeId}`);
        } catch (error) {
          console.error(`❌ Error processing expired trade ${trade.tradeId}:`, error);
        }
      }

      console.log("✅ Expired trades processing completed");
    } catch (error) {
      console.error("❌ Error processing expired trades:", error);
    }
  }

  // Process automatic escrow releases
  async processAutomaticEscrowReleases(): Promise<void> {
    try {
      console.log("🔄 Processing automatic escrow releases...");
      
      await this.escrowService.processAutomaticReleases();
      
      console.log("✅ Automatic escrow releases processing completed");
    } catch (error) {
      console.error("❌ Error processing automatic escrow releases:", error);
    }
  }

  // Update user online status
  async updateUserOnlineStatus(): Promise<void> {
    try {
      console.log("🔄 Updating user online status...");
      
      // This would typically check last activity timestamps
      // For now, we'll implement a simple version
      const { P2POfferService } = require("../services/p2p.service");
      const p2pOfferService = new P2POfferService();
      
      // Update offers where user hasn't been active for more than 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      await p2pOfferService.updateMany(
        { 
          isOnline: true,
          lastSeen: { $lt: thirtyMinutesAgo }
        },
        {
          $set: { isOnline: false }
        }
      );
      
      console.log("✅ User online status updated");
    } catch (error) {
      console.error("❌ Error updating user online status:", error);
    }
  }

  // Clean up old completed trades (optional - for data management)
  async cleanupOldTrades(): Promise<void> {
    try {
      console.log("🔄 Cleaning up old completed trades...");
      
      // Delete trades completed more than 90 days ago
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const result = await this.p2pTradeService.deleteMany({
        status: P2PTradeStatus.Completed,
        completedAt: { $lt: ninetyDaysAgo }
      });
      
      console.log(`🗑️ Cleaned up ${result.deletedCount} old trades`);
    } catch (error) {
      console.error("❌ Error cleaning up old trades:", error);
    }
  }

  // Private helper methods
  private async restoreOfferAvailability(trade: any): Promise<void> {
    try {
      const { P2POfferService } = require("../services/p2p.service");
      const p2pOfferService = new P2POfferService();
      
      const offer = await p2pOfferService.findOne({ offerId: trade.offerId });
      if (offer) {
        const newAvailableAmount = offer.availableAmount + trade.fiatAmount;
        await p2pOfferService.updateAvailability(trade.offerId, newAvailableAmount);
      }
    } catch (error) {
      console.error("Error restoring offer availability:", error);
    }
  }

  // Main cron job runner
  async runCronJobs(): Promise<void> {
    try {
      console.log("🚀 Starting P2P cron jobs...");
      
      await Promise.all([
        this.processExpiredTrades(),
        this.processAutomaticEscrowReleases(),
        this.updateUserOnlineStatus()
      ]);
      
      // Run cleanup less frequently (weekly)
      const shouldRunCleanup = Math.random() < 0.1; // 10% chance
      if (shouldRunCleanup) {
        await this.cleanupOldTrades();
      }
      
      console.log("✅ P2P cron jobs completed");
    } catch (error) {
      console.error("❌ Error running P2P cron jobs:", error);
    }
  }
}




















