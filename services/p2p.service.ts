import { ServiceBase } from "./base";
import { P2POffer, P2PTrade, P2PDispute, P2PRating, P2POfferModel, P2PTradeModel, P2PDisputeModel, P2PRatingModel, P2PEscrowModel, p2pOfferSchema, p2pTradeSchema, p2pDisputeSchema, p2pRatingSchema, p2pEscrowSchema } from "../models/p2p";
import { P2POfferStatus, P2PTradeStatus, EscrowStatus, P2PEscrow } from "../data/p2p";

export class P2POfferService extends ServiceBase<P2POffer, P2POfferModel> {
  constructor() {
    super(p2pOfferSchema, "P2POffer");
  }

  // Get active offers with filters
  async getActiveOffers(filters: {
    cryptoCurrency?: string;
    fiatCurrency?: string;
    offerType?: "Buy" | "Sell";
    paymentMethod?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    skip?: number;
  }) {
    const query: any = { status: P2POfferStatus.Active };

    if (filters.cryptoCurrency) query.cryptoCurrency = filters.cryptoCurrency;
    if (filters.fiatCurrency) query.fiatCurrency = filters.fiatCurrency;
    if (filters.offerType) query.offerType = filters.offerType;
    if (filters.paymentMethod) query.paymentMethods = { $in: [filters.paymentMethod] };
    if (filters.minPrice) query.pricePerUnit = { $gte: filters.minPrice };
    if (filters.maxPrice) query.pricePerUnit = { ...query.pricePerUnit, $lte: filters.maxPrice };

    return this.findPaginatedSkip(
      filters.limit || 50,
      filters.skip || 0,
      { createdAt: -1 },
      query,
      null
    );
  }

  // Update offer availability
  async updateAvailability(offerId: string, newAmount: number) {
    return this.updatePart(
      { offerId },
      {
        $set: {
          availableAmount: newAmount,
          updatedAt: new Date()
        }
      }
    );
  }

  // Pause/Resume offer
  async toggleOfferStatus(offerId: string, status: P2POfferStatus) {
    return this.updatePart(
      { offerId },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      }
    );
  }

  // Update user's online status
  async updateOnlineStatus(email: string, isOnline: boolean) {
    return this.updateMany(
      { creatorEmail: email },
      {
        $set: {
          isOnline,
          lastSeen: new Date()
        }
      }
    );
  }
}

export class P2PTradeService extends ServiceBase<P2PTrade, P2PTradeModel> {
  constructor() {
    super(p2pTradeSchema, "P2PTrade");
  }

  // Get trades for a user
  async getUserTrades(email: string, status?: P2PTradeStatus, limit: number = 50) {
    const query: any = {
      $or: [
        { buyerEmail: email },
        { sellerEmail: email }
      ]
    };

    if (status) {
      query.status = status;
    } else {
      // By default, hide cancelled trades from generic user trade listings
      query.status = { $ne: P2PTradeStatus.Cancelled };
    }

    return this.findPaginated(
      limit,
      { createdAt: -1 },
      query,
      null
    );
  }

  // Update trade status
  async updateTradeStatus(tradeId: string, status: P2PTradeStatus, additionalData?: any) {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === P2PTradeStatus.Paid) {
      updateData.paidAt = new Date();
    } else if (status === P2PTradeStatus.Confirmed) {
      updateData.confirmedAt = new Date();
    } else if (status === P2PTradeStatus.Completed) {
      updateData.completedAt = new Date();
    }

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    return this.updatePart({ tradeId }, { $set: updateData });
  }

  // Release escrow
  async releaseEscrow(tradeId: string) {
    return this.updatePart(
      { tradeId },
      {
        $set: {
          escrowReleased: true,
          status: P2PTradeStatus.Completed,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  // Get expired trades (only if expiresAt is not undefined)
  async getExpiredTrades() {
    return this.find({
      status: { $in: [P2PTradeStatus.Pending, P2PTradeStatus.Paid] },
      expiresAt: { $exists: true, $ne: null, $lt: new Date() }
    });
  }

  // Manually expire a specific trade
  async manuallyExpireTrade(tradeId: string) {
    return this.updatePart(
      { tradeId },
      {
        $set: {
          status: P2PTradeStatus.Expired,
          updatedAt: new Date()
        }
      }
    );
  }
}

export class P2PDisputeService extends ServiceBase<P2PDispute, P2PDisputeModel> {
  constructor() {
    super(p2pDisputeSchema, "P2PDispute");
  }

  // Get disputes by status
  async getDisputesByStatus(status: string) {
    return this.findPaginated(
      100,
      { createdAt: -1 },
      { status },
      null
    );
  }

  // Resolve dispute
  async resolveDispute(disputeId: string, resolution: string, resolvedBy: string) {
    return this.updatePart(
      { disputeId },
      {
        $set: {
          status: "Resolved",
          resolution,
          resolvedBy,
          resolvedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }
}

export class P2PRatingService extends ServiceBase<P2PRating, P2PRatingModel> {
  constructor() {
    super(p2pRatingSchema, "P2PRating");
  }

  // Get user ratings
  async getUserRatings(email: string) {
    return this.findPaginated(
      100,
      { createdAt: -1 },
      { rateeEmail: email },
      null
    );
  }

  // Calculate average rating
  async getAverageRating(email: string): Promise<number> {
    const ratings = await this.find({ rateeEmail: email });
    if (ratings.length === 0) return 0;

    const totalRating = ratings.reduce((sum: number, rating: P2PRating) => sum + rating.rating, 0);
    return totalRating / ratings.length;
  }

  // Check if user can rate
  async canRate(tradeId: string, raterEmail: string): Promise<boolean> {
    const existingRating = await this.findOne({ tradeId, raterEmail });
    return !existingRating;
  }
}

export class P2PEscrowService extends ServiceBase<P2PEscrow, P2PEscrowModel> {
  constructor() {
    super(p2pEscrowSchema, "P2PEscrow");
  }

  // Get all escrows for an offer
  async getEscrowsByOffer(offerId: string) {
    // Use find to get all escrows (no pagination limit)
    const escrows = await this.find({ offerId });
    // Sort by creation date (newest first)
    return escrows.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Descending order
    });
  }

  // Get escrows by status
  async getEscrowsByStatus(offerId: string, status: EscrowStatus) {
    return this.findPaginated(
      100,
      { createdAt: -1 },
      { offerId, status },
      null
    );
  }

  // Update escrow status
  async updateEscrowStatus(escrowId: string, status: EscrowStatus, approvedBy?: string) {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === EscrowStatus.APPROVED) {
      updateData.approvedAt = new Date();
      if (approvedBy) {
        updateData.approvedBy = approvedBy;
      }
    }

    return this.updatePart({ escrowId }, { $set: updateData });
  }
}
