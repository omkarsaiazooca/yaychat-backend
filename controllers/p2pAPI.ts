import { Request, Response } from "express";
import { P2POperations } from "../platform/p2p.operations";

export class P2PController {
  constructor() {
    this.createOffer = this.createOffer.bind(this);
    this.getOffers = this.getOffers.bind(this);
    this.getSellOffers = this.getSellOffers.bind(this);
    this.getBuyOffers = this.getBuyOffers.bind(this);
    this.createTrade = this.createTrade.bind(this);
    this.getTradeDetails = this.getTradeDetails.bind(this);
    this.sendPaymentToEscrow = this.sendPaymentToEscrow.bind(this);
    this.confirmPaymentReceived = this.confirmPaymentReceived.bind(this);
    this.sendCryptoToEscrow = this.sendCryptoToEscrow.bind(this);
    this.confirmCryptoReceived = this.confirmCryptoReceived.bind(this);
    this.releaseEscrow = this.releaseEscrow.bind(this);
    this.cancelTrade = this.cancelTrade.bind(this);
    this.getUserTrades = this.getUserTrades.bind(this);
    this.getOfferDetails = this.getOfferDetails.bind(this);
    this.updateOffer = this.updateOffer.bind(this);
    this.deleteOffer = this.deleteOffer.bind(this);
    this.createDispute = this.createDispute.bind(this);
    this.getDisputes = this.getDisputes.bind(this);
    this.submitRating = this.submitRating.bind(this);
    this.getUserRatings = this.getUserRatings.bind(this);
    this.joinOfferWithAsset = this.joinOfferWithAsset.bind(this);
    this.joinOfferWithGateway = this.joinOfferWithGateway.bind(this);
    this.adminSignup = this.adminSignup.bind(this);
    this.adminLogin = this.adminLogin.bind(this);
    this.createAdminAssetWallet = this.createAdminAssetWallet.bind(this);
    this.fundAdminAssetWallet = this.fundAdminAssetWallet.bind(this);
    this.getAdminBalance = this.getAdminBalance.bind(this);
    this.getUserCompletedTrades = this.getUserCompletedTrades.bind(this);
    this.getUserPendingTrades = this.getUserPendingTrades.bind(this);
    this.adminGetAllOffers = this.adminGetAllOffers.bind(this);
    this.adminGetOfferIds = this.adminGetOfferIds.bind(this);
    this.createOfferWithAssetWallet = this.createOfferWithAssetWallet.bind(this);
    this.userUpdateOffer = this.userUpdateOffer.bind(this);
    this.userDeleteOffer = this.userDeleteOffer.bind(this);
    this.userPauseOffer = this.userPauseOffer.bind(this);
    this.userListEscrows = this.userListEscrows.bind(this);
    this.getUserOffers = this.getUserOffers.bind(this);
    this.userJoinOfferWithAsset = this.userJoinOfferWithAsset.bind(this);
  }

  // Create a new P2P offer
  async createOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.createOffer(req, res);
  }

  // Get P2P offers with filters
  async getOffers(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getOffers(req, res);
  }

  // Get all sell offers
  async getSellOffers(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getSellOffers(req, res);
  }

  // Get all buy offers
  async getBuyOffers(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getBuyOffers(req, res);
  }

  // Get specific offer details
  async getOfferDetails(req: Request, res: Response) {
    try {
      const { offerId } = req.params;
      const p2pOps = new P2POperations(req, res);
      
      const offer = await p2pOps.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      return res.status(200).json({
        status: 200,
        data: offer,
        message: "Offer details retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting offer details:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get offer details",
        error: error.message
      });
    }
  }

  // Update P2P offer
  async updateOffer(req: Request, res: Response) {
    try {
      const email = req.body.email || req.user?.email;
      const { offerId } = req.params;
      const updateData = req.body;

      const p2pOps = new P2POperations(req, res);
      
      // Check if user owns the offer (if email provided)
      if (email) {
        const offer = await p2pOps.p2pOfferService.findOne({ offerId, creatorEmail: email });
        if (!offer) {
          return res.status(404).json({ message: "Offer not found or access denied" });
        }
      }

      // Update offer
      const updatedOffer = await p2pOps.p2pOfferService.updatePart(
        { offerId },
        { 
          $set: { 
            ...updateData,
            updatedAt: new Date()
          }
        }
      );

      return res.status(200).json({
        status: 200,
        data: updatedOffer,
        message: "Offer updated successfully"
      });

    } catch (error: any) {
      console.error("Error updating offer:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to update offer",
        error: error.message
      });
    }
  }

  // Delete P2P offer
  async deleteOffer(req: Request, res: Response) {
    try {
      const email = req.body.email || req.user?.email;
      const { offerId } = req.params;

      const p2pOps = new P2POperations(req, res);
      
      // Check if user owns the offer (if email provided)
      if (email) {
        const offer = await p2pOps.p2pOfferService.findOne({ offerId, creatorEmail: email });
        if (!offer) {
          return res.status(404).json({ message: "Offer not found or access denied" });
        }
      }

      // Check if there are active trades
      const activeTrades = await p2pOps.p2pTradeService.find({ 
        offerId, 
        status: { $in: ["Pending", "Paid"] } 
      });

      if (activeTrades.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete offer with active trades" 
        });
      }

      // Delete offer
      await p2pOps.p2pOfferService.deleteOne({ offerId });

      return res.status(200).json({
        status: 200,
        message: "Offer deleted successfully"
      });

    } catch (error: any) {
      console.error("Error deleting offer:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to delete offer",
        error: error.message
      });
    }
  }

  // Create a new P2P trade
  async createTrade(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.createTrade(req, res);
  }

  // Mark trade as paid
  async markAsPaid(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.markAsPaid(req, res);
  }

  // Confirm payment and release escrow
  async confirmPayment(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.confirmPayment(req, res);
  }

  // Cancel trade
  async cancelTrade(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.cancelTrade(req, res);
  }

  // Admin: Update offer
  async adminUpdateOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminUpdateOffer(req, res);
  }

  // Admin: Delete offer
  async adminDeleteOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminDeleteOffer(req, res);
  }

  // Admin: Pause/Resume offer
  async adminPauseOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminPauseOffer(req, res);
  }

  // Admin: Set offer closed
  async adminSetOfferClosed(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminSetOfferClosed(req, res);
  }

  // Admin: List escrows for an offer
  async adminListEscrows(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminListEscrows(req, res);
  }

  // Admin: Get all offers
  async adminGetAllOffers(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminGetAllOffers(req, res);
  }

  // Admin: Get all offer IDs for a specific admin
  async adminGetOfferIds(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminGetOfferIds(req, res);
  }

  // Admin: Get all trades with escrow IDs
  async adminGetAllTrades(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminGetAllTrades(req, res);
  }

  // Admin: Approve escrow
  async adminApproveEscrow(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminApproveEscrow(req, res);
  }

  // Get specific trade details
  async getTradeDetails(req: Request, res: Response) {
    try {
      const { tradeId } = req.params;
      
      // Handle undefined tradeId
      if (!tradeId || tradeId === 'undefined') {
        return res.status(400).json({ 
          status: 400,
          message: "Trade ID is required",
          error: "Invalid trade ID: undefined"
        });
      }
      
      const p2pOps = new P2POperations(req, res);
      
      const trade = await p2pOps.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ 
          status: 404,
          message: "Trade not found",
          tradeId: tradeId
        });
      }

      return res.status(200).json({
        status: 200,
        data: trade,
        tradeId: trade.tradeId || tradeId,
        trade_id: trade.tradeId || tradeId,
        message: "Trade details retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting trade details:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get trade details",
        error: error.message
      });
    }
  }

  // Send payment to escrow (for BUY offers)
  async sendPaymentToEscrow(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.sendPaymentToEscrow(req, res);
  }

  // Confirm payment received (for BUY offers)
  async confirmPaymentReceived(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.confirmPaymentReceived(req, res);
  }

  // Send crypto to escrow (for SELL offers)
  async sendCryptoToEscrow(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.sendCryptoToEscrow(req, res);
  }

  // Confirm crypto received (for SELL offers)
  async confirmCryptoReceived(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.confirmCryptoReceived(req, res);
  }

  // Release escrow (both scenarios)
  async releaseEscrow(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.releaseEscrow(req, res);
  }

  // Get user's trades
  async getUserTrades(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getUserTrades(req, res);
  }

  // Create dispute
  async createDispute(req: Request, res: Response) {
    try {
      const email = req.body.email || req.user?.email;
      const { tradeId, reason, description, evidence } = req.body;

      const p2pOps = new P2POperations(req, res);
      
      // Check if user is part of the trade (if email provided)
      if (email) {
        const trade = await p2pOps.p2pTradeService.findOne({ 
          tradeId,
          $or: [{ buyerEmail: email }, { sellerEmail: email }]
        });

        if (!trade) {
          return res.status(404).json({ message: "Trade not found or access denied" });
        }

        if (trade.status === "Completed") {
          return res.status(400).json({ message: "Cannot dispute completed trade" });
        }
      }

      // Generate dispute ID
      const disputeId = `DISPUTE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const disputeData = {
        disputeId,
        tradeId,
        complainantEmail: email,
        reason,
        description,
        evidence: evidence || [],
        status: "Open",
        createdAt: new Date()
      };

      const newDispute = await p2pOps.p2pDisputeService.create(disputeData as any);

      // Update trade status
      await p2pOps.p2pTradeService.updateTradeStatus(tradeId, "Disputed" as any);

      return res.status(201).json({
        status: 201,
        data: newDispute,
        message: "Dispute created successfully"
      });

    } catch (error: any) {
      console.error("Error creating dispute:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to create dispute",
        error: error.message
      });
    }
  }

  // Get disputes (admin only)
  async getDisputes(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const p2pOps = new P2POperations(req, res);
      
      const disputes = await p2pOps.p2pDisputeService.getDisputesByStatus(status as string);

      return res.status(200).json({
        status: 200,
        data: disputes,
        message: "Disputes retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting disputes:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get disputes",
        error: error.message
      });
    }
  }

  // Submit rating
  async submitRating(req: Request, res: Response) {
    try {
      const email = req.body.email || req.user?.email;
      const { tradeId, rating, comment } = req.body;

      const p2pOps = new P2POperations(req, res);
      
      // Check if user can rate this trade (if email provided)
      let trade = null;
      if (email) {
        const canRate = await p2pOps.p2pRatingService.canRate(tradeId, email);
        if (!canRate) {
          return res.status(400).json({ message: "You have already rated this trade" });
        }

        // Get trade details
        trade = await p2pOps.p2pTradeService.findOne({ tradeId });
        if (!trade) {
          return res.status(404).json({ message: "Trade not found" });
        }

        if (trade.status !== "Completed") {
          return res.status(400).json({ message: "Can only rate completed trades" });
        }
      } else {
        // Get trade details even without email for anonymous rating
        trade = await p2pOps.p2pTradeService.findOne({ tradeId });
        if (!trade) {
          return res.status(404).json({ message: "Trade not found" });
        }
      }

      // Determine who is being rated
      const rateeEmail = trade.buyerEmail === email ? trade.sellerEmail : trade.buyerEmail;

      // Generate rating ID
      const ratingId = `RATING_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const ratingData = {
        ratingId,
        tradeId,
        raterEmail: email,
        rateeEmail,
        rating,
        comment,
        createdAt: new Date()
      };

      const newRating = await p2pOps.p2pRatingService.create(ratingData as any);

      return res.status(201).json({
        status: 201,
        data: newRating,
        message: "Rating submitted successfully"
      });

    } catch (error: any) {
      console.error("Error submitting rating:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to submit rating",
        error: error.message
      });
    }
  }

  // Get user ratings
  async getUserRatings(req: Request, res: Response) {
    try {
      const { email } = req.params;
      const p2pOps = new P2POperations(req, res);
      
      const ratings = await p2pOps.p2pRatingService.getUserRatings(email);
      const averageRating = await p2pOps.p2pRatingService.getAverageRating(email);

      return res.status(200).json({
        status: 200,
        data: {
          ratings,
          averageRating,
          totalRatings: ratings.length
        },
        message: "User ratings retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting user ratings:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get user ratings",
        error: error.message
      });
    }
  }

  // Join offer with ASSET_WALLET settlement
  async joinOfferWithAsset(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.joinOfferWithAsset(req, res);
  }

  // Join offer with GATEWAY settlement
  async joinOfferWithGateway(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.joinOfferWithGateway(req, res);
  }

  // ==================== ADMIN APIs ====================

  async adminSignup(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminSignup(req, res);
  }

  async adminLogin(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.adminLogin(req, res);
  }

  async createAdminAssetWallet(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.createAdminAssetWallet(req, res);
  }

  async fundAdminAssetWallet(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.fundAdminAssetWallet(req, res);
  }

  async getAdminBalance(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getAdminBalance(req, res);
  }

  // Get user's completed trades
  async getUserCompletedTrades(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getUserCompletedTrades(req, res);
  }

  // Get user's pending trades
  async getUserPendingTrades(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getUserPendingTrades(req, res);
  }

  // Create offer with asset wallet only (for regular users)
  async createOfferWithAssetWallet(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.createOfferWithAssetWallet(req, res);
  }

  // User: Update own offer
  async userUpdateOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.userUpdateOffer(req, res);
  }

  // User: Delete own offer
  async userDeleteOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.userDeleteOffer(req, res);
  }

  // User: Pause/Resume own offer
  async userPauseOffer(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.userPauseOffer(req, res);
  }

  // User: List escrows for own offer (see who joined their offers)
  async userListEscrows(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.userListEscrows(req, res);
  }

  // User: Get all offers created by the authenticated user
  async getUserOffers(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.getUserOffers(req, res);
  }

  // User: Join another user's offer with asset wallet (instant P2P transfer)
  async userJoinOfferWithAsset(req: Request, res: Response) {
    const p2pOps = new P2POperations(req, res);
    return await p2pOps.userJoinOfferWithAsset(req, res);
  }
}
