import { Request, Response } from "express";
import { BaseAPIOperations } from "./base.operations";
import { P2POfferService, P2PTradeService, P2PDisputeService, P2PRatingService, P2PEscrowService } from "../services/p2p.service";
import { UserService } from "../services/user.service";
import { OrderService } from "../services/order.service";
import { TransactionService } from "../services/transaction.service";
import { P2POffer, P2PTrade, P2PDispute, P2PRating, P2POfferStatus, P2PTradeStatus, P2PPaymentMethod, P2PSettlementType } from "../models/p2p";
import { EscrowStatus } from "../data/p2p";
import { UserWallet, User, UserRoleTypes } from "../data/user";
import { Languages, AuthProviders, Currency } from "../data/common";
import { SendEmail } from "./email.operations";
import { EscrowService } from "../services/escrow.service";
import { NotificationService } from "../services/notification.service";
import { JwtAuthUtil } from "./jwt.operations";
import { ensureMongoConnected } from "../db/connection";
import { CurrencyService } from "../services/currency.service";

export class P2POperations extends BaseAPIOperations {
  public p2pOfferService: P2POfferService;
  public p2pTradeService: P2PTradeService;
  public p2pDisputeService: P2PDisputeService;
  public p2pRatingService: P2PRatingService;
  public p2pEscrowService: P2PEscrowService;

  /**
   * Helper: Find offer by MongoDB _id or offerId field
   * Supports both MongoDB ObjectId and custom offerId string
   */
  private async findOfferByIdentifier(identifier: string): Promise<any> {
    // Try to find by MongoDB _id first (if it's a valid ObjectId)
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
        const offer = await this.p2pOfferService.findById(identifier);
        if (offer) return offer;
      }
    } catch (error) {
      // If ObjectId lookup fails, try offerId field
    }

    // Try to find by offerId field
    const offer = await this.p2pOfferService.findOne({ offerId: identifier });
    return offer;
  }

  /**
   * Helper: Get query for update/delete operations by identifier
   */
  private getOfferQuery(identifier: string): any {
    // If it's a valid MongoDB ObjectId, use _id
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
        return { _id: identifier };
      }
    } catch (error) {
      // Fall through to use offerId
    }

    // Otherwise use offerId field
    return { offerId: identifier };
  }
  private userService: UserService;
  private orderService: OrderService;
  private transactionService: TransactionService;
  private escrowService: EscrowService;
  private notificationService: NotificationService;

  constructor(req: Request, res: Response) {
    super(req, res);
    this.p2pOfferService = new P2POfferService();
    this.p2pTradeService = new P2PTradeService();
    this.p2pDisputeService = new P2PDisputeService();
    this.p2pRatingService = new P2PRatingService();
    this.p2pEscrowService = new P2PEscrowService();
    this.userService = new UserService();
    this.orderService = new OrderService();
    this.transactionService = new TransactionService();
    this.escrowService = new EscrowService();
    this.notificationService = new NotificationService();
  }

  // Create a new P2P offer
  async createOffer(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;

      const {
        // New field names
        type, baseToken, quoteToken, price, priceType, settlement, acceptedPaymentMethods, paymentInstructions, status,
        // Legacy field names
        offerType, cryptoCurrency, cryptoNetwork, fiatCurrency, pricePerUnit,
        // Common fields
        minAmount, maxAmount, availableAmount, paymentMethods, terms, autoReply
      } = req.body;

      // Map new field names to legacy names for backward compatibility
      const finalOfferType = type || offerType;
      const finalCryptoCurrency = baseToken || cryptoCurrency;
      const finalFiatCurrency = quoteToken || fiatCurrency;
      const finalPrice = price || pricePerUnit;
      const finalPriceType = priceType || "FIXED";
      
      // Normalize settlement type: map user-friendly strings to enum values
      const normalizeSettlement = (settlementValue?: string): P2PSettlementType => {
        if (!settlementValue) {
          return (finalOfferType === "BUY" ? P2PSettlementType.INTERNAL_USD : P2PSettlementType.REAL_FIAT);
        }
        const normalized = String(settlementValue).trim().toUpperCase();
        // Map user-friendly names to enum values
        if (normalized === "ASSET WALLET" || normalized === "ASSET_WALLET" || normalized === "INTERNAL_USD" || normalized === "INTERNAL") {
          return P2PSettlementType.INTERNAL_USD;
        }
        if (normalized === "BANK TRANSFER" || normalized === "BANK_TRANSFER" || normalized === "REAL_FIAT" || normalized === "FIAT" || normalized === "GATEWAY") {
          return P2PSettlementType.REAL_FIAT;
        }
        // If it's already a valid enum value, return it
        if (settlementValue === P2PSettlementType.INTERNAL_USD || settlementValue === P2PSettlementType.REAL_FIAT) {
          return settlementValue as P2PSettlementType;
        }
        // Default based on offer type if unrecognized
        return (finalOfferType === "BUY" ? P2PSettlementType.INTERNAL_USD : P2PSettlementType.REAL_FIAT);
      };
      
      const finalSettlement = normalizeSettlement(settlement);

      // Validate required fields
      if (!finalOfferType || !finalCryptoCurrency || !finalFiatCurrency || !finalPrice || !minAmount || !maxAmount || !availableAmount) {
        return res.status(400).json({ 
          message: "Missing required fields",
          required: {
            type: "BUY or SELL (or offerType)",
            baseToken: "e.g., USD (or cryptoCurrency)",
            quoteToken: "e.g., INEX (or fiatCurrency)",
            price: "0.25 (or pricePerUnit)",
            minAmount: "minimum trade amount",
            maxAmount: "maximum trade amount",
            availableAmount: "total available amount"
          }
        });
      }

      // Check if user has sufficient balance for sell offers (if email provided)
      if (finalOfferType === "SELL" && email) {
        const user = await this.userService.findOne({ email });
        const wallet = user?.userWallets?.find((w: UserWallet) => 
          w.coinSymbol === finalCryptoCurrency && 
          (cryptoNetwork ? w.coinNetwork === cryptoNetwork : true)
        );

        if (!wallet || wallet.coinBalance < (availableAmount / finalPrice)) {
          return res.status(400).json({ message: "Insufficient crypto balance" });
        }
      }

      // Generate unique offer ID
      const offerId = `P2P_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use authenticated user's email, or try to get from token, or use system admin
      const creatorEmail = email || this.userId || "support@azooca.com";

      // Normalize requested status (active|paused|closed) → enum
      // For admin, default to Active status
      const statusMap = (value?: string) => {
        if (!value) return P2POfferStatus.Active;
        const v = String(value).toLowerCase();
        if (v === 'active') return P2POfferStatus.Active;
        if (v === 'paused') return P2POfferStatus.Paused;
        if (v === 'closed') return P2POfferStatus.Cancelled; // map "closed" → Cancelled
        return P2POfferStatus.Active;
      };

      // Check if user is admin - if admin, always set status to Active
      let isAdminUser = false;
      if (email) {
        const user = await this.userService.findOne({ email: email.toLowerCase() });
        isAdminUser = user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;
      }
      const claims = this.getclaims();
      const isAdminFromToken = claims?.role === UserRoleTypes.Admin || claims?.role === UserRoleTypes.SuperAdmin || claims?.role === 'Admin';
      const finalIsAdmin = isAdminUser || isAdminFromToken;

      const offerData: any = {
        offerId,
        creatorEmail, // Use actual authenticated user email
        
        // Legacy fields
        offerType: finalOfferType === "BUY" ? "Buy" : "Sell",
        cryptoCurrency: finalCryptoCurrency,
        cryptoNetwork,
        fiatCurrency: finalFiatCurrency,
        pricePerUnit: finalPrice,
        
        // New fields
        baseToken: finalCryptoCurrency,
        quoteToken: finalFiatCurrency,
        returnToken: finalFiatCurrency,
        assetSymbol: finalCryptoCurrency,
        side: finalOfferType as any,
        settlement: finalSettlement as any,
        priceType: finalPriceType as any,
        price: finalPrice,
        // For INTERNAL_USD (Asset Wallet), clear payment methods as they're not needed
        // Only REAL_FIAT (Gateway) offers should have acceptedPaymentMethods
        acceptedPaymentMethods: finalSettlement === P2PSettlementType.INTERNAL_USD 
          ? [] 
          : (acceptedPaymentMethods || paymentMethods || []),
        paymentInstructions: paymentInstructions || {},
        
        minAmount,
        maxAmount,
        availableAmount,
        // Map payment methods to both fields (clear for Asset Wallet)
        paymentMethods: finalSettlement === P2PSettlementType.INTERNAL_USD 
          ? [] 
          : (paymentMethods && paymentMethods.length > 0 ? paymentMethods : (acceptedPaymentMethods || [])),
        terms: terms || "",
        // If admin creates offer, status should be Active
        status: finalIsAdmin ? P2POfferStatus.Active : statusMap(status),
        autoReply,
        completionRate: 0,
        totalTrades: 0,
        avgReleaseTime: 0,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newOffer = await this.p2pOfferService.create(offerData as P2POffer);

      // Send email notification to offer creator
      if (email) {
        await this.sendP2PEmail(email, 'offer_created', null, newOffer);
      }

      return res.status(201).json({
        status: 201,
        data: newOffer,
        message: "P2P offer created successfully"
      });

    } catch (error: any) {
      console.error("Error creating P2P offer:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to create P2P offer",
        error: error.message
      });
    }
  }

  // Create a new P2P offer using asset wallet only (for regular users)
  async createOfferWithAssetWallet(req: any, res: any) {
    try {
      // Extract email from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || req.body.email;
      
      if (!email) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      const {
        // New field names
        type, baseToken, quoteToken, price, priceType, acceptedPaymentMethods, paymentInstructions, status,
        // Legacy field names
        offerType, cryptoCurrency, cryptoNetwork, fiatCurrency, pricePerUnit,
        // Common fields
        minAmount, maxAmount, availableAmount, paymentMethods, terms, autoReply
      } = req.body;

      // Map new field names to legacy names for backward compatibility
      const finalOfferType = (type || offerType)?.toString().toUpperCase();
      
      // For user offers: 
      // - baseToken/cryptoCurrency = currency user will RECEIVE
      // - quoteToken/fiatCurrency = currency user will SEND
      const receiveCurrency = baseToken || cryptoCurrency;  // What user will GET
      const sendCurrency = quoteToken || fiatCurrency;     // What user will SEND
      
      const finalPrice = price || pricePerUnit;
      const finalPriceType = priceType || "FIXED";
      
      // Force settlement to INTERNAL_USD (Asset Wallet) only
      const finalSettlement = P2PSettlementType.INTERNAL_USD;

      // Validate required fields
      if (!finalOfferType || !receiveCurrency || !sendCurrency || !finalPrice || !minAmount || !maxAmount || !availableAmount) {
        return res.status(400).json({ 
          status: 400,
          message: "Missing required fields",
          required: {
            type: "BUY or SELL (or offerType)",
            baseToken: "Currency user will RECEIVE (e.g., INEX for BUY, USD for SELL)",
            quoteToken: "Currency user will SEND (e.g., USD for BUY, INEX for SELL)",
            price: "0.25 (or pricePerUnit)",
            minAmount: "minimum trade amount",
            maxAmount: "maximum trade amount",
            availableAmount: "total available amount"
          }
        });
      }

      // Validate offer type
      if (finalOfferType !== "BUY" && finalOfferType !== "SELL") {
        return res.status(400).json({ 
          status: 400,
          message: "Invalid offer type. Must be 'BUY' or 'SELL'",
          received: finalOfferType
        });
      }

      // User always sends quoteToken (sendCurrency) and receives baseToken (receiveCurrency)
      // For BUY: user receives baseToken (e.g., INEX), sends quoteToken (e.g., USD)
      // For SELL: user receives baseToken (e.g., USD), sends quoteToken (e.g., INEX)
      const currencyUserSends = sendCurrency;  // Always the second currency (quoteToken)
      const currencyUserReceives = receiveCurrency;  // Always the first currency (baseToken)

      // Balance check logic:
      // - quoteToken balance is NOT checked because quoteToken will be sent by users who join the offer
      // - baseToken balance is checked only for SELL offers (user needs to send baseToken to joining users)
      // - For BUY offers: user is buying baseToken, so they don't need to have it (no balance check)
      // - For SELL offers: user is selling baseToken, so they need to have it (check baseToken balance)
      
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      
      if (finalOfferType === "SELL") {
        // For SELL: user will send baseToken to joining users, so check baseToken balance
        const baseTokenWallet = user?.userWallets?.find((w: UserWallet) => 
          w.coinSymbol === currencyUserReceives && // baseToken (what user will send)
          (cryptoNetwork ? w.coinNetwork === cryptoNetwork : true)
        );

        // User needs baseToken amount = availableAmount / price (convert quoteToken amount to baseToken)
        const requiredBaseTokenBalance = availableAmount / finalPrice;

        if (!baseTokenWallet || baseTokenWallet.coinBalance < requiredBaseTokenBalance) {
          return res.status(400).json({ 
            status: 400,
            message: `Insufficient ${currencyUserReceives} (baseToken) balance. Required: ${requiredBaseTokenBalance}, Available: ${baseTokenWallet?.coinBalance || 0}` 
          });
        }
      }
      // For BUY offers: No balance check needed - user is advertising to buy baseToken
      // quoteToken will be sent by users who join, so no need to check quoteToken balance

      // Generate unique offer ID
      const offerId = `P2P_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use authenticated user's email
      const creatorEmail = email.toLowerCase();

      // Normalize requested status (active|paused|closed) → enum
      const statusMap = (value?: string) => {
        if (!value) return P2POfferStatus.Active;
        const v = String(value).toLowerCase();
        if (v === 'active') return P2POfferStatus.Active;
        if (v === 'paused') return P2POfferStatus.Paused;
        if (v === 'closed') return P2POfferStatus.Cancelled;
        return P2POfferStatus.Active;
      };

      // Map currencies based on offer type:
      // User always receives baseToken (receiveCurrency) and sends quoteToken (sendCurrency)
      // For BUY: user receives INEX (baseToken), sends USD (quoteToken)
      // For SELL: user receives USD (baseToken), sends INEX (quoteToken)
      // In legacy terms:
      // - cryptoCurrency = the asset being traded (INEX in both cases)
      // - fiatCurrency = the payment currency (USD in both cases)
      const legacyCryptoCurrency = finalOfferType === "BUY" ? receiveCurrency : sendCurrency;
      const legacyFiatCurrency = finalOfferType === "BUY" ? sendCurrency : receiveCurrency;

      const offerData: any = {
        offerId,
        creatorEmail,
        
        // Legacy fields
        offerType: finalOfferType === "BUY" ? "Buy" : "Sell",
        cryptoCurrency: legacyCryptoCurrency,  // The asset being traded
        cryptoNetwork,
        fiatCurrency: legacyFiatCurrency,      // The payment currency
        pricePerUnit: finalPrice,
        
        // New fields - from user's perspective:
        // baseToken = what user will RECEIVE
        // quoteToken = what user will SEND
        baseToken: receiveCurrency,            // Currency user will receive
        quoteToken: sendCurrency,               // Currency user will send
        returnToken: sendCurrency,             // What user gives in return
        assetSymbol: legacyCryptoCurrency,     // The asset being traded
        side: finalOfferType as any,
        settlement: finalSettlement as any,
        priceType: finalPriceType as any,
        price: finalPrice,
        // Asset wallet offers don't need payment methods
        acceptedPaymentMethods: [],
        paymentInstructions: {},
        
        minAmount,
        maxAmount,
        availableAmount,
        paymentMethods: [],
        terms: terms || "",
        status: statusMap(status),
        autoReply,
        completionRate: 0,
        totalTrades: 0,
        avgReleaseTime: 0,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newOffer = await this.p2pOfferService.create(offerData as P2POffer);

      // Send email notification to offer creator
      await this.sendP2PEmail(creatorEmail, 'offer_created', null, newOffer);

      return res.status(201).json({
        status: 201,
        data: newOffer,
        message: "P2P offer created successfully with asset wallet settlement"
      });

    } catch (error: any) {
      console.error("Error creating P2P offer with asset wallet:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to create P2P offer",
        error: error.message
      });
    }
  }

  // Get P2P offers with filters
  async getOffers(req: any, res: any) {
    try {
      const {
        cryptoCurrency,
        fiatCurrency,
        offerType,
        paymentMethod,
        minPrice,
        maxPrice,
        limit,
        skip
      } = req.query;

      const filters = {
        cryptoCurrency,
        fiatCurrency,
        offerType,
        paymentMethod,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        limit: limit ? parseInt(limit) : 50,
        skip: skip ? parseInt(skip) : 0
      };

      const offers = await this.p2pOfferService.getActiveOffers(filters);

      return res.status(200).json({
        status: 200,
        data: offers,
        message: "P2P offers retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting P2P offers:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get P2P offers",
        error: error.message
      });
    }
  }

  // Admin: Update offer
  async adminUpdateOffer(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Verify admin authorization
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin' || user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required.",
          userRole: role || user?.role
        });
      }

      const allowed: any = {};
      const body = req.body || {};
      
      // Expanded allow list for admin to update all offer details
      const allowList = [
        // Price fields
        'price', 'pricePerUnit', 'priceType',
        // Amount fields
        'minAmount', 'maxAmount', 'availableAmount',
        // Payment fields
        'acceptedPaymentMethods', 'paymentMethods', 'paymentInstructions',
        // Token fields
        'baseToken', 'quoteToken', 'cryptoCurrency', 'fiatCurrency', 'assetSymbol', 'returnToken',
        // Offer type fields
        'offerType', 'type', 'side', 'settlement',
        // Other fields
        'terms', 'autoReply', 'status', 'cryptoNetwork'
      ];
      
      // Helper function to normalize settlement (same as createOffer)
      const normalizeSettlement = (settlementValue?: string): P2PSettlementType | undefined => {
        if (!settlementValue) return undefined;
        const normalized = String(settlementValue).trim().toUpperCase();
        if (normalized === "ASSET WALLET" || normalized === "ASSET_WALLET" || normalized === "INTERNAL_USD" || normalized === "INTERNAL") {
          return P2PSettlementType.INTERNAL_USD;
        }
        if (normalized === "BANK TRANSFER" || normalized === "BANK_TRANSFER" || normalized === "REAL_FIAT" || normalized === "FIAT" || normalized === "GATEWAY") {
          return P2PSettlementType.REAL_FIAT;
        }
        if (settlementValue === P2PSettlementType.INTERNAL_USD || settlementValue === P2PSettlementType.REAL_FIAT) {
          return settlementValue as P2PSettlementType;
        }
        return undefined;
      };

      // Track if settlement is being updated
      let settlementUpdated = false;
      let normalizedSettlement: P2PSettlementType | undefined = undefined;

      for (const key of allowList) {
        if (body[key] !== undefined) {
          // Handle status normalization
          if (key === 'status' && typeof body[key] === 'string') {
            const statusValue = String(body[key]).toLowerCase();
            if (statusValue === 'active') allowed[key] = P2POfferStatus.Active;
            else if (statusValue === 'paused') allowed[key] = P2POfferStatus.Paused;
            else if (statusValue === 'cancelled' || statusValue === 'closed') allowed[key] = P2POfferStatus.Cancelled;
            else allowed[key] = body[key];
          }
          // Handle settlement normalization
          else if (key === 'settlement' && typeof body[key] === 'string') {
            normalizedSettlement = normalizeSettlement(body[key]);
            if (normalizedSettlement) {
              allowed[key] = normalizedSettlement;
              settlementUpdated = true;
            } else {
              allowed[key] = body[key];
            }
          } else {
            allowed[key] = body[key];
          }
        }
      }

      // If settlement is being updated to INTERNAL_USD, clear payment methods
      const finalSettlement = normalizedSettlement || offer.settlement;
      if (settlementUpdated && finalSettlement === P2PSettlementType.INTERNAL_USD) {
        allowed.acceptedPaymentMethods = [];
        allowed.paymentMethods = [];
      } else if (finalSettlement === P2PSettlementType.INTERNAL_USD && 
                 (body.acceptedPaymentMethods !== undefined || body.paymentMethods !== undefined)) {
        // If settlement is already INTERNAL_USD and payment methods are being updated, clear them
        allowed.acceptedPaymentMethods = [];
        allowed.paymentMethods = [];
      }

      if (Object.keys(allowed).length === 0) {
        return res.status(400).json({ message: "No updatable fields provided" });
      }

      // Use the correct query based on identifier type
      const updateQuery = this.getOfferQuery(offerId);
      await this.p2pOfferService.updatePart(
        updateQuery,
        { $set: { ...allowed, updatedAt: new Date() } }
      );

      const updated = await this.findOfferByIdentifier(offerId);
      return res.status(200).json({ status: 200, data: updated, message: 'Offer updated successfully' });
    } catch (error: any) {
      console.error('Error updating offer:', error);
      return res.status(500).json({ status: 500, message: 'Failed to update offer', error: error.message });
    }
  }

  // Admin: Delete offer (hard delete from database)
  async adminDeleteOffer(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Verify admin authorization
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin' || user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required.",
          userRole: role || user?.role
        });
      }

      // Check if there are active trades for this offer (use actual offerId from found offer)
      const actualOfferId = offer.offerId || offerId;
      const activeTrades = await this.p2pTradeService.find({ 
        offerId: actualOfferId, 
        status: { $in: ["Pending", "Paid"] } 
      });

      if (activeTrades.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete offer with active trades. Please cancel active trades first.",
          activeTradesCount: activeTrades.length
        });
      }

      // Hard delete from database using correct query
      const deleteQuery = this.getOfferQuery(offerId);
      await this.p2pOfferService.deleteOne(deleteQuery);

      return res.status(200).json({ 
        status: 200, 
        message: 'Offer deleted successfully from database',
        offerId: offerId
      });
    } catch (error: any) {
      console.error('Error deleting offer:', error);
      return res.status(500).json({ status: 500, message: 'Failed to delete offer', error: error.message });
    }
  }

  // Admin: Pause/Resume offer
  async adminPauseOffer(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;
      const { action } = req.body; // 'pause' | 'resume' (optional, defaults to 'pause')

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Verify admin authorization
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin' || user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required.",
          userRole: role || user?.role
        });
      }

      // Determine action: if not provided or empty, default to 'pause'
      // If current status is Paused, default to 'resume', otherwise 'pause'
      const finalAction = action || (offer.status === P2POfferStatus.Paused ? 'resume' : 'pause');
      
      // Validate action parameter
      if (finalAction !== 'pause' && finalAction !== 'resume') {
        return res.status(400).json({ 
          message: "Invalid action. Must be 'pause' or 'resume'",
          provided: action || 'default'
        });
      }

      const newStatus = finalAction === 'resume' ? P2POfferStatus.Active : P2POfferStatus.Paused;
      
      // Use the correct query based on identifier type
      const updateQuery = this.getOfferQuery(offerId);
      await this.p2pOfferService.updatePart(
        updateQuery,
        { $set: { status: newStatus, updatedAt: new Date() } }
      );

      const updated = await this.findOfferByIdentifier(offerId);
      return res.status(200).json({ 
        status: 200, 
        data: updated, 
        message: `Offer ${finalAction === 'resume' ? 'resumed' : 'paused'} successfully` 
      });
    } catch (error: any) {
      console.error('Error pausing/resuming offer:', error);
      return res.status(500).json({ status: 500, message: 'Failed to modify offer status', error: error.message });
    }
  }

  // Admin: Set offer Closed (maps to Cancelled)
  async adminSetOfferClosed(req: any, res: any) {
    try {
      const { offerId } = req.params;
      const email = req.user?.email;
      const role = req.user?.role;

      const offer = await this.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      if (offer.creatorEmail !== email && role !== 'Admin') {
        return res.status(403).json({ message: "Not authorized to modify this offer" });
      }

      await this.p2pOfferService.updatePart(
        { offerId },
        { $set: { status: P2POfferStatus.Cancelled, updatedAt: new Date() } }
      );

      const updated = await this.p2pOfferService.findOne({ offerId });
      return res.status(200).json({ status: 200, data: updated, message: 'Offer closed' });
    } catch (error: any) {
      console.error('Error setting offer closed:', error);
      return res.status(500).json({ status: 500, message: 'Failed to close offer', error: error.message });
    }
  }

  // Admin: List all escrows for an offer
  async adminListEscrows(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const offer = await this.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Check authorization: offer creator OR Admin/SuperAdmin
      const isOfferCreator = offer.creatorEmail?.toLowerCase() === email.toLowerCase();
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin';

      if (!isOfferCreator && !isAdmin) {
        return res.status(403).json({ 
          message: "Not authorized to view escrows for this offer",
          debug: {
            offerCreator: offer.creatorEmail,
            userEmail: email,
            userRole: role
          }
        });
      }

      // Try multiple methods to find escrows
      let escrows = await this.p2pEscrowService.getEscrowsByOffer(offerId);
      
      // If empty, try direct find method as fallback
      if (!escrows || escrows.length === 0) {
        escrows = await this.p2pEscrowService.find({ offerId: offerId });
      }

      // Also check if there are trades for this offer (which should have escrows)
      const trades = await this.p2pTradeService.find({ offerId: offerId });
      const tradeIds = trades?.map((trade: any) => trade.tradeId) || [];

      // Extract escrow IDs for easier access
      const escrowIds = escrows?.map((escrow: any) => escrow.escrowId || escrow._id) || [];

      return res.status(200).json({
        status: 200,
        data: escrows || [],
        escrowIds: escrowIds,
        message: "Escrows retrieved successfully",
        offerId: offerId,
        totalEscrows: escrows?.length || 0,
        relatedTrades: tradeIds.length > 0 ? {
          totalTrades: tradeIds.length,
          tradeIds: tradeIds,
          note: tradeIds.length > 0 && escrows?.length === 0 
            ? "Trades exist but no escrows found. This may indicate escrows weren't created when trades were made."
            : undefined
        } : undefined,
        debug: escrows?.length === 0 ? {
          query: { offerId: offerId },
          tradesFound: tradeIds.length,
          note: tradeIds.length === 0 
            ? "No escrows found. Escrows are created when users join an offer via /join-asset or /join-gateway endpoints."
            : "Trades exist but no escrows found. Check if escrows were created during trade creation."
        } : undefined
      });
    } catch (error: any) {
      console.error('Error listing escrows:', error);
      return res.status(500).json({ status: 500, message: 'Failed to list escrows', error: error.message });
    }
  }

  // User: Update own offer
  async userUpdateOffer(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email;
      
      if (!email) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ 
          status: 404,
          message: "Offer not found" 
        });
      }

      // Check if user owns the offer
      const isOfferCreator = offer.creatorEmail?.toLowerCase() === email.toLowerCase();
      if (!isOfferCreator) {
        return res.status(403).json({ 
          status: 403,
          message: "Access denied. You can only update your own offers.",
          debug: {
            offerCreator: offer.creatorEmail,
            userEmail: email
          }
        });
      }

      // Get update data from request body
      const updateData = req.body;
      
      // Remove fields that shouldn't be updated directly
      delete updateData.offerId;
      delete updateData.creatorEmail;
      delete updateData.createdAt;
      
      // Use the correct query based on identifier type
      const updateQuery = this.getOfferQuery(offerId);
      await this.p2pOfferService.updatePart(
        updateQuery,
        { 
          $set: { 
            ...updateData,
            updatedAt: new Date()
          }
        }
      );

      const updated = await this.findOfferByIdentifier(offerId);
      return res.status(200).json({ 
        status: 200, 
        data: updated, 
        message: "Offer updated successfully" 
      });
    } catch (error: any) {
      console.error('Error updating offer:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to update offer', 
        error: error.message 
      });
    }
  }

  // User: Delete own offer
  async userDeleteOffer(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email;
      
      if (!email) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ 
          status: 404,
          message: "Offer not found" 
        });
      }

      // Check if user owns the offer
      const isOfferCreator = offer.creatorEmail?.toLowerCase() === email.toLowerCase();
      if (!isOfferCreator) {
        return res.status(403).json({ 
          status: 403,
          message: "Access denied. You can only delete your own offers.",
          debug: {
            offerCreator: offer.creatorEmail,
            userEmail: email
          }
        });
      }

      // Check if there are active trades
      const activeTrades = await this.p2pTradeService.find({ 
        offerId: offer.offerId, 
        status: { $in: ["Pending", "Paid"] } 
      });

      if (activeTrades.length > 0) {
        return res.status(400).json({ 
          status: 400,
          message: "Cannot delete offer with active trades",
          activeTrades: activeTrades.length
        });
      }

      // Use the correct query based on identifier type
      const deleteQuery = this.getOfferQuery(offerId);
      await this.p2pOfferService.deleteOne(deleteQuery);

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

  // User: List escrows for own offer (see who joined their offers)
  async userListEscrows(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email;
      
      if (!email) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ 
          status: 404,
          message: "Offer not found" 
        });
      }

      // Check if user owns the offer
      const isOfferCreator = offer.creatorEmail?.toLowerCase() === email.toLowerCase();
      if (!isOfferCreator) {
        return res.status(403).json({ 
          status: 403,
          message: "Access denied. You can only view escrows for your own offers.",
          debug: {
            offerCreator: offer.creatorEmail,
            userEmail: email
          }
        });
      }

      // Try multiple methods to find escrows
      let escrows = await this.p2pEscrowService.getEscrowsByOffer(offer.offerId);
      
      // If empty, try direct find method as fallback
      if (!escrows || escrows.length === 0) {
        escrows = await this.p2pEscrowService.find({ offerId: offer.offerId });
      }

      // Also check if there are trades for this offer (which should have escrows)
      const trades = await this.p2pTradeService.find({ offerId: offer.offerId });
      const tradeIds = trades?.map((trade: any) => trade.tradeId) || [];

      // Extract escrow IDs and user information for easier access
      const escrowIds = escrows?.map((escrow: any) => escrow.escrowId || escrow._id) || [];
      
      // Extract user emails who joined the offer
      const joinedUsers = escrows?.map((escrow: any) => ({
        email: escrow.buyerEmail || escrow.sellerEmail || escrow.userEmail,
        escrowId: escrow.escrowId || escrow._id,
        status: escrow.status,
        amount: escrow.amount,
        createdAt: escrow.createdAt
      })) || [];

      return res.status(200).json({
        status: 200,
        data: escrows || [],
        escrowIds: escrowIds,
        joinedUsers: joinedUsers,
        message: "Escrows retrieved successfully",
        offerId: offer.offerId,
        totalEscrows: escrows?.length || 0,
        totalJoinedUsers: joinedUsers.length,
        relatedTrades: tradeIds.length > 0 ? {
          totalTrades: tradeIds.length,
          tradeIds: tradeIds
        } : undefined
      });
    } catch (error: any) {
      console.error('Error listing escrows:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to list escrows', 
        error: error.message 
      });
    }
  }

  // User: Pause/Resume own offer
  async userPauseOffer(req: any, res: any) {
    try {
      const { offerId } = req.params;
      
      // Extract email from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email;
      const { action } = req.body; // 'pause' | 'resume' (optional, defaults to 'pause')
      
      if (!email) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      // Find offer by _id or offerId
      const offer = await this.findOfferByIdentifier(offerId);
      if (!offer) {
        return res.status(404).json({ 
          status: 404,
          message: "Offer not found" 
        });
      }

      // Check if user owns the offer
      const isOfferCreator = offer.creatorEmail?.toLowerCase() === email.toLowerCase();
      if (!isOfferCreator) {
        return res.status(403).json({ 
          status: 403,
          message: "Access denied. You can only pause/resume your own offers.",
          debug: {
            offerCreator: offer.creatorEmail,
            userEmail: email
          }
        });
      }

      // Determine action: if not provided or empty, default to 'pause'
      // If current status is Paused, default to 'resume', otherwise 'pause'
      const finalAction = action || (offer.status === P2POfferStatus.Paused ? 'resume' : 'pause');
      
      // Validate action parameter
      if (finalAction !== 'pause' && finalAction !== 'resume') {
        return res.status(400).json({ 
          status: 400,
          message: "Invalid action. Must be 'pause' or 'resume'",
          provided: action || 'default'
        });
      }

      const newStatus = finalAction === 'resume' ? P2POfferStatus.Active : P2POfferStatus.Paused;
      
      // Use the correct query based on identifier type
      const updateQuery = this.getOfferQuery(offerId);
      await this.p2pOfferService.updatePart(
        updateQuery,
        { $set: { status: newStatus, updatedAt: new Date() } }
      );

      const updated = await this.findOfferByIdentifier(offerId);
      return res.status(200).json({ 
        status: 200, 
        data: updated, 
        message: `Offer ${finalAction === 'resume' ? 'resumed' : 'paused'} successfully` 
      });
    } catch (error: any) {
      console.error('Error pausing/resuming offer:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to modify offer status', 
        error: error.message 
      });
    }
  }

  // User: Get all offers created by the authenticated user
  async getUserOffers(req: any, res: any) {
    try {
      // Extract email from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email;
      
      if (!email) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      // Get query parameters for filtering
      const { status, offerType, limit, skip } = req.query;
      
      // Build query - filter by creatorEmail
      const query: any = {
        creatorEmail: email.toLowerCase()
      };

      // Optional status filter
      if (status) {
        query.status = status;
      }

      // Optional offerType filter (Buy or Sell)
      if (offerType) {
        query.offerType = offerType === "BUY" ? "Buy" : (offerType === "SELL" ? "Sell" : offerType);
      }

      // Pagination
      const limitNum = limit ? parseInt(limit) : 50;
      const skipNum = skip ? parseInt(skip) : 0;

      // Get offers with pagination, sorted by creation date (newest first)
      const offers = await this.p2pOfferService.findPaginatedSkip(
        limitNum,
        skipNum,
        { createdAt: -1 }, // Sort by newest first
        query,
        null
      );

      // Get total count for pagination info
      const totalCount = await this.p2pOfferService.findCount(query);

      return res.status(200).json({
        status: 200,
        data: offers || [],
        pagination: {
          total: totalCount,
          limit: limitNum,
          skip: skipNum,
          hasMore: (skipNum + limitNum) < totalCount
        },
        message: "User offers retrieved successfully"
      });
    } catch (error: any) {
      console.error('Error getting user offers:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to get user offers', 
        error: error.message 
      });
    }
  }

  // Admin: Get all offer IDs for a specific admin
  async adminGetOfferIds(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify admin authorization
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin' || user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required.",
          userRole: role || user?.role
        });
      }

      // Get query parameters
      const creatorEmail = req.query.creatorEmail || req.query.email || email;
      const status = req.query.status; // Optional status filter

      // Build query - must filter by creatorEmail
      const query: any = {
        creatorEmail: creatorEmail.toLowerCase()
      };

      // Optional status filter
      if (status) {
        query.status = status;
      }

      // Get all offers for this admin (only offerId field)
      const offers = await this.p2pOfferService.findSelect(
        query,
        { offerId: 1, _id: 0 } // Only return offerId field
      );

      // Extract just the offer IDs and sort by creation date (newest first)
      const offerIds = offers
        .map((offer: any) => offer.offerId)
        .sort((a: string, b: string) => {
          // Extract timestamp from offerId (format: P2P_timestamp_random)
          const getTimestamp = (id: string) => {
            const parts = id.split('_');
            return parts[1] ? parseInt(parts[1]) : 0;
          };
          return getTimestamp(b) - getTimestamp(a); // Descending order (newest first)
        });

      return res.status(200).json({
        status: 200,
        message: "Offer IDs retrieved successfully",
        data: {
          creatorEmail: creatorEmail.toLowerCase(),
          offerIds: offerIds,
          totalOffers: offerIds.length
        },
        filters: {
          creatorEmail: creatorEmail.toLowerCase(),
          status: status || 'all'
        }
      });

    } catch (error: any) {
      console.error('Error getting offer IDs:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to get offer IDs', 
        error: error.message 
      });
    }
  }

  // Admin: Get all P2P offers
  async adminGetAllOffers(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify admin authorization
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin' || user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required.",
          userRole: role || user?.role
        });
      }

      // Get query parameters
      const status = req.query.status;
      const creatorEmail = req.query.creatorEmail;
      const offerType = req.query.offerType;
      const cryptoCurrency = req.query.cryptoCurrency;
      const fiatCurrency = req.query.fiatCurrency;
      const side = req.query.side; // BUY or SELL
      const settlement = req.query.settlement; // INTERNAL_USD or REAL_FIAT
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

      // Build query
      const query: any = {};
      if (status) {
        query.status = status;
      }
      if (creatorEmail) {
        query.creatorEmail = creatorEmail.toLowerCase();
      }
      if (offerType) {
        query.offerType = offerType;
      }
      if (cryptoCurrency) {
        query.cryptoCurrency = cryptoCurrency;
      }
      if (fiatCurrency) {
        query.fiatCurrency = fiatCurrency;
      }
      if (side) {
        query.side = side;
      }
      if (settlement) {
        query.settlement = settlement;
      }

      // Get all offers with pagination
      const offers = await this.p2pOfferService.findPaginatedSkip(
        limit,
        skip,
        { createdAt: -1 }, // Sort by newest first
        query,
        null
      );

      return res.status(200).json({
        status: 200,
        message: "All P2P offers retrieved successfully",
        data: offers,
        pagination: {
          limit,
          skip,
          total: offers?.length || 0
        },
        filters: {
          status: status || 'all',
          creatorEmail: creatorEmail ? creatorEmail.toLowerCase() : 'all',
          offerType: offerType || 'all',
          cryptoCurrency: cryptoCurrency || 'all',
          fiatCurrency: fiatCurrency || 'all',
          side: side || 'all',
          settlement: settlement || 'all'
        }
      });

    } catch (error: any) {
      console.error('Error getting all offers:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to get all offers', 
        error: error.message 
      });
    }
  }

  // Admin: Get all P2P trading orders with escrow IDs
  async adminGetAllTrades(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify admin authorization
      const user = await this.userService.findOne({ email: email.toLowerCase() });
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin' || user?.role === UserRoleTypes.Admin || user?.role === UserRoleTypes.SuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required.",
          userRole: role || user?.role
        });
      }

      // Get query parameters
      const status = req.query.status;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
      const offerId = req.query.offerId;
      const userEmail = req.query.userEmail;

      // Build query
      const query: any = {};
      if (status) {
        query.status = status;
      }
      if (offerId) {
        query.offerId = offerId;
      }
      if (userEmail) {
        query.$or = [
          { buyerEmail: userEmail.toLowerCase() },
          { sellerEmail: userEmail.toLowerCase() }
        ];
      }

      // Get all trades with pagination
      const trades = await this.p2pTradeService.findPaginatedSkip(
        limit,
        skip,
        { createdAt: -1 }, // Sort by newest first
        query,
        null
      );

      // Get escrow IDs for each trade
      const tradesWithEscrows = await Promise.all(
        (trades || []).map(async (trade: any) => {
          // Find escrow for this trade
          const escrow = await this.p2pEscrowService.findOne({ tradeId: trade.tradeId });
          
          return {
            ...trade.toObject ? trade.toObject() : trade,
            escrowId: escrow?.escrowId || null,
            escrowStatus: escrow?.status || null,
            escrowDetails: escrow ? {
              escrowId: escrow.escrowId,
              status: escrow.status,
              userEmail: escrow.userEmail,
              adminEmail: escrow.adminEmail,
              user_sends_asset: escrow.user_sends_asset,
              user_sends_amount: escrow.user_sends_amount,
              user_receives_asset: escrow.user_receives_asset,
              user_receives_amount: escrow.user_receives_amount,
              approvedAt: escrow.approvedAt,
              approvedBy: escrow.approvedBy,
              createdAt: escrow.createdAt
            } : null
          };
        })
      );

      return res.status(200).json({
        status: 200,
        message: "All P2P trades retrieved successfully",
        data: tradesWithEscrows,
        pagination: {
          limit,
          skip,
          total: tradesWithEscrows.length
        },
        filters: {
          status: status || 'all',
          offerId: offerId || 'all',
          userEmail: userEmail || 'all'
        }
      });

    } catch (error: any) {
      console.error('Error getting all trades:', error);
      return res.status(500).json({ 
        status: 500, 
        message: 'Failed to get all trades', 
        error: error.message 
      });
    }
  }

  // Admin: Approve escrow (when status is ACTIVE)
  async adminApproveEscrow(req: any, res: any) {
    try {
      const { escrowId } = req.params;
      
      // Extract email and role from JWT token
      const claims = this.getclaims();
      const email = claims?.email || req.user?.email || this.userId;
      const role = claims?.role || req.user?.role;

      if (!email) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Load escrow - support both MongoDB _id and custom escrowId
      let escrow = null;
      try {
        const mongoose = require('mongoose');
        // Try MongoDB _id first if it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(escrowId) && escrowId.length === 24) {
          escrow = await this.p2pEscrowService.findById(escrowId);
        }
      } catch (error) {
        // If ObjectId lookup fails, try escrowId field
      }
      
      // If not found by _id, try escrowId field
      if (!escrow) {
        escrow = await this.p2pEscrowService.findOne({ escrowId: escrowId });
      }

      if (!escrow) {
        return res.status(404).json({ 
          message: "Escrow not found",
          debug: {
            identifier: escrowId,
            note: "Escrow can be found by MongoDB _id or escrowId field"
          }
        });
      }

      // Verify escrow status is ACTIVE
      if (escrow.status !== EscrowStatus.ACTIVE) {
        return res.status(400).json({ 
          message: `Escrow status must be ACTIVE to approve. Current status: ${escrow.status}` 
        });
      }

      // Verify admin authorization
      const offer = await this.p2pOfferService.findOne({ offerId: escrow.offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Check authorization: offer creator OR Admin/SuperAdmin
      const isOfferCreator = offer.creatorEmail?.toLowerCase() === email.toLowerCase();
      const isAdmin = role === UserRoleTypes.Admin || role === UserRoleTypes.SuperAdmin || role === 'Admin';

      if (!isOfferCreator && !isAdmin) {
        return res.status(403).json({ 
          message: "Not authorized to approve this escrow",
          debug: {
            offerCreator: offer.creatorEmail,
            userEmail: email,
            userRole: role
          }
        });
      }

      // Load trade
      const trade = await this.p2pTradeService.findOne({ tradeId: escrow.tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Ensure wallets exist
      await this.ensureWalletExists(escrow.userEmail, escrow.user_receives_asset);
      await this.ensureWalletExists(escrow.adminEmail, escrow.user_receives_asset);

      // Atomically complete the trade:
      // 1. Credit user receives asset to user
      await this.userService.updatePart(
        {
          email: escrow.userEmail.toLowerCase(),
          "userWallets.coinSymbol": escrow.user_receives_asset
        },
        {
          $inc: { "userWallets.$.coinBalance": escrow.user_receives_amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // 2. Debit admin wallet for user receives asset
      const debitAdminResult: any = await this.userService.updatePart(
        {
          email: escrow.adminEmail.toLowerCase(),
          "userWallets.coinSymbol": escrow.user_receives_asset,
          "userWallets.$.coinBalance": { $gte: escrow.user_receives_amount }
        },
        {
          $inc: { "userWallets.$.coinBalance": -escrow.user_receives_amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      if (!debitAdminResult || (debitAdminResult.matchedCount ?? debitAdminResult.nMatched ?? 0) === 0) {
        return res.status(400).json({ 
          message: `Insufficient admin balance for ${escrow.user_receives_asset}` 
        });
      }

      // 3. Create transaction records for both parties
      const transactionDate = new Date();
      
      // Transaction record for user (receiving asset)
      await this.transactionService.create({
        email: escrow.userEmail.toLowerCase(),
        orderId: escrow.tradeId,
        extRef: `P2P_COMPLETED_${escrow.tradeId}`,
        txId: `P2P_TX_${escrow.tradeId}_${Date.now()}`,
        from: escrow.adminEmail.toLowerCase(),
        to: escrow.userEmail.toLowerCase(),
        amount: escrow.user_receives_amount,
        info: `P2P Trade Completed - Received ${escrow.user_receives_amount} ${escrow.user_receives_asset}`,
        status: "Completed",
        currencyRef: escrow.user_receives_asset,
        walletType: "Asset Wallet",
        transactionType: "P2P_TRADE_COMPLETED",
        exchangeName: "Indexx P2P",
        txDate: transactionDate,
        benificaryAddress: escrow.userEmail.toLowerCase()
      } as any);

      // Transaction record for admin (sending asset)
      await this.transactionService.create({
        email: escrow.adminEmail.toLowerCase(),
        orderId: escrow.tradeId,
        extRef: `P2P_COMPLETED_${escrow.tradeId}`,
        txId: `P2P_TX_${escrow.tradeId}_${Date.now()}_ADMIN`,
        from: escrow.adminEmail.toLowerCase(),
        to: escrow.userEmail.toLowerCase(),
        amount: escrow.user_receives_amount,
        info: `P2P Trade Completed - Sent ${escrow.user_receives_amount} ${escrow.user_receives_asset} to user`,
        status: "Completed",
        currencyRef: escrow.user_receives_asset,
        walletType: "Asset Wallet",
        transactionType: "P2P_TRADE_COMPLETED",
        exchangeName: "Indexx P2P",
        txDate: transactionDate,
        benificaryAddress: escrow.userEmail.toLowerCase()
      } as any);

      // 4. Update escrow status to APPROVED (use escrow.escrowId, not the param which might be _id)
      await this.p2pEscrowService.updateEscrowStatus(escrow.escrowId, EscrowStatus.APPROVED, email);

      // 5. Update trade status to COMPLETED
      await this.p2pTradeService.updatePart(
        { tradeId: escrow.tradeId },
        { $set: { status: P2PTradeStatus.Completed, completedAt: transactionDate, updatedAt: transactionDate } }
      );

      // 6. Send email notifications to both parties
      const updatedTrade = await this.p2pTradeService.findOne({ tradeId: escrow.tradeId });
      if (updatedTrade) {
        await this.sendP2PEmail(escrow.userEmail, 'trade_completed', updatedTrade);
        await this.sendP2PEmail(escrow.adminEmail, 'trade_completed', updatedTrade);
      }

      // 7. Send push notifications
      await this.sendTradeNotification(escrow.userEmail, "trade_completed", { 
        tradeId: escrow.tradeId,
        escrowId: escrow.escrowId,
        amount: escrow.user_receives_amount,
        asset: escrow.user_receives_asset
      });

      // 8. Return success response
      const updatedEscrow = await this.p2pEscrowService.findOne({ escrowId: escrow.escrowId });

      return res.status(200).json({
        status: 200,
        message: "Escrow approved and trade completed successfully. Transaction records created and notifications sent.",
        data: {
          escrow: updatedEscrow,
          trade: updatedTrade
        }
      });

    } catch (error: any) {
      console.error('Error approving escrow:', error);
      return res.status(500).json({ status: 500, message: 'Failed to approve escrow', error: error.message });
    }
  }

  // Get all sell offers
  async getSellOffers(req: any, res: any) {
    try {
      const {
        cryptoCurrency,
        fiatCurrency,
        paymentMethod,
        minPrice,
        maxPrice,
        limit,
        skip
      } = req.query;

      const filters = {
        cryptoCurrency,
        fiatCurrency,
        offerType: "Sell" as const, // Force sell offers only
        paymentMethod,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        limit: limit ? parseInt(limit) : 50,
        skip: skip ? parseInt(skip) : 0
      };

      const offers = await this.p2pOfferService.getActiveOffers(filters);

      return res.status(200).json({
        status: 200,
        data: offers,
        message: "Sell offers retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting sell offers:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get sell offers",
        error: error.message
      });
    }
  }

  // Get all buy offers
  async getBuyOffers(req: any, res: any) {
    try {
      const {
        cryptoCurrency,
        fiatCurrency,
        paymentMethod,
        minPrice,
        maxPrice,
        limit,
        skip
      } = req.query;

      const filters = {
        cryptoCurrency,
        fiatCurrency,
        offerType: "Buy" as const, // Force buy offers only
        paymentMethod,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        limit: limit ? parseInt(limit) : 50,
        skip: skip ? parseInt(skip) : 0
      };

      const offers = await this.p2pOfferService.getActiveOffers(filters);

      return res.status(200).json({
        status: 200,
        data: offers,
        message: "Buy offers retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting buy offers:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get buy offers",
        error: error.message
      });
    }
  }

  // Create a new P2P trade
  async createTrade(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;

      const { offerId, fiatAmount, paymentMethod, paymentDetails, buyerMessage } = req.body;

      // Get the offer
      const offer = await this.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      if (offer.status !== P2POfferStatus.Active) {
        return res.status(400).json({ message: "Offer is not active" });
      }

      if (email && offer.creatorEmail === email) {
        return res.status(400).json({ message: "Cannot trade with your own offer" });
      }

      // Validate amount
      if (fiatAmount < offer.minAmount || fiatAmount > offer.maxAmount || fiatAmount > offer.availableAmount) {
        return res.status(400).json({ message: "Invalid trade amount" });
      }

      // Validate payment method
      if (!offer.paymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ message: "Payment method not accepted by seller" });
      }

      // Calculate crypto amount
      const cryptoAmount = fiatAmount / offer.pricePerUnit;

      // Generate unique trade ID
      const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // For BUY offers: Check if seller (person taking offer) has sufficient crypto balance
      if (offer.offerType === "Buy" && email) {
        const seller = await this.userService.findOne({ email });
        const cryptoWallet = seller?.userWallets?.find((w: UserWallet) => 
          w.coinSymbol === offer.cryptoCurrency && 
          (offer.cryptoNetwork ? w.coinNetwork === offer.cryptoNetwork : true)
        );

        if (!cryptoWallet || cryptoWallet.coinBalance < cryptoAmount) {
          return res.status(400).json({ 
            message: `Insufficient ${offer.cryptoCurrency} balance. Required: ${cryptoAmount}, Available: ${cryptoWallet?.coinBalance || 0}` 
          });
        }

        // Lock seller's crypto in escrow
        const escrowSuccess = await this.escrowService.lockInEscrow(
          email,
          offer.cryptoCurrency,
          offer.cryptoNetwork,
          cryptoAmount,
          tradeId
        );

        if (!escrowSuccess) {
          return res.status(500).json({ message: "Failed to lock crypto in escrow" });
        }
      }

      // For SELL offers: Check if buyer (person taking offer) has sufficient fiat balance
      if (offer.offerType === "Sell" && email) {
        const buyer = await this.userService.findOne({ email });
        const fiatWallet = buyer?.userWallets?.find((w: UserWallet) => 
          w.coinSymbol === offer.fiatCurrency
        );

        if (!fiatWallet || fiatWallet.coinBalance < fiatAmount) {
          return res.status(400).json({ 
            message: `Insufficient ${offer.fiatCurrency} balance. Required: ${fiatAmount}, Available: ${fiatWallet?.coinBalance || 0}` 
          });
        }

        // Lock buyer's fiat in escrow
        const escrowSuccess = await this.escrowService.lockInEscrow(
          email,
          offer.fiatCurrency,
          undefined, // No network for fiat
          fiatAmount,
          tradeId
        );

        if (!escrowSuccess) {
          return res.status(500).json({ message: "Failed to lock fiat in escrow" });
        }
      }

      // Set expiration time (24 hours)
      // Set expiration time to undefined (no automatic expiration)
      const expiresAt = undefined;

      const tradeData: Partial<P2PTrade> = {
        tradeId,
        offerId,
        buyerEmail: offer.offerType === "Buy" ? offer.creatorEmail : (email || "user@example.com"),
        sellerEmail: offer.offerType === "Buy" ? (email || "user@example.com") : offer.creatorEmail,
        offerType: offer.offerType,
        cryptoAmount,
        cryptoCurrency: offer.cryptoCurrency,
        cryptoNetwork: offer.cryptoNetwork,
        fiatAmount,
        fiatCurrency: offer.fiatCurrency,
        pricePerUnit: offer.pricePerUnit,
        paymentMethod,
        paymentDetails,
        status: P2PTradeStatus.Pending,
        expiresAt,
        escrowCryptoAmount: cryptoAmount,
        escrowReleased: false,
        buyerMessage,
        buyerKycVerified: false, // TODO: Check KYC status
        sellerKycVerified: false // TODO: Check KYC status
      };

      const newTrade = await this.p2pTradeService.create(tradeData as P2PTrade);

      // Update offer availability
      const newAvailableAmount = offer.availableAmount - fiatAmount;
      await this.p2pOfferService.updateAvailability(offerId, newAvailableAmount);

      // If offer is fully taken, mark as completed
      if (newAvailableAmount <= 0) {
        await this.p2pOfferService.toggleOfferStatus(offerId, P2POfferStatus.Completed);
      }

      // Send notifications (only if email is provided)
      if (email) {
        await this.sendTradeNotification(offer.creatorEmail, "new_trade", { tradeId, buyerEmail: email });
        
        // Send email notifications to both parties
        await this.sendP2PEmail(email, 'trade_created', newTrade);
        await this.sendP2PEmail(offer.creatorEmail, 'trade_created', newTrade);
      }

      return res.status(201).json({
        status: 201,
        data: newTrade,
        message: "P2P trade created successfully"
      });

    } catch (error: any) {
      console.error("Error creating P2P trade:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to create P2P trade",
        error: error.message
      });
    }
  }

  // Mark trade as paid
  async markAsPaid(req: any, res: any) {
    try {
      const email = req.user?.email;
      const { tradeId, paymentProof } = req.body;

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.buyerEmail !== email) {
        return res.status(403).json({ message: "Only buyer can mark as paid" });
      }

      if (trade.status !== P2PTradeStatus.Pending) {
        return res.status(400).json({ message: "Trade is not in pending status" });
      }

      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Paid, {
        paymentProof
      });

      // Send notification to seller
      await this.sendTradeNotification(trade.sellerEmail, "payment_received", { tradeId });

      return res.status(200).json({
        status: 200,
        message: "Payment marked successfully"
      });

    } catch (error: any) {
      console.error("Error marking trade as paid:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to mark trade as paid",
        error: error.message
      });
    }
  }

  // Confirm payment and release escrow
  async confirmPayment(req: any, res: any) {
    try {
      const email = req.user?.email;
      const { tradeId } = req.body;

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.sellerEmail !== email) {
        return res.status(403).json({ message: "Only seller can confirm payment" });
      }

      if (trade.status !== P2PTradeStatus.Paid) {
        return res.status(400).json({ message: "Trade is not in paid status" });
      }

      // Release escrow and transfer crypto
      await this.releaseEscrowAndTransfer(trade);

      // Send notification to buyer
      await this.sendTradeNotification(trade.buyerEmail, "trade_completed", { tradeId });

      return res.status(200).json({
        status: 200,
        message: "Payment confirmed and crypto released"
      });

    } catch (error: any) {
      console.error("Error confirming payment:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to confirm payment",
        error: error.message
      });
    }
  }

  // Cancel trade
  async cancelTrade(req: any, res: any) {
    try {
      const email = req.user?.email;
      // Allow tradeId to come from either params or body for flexibility
      const tradeId = req.params?.tradeId || req.body?.tradeId;
      const reason = req.body?.reason;

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      if (trade.buyerEmail !== email && trade.sellerEmail !== email) {
        return res.status(403).json({ message: "Only trade participants can cancel" });
      }

      if (trade.status === P2PTradeStatus.Completed) {
        return res.status(400).json({ message: "Cannot cancel completed trade" });
      }

      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Cancelled, {
        cancelReason: reason
      });

      // Refund escrow if applicable
      if (trade.status === P2PTradeStatus.Paid) {
        await this.refundEscrow(trade);
      }

      // Restore offer availability
      await this.restoreOfferAvailability(trade);

      // Send email notifications to both parties
      await this.sendP2PEmail(trade.buyerEmail, 'trade_cancelled', trade);
      await this.sendP2PEmail(trade.sellerEmail, 'trade_cancelled', trade);

      return res.status(200).json({
        status: 200,
        message: "Trade cancelled successfully"
      });

    } catch (error: any) {
      console.error("Error cancelling trade:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to cancel trade",
        error: error.message
      });
    }
  }

  // Get user's trades
  async getUserTrades(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      const email = req.query.email || req.body.email || req.user?.email;
      const { status, limit } = req.query;

      if (!email) {
        return res.status(400).json({ message: "Email is required to get user trades" });
      }

      const trades = await this.p2pTradeService.getUserTrades(email, status, limit ? parseInt(limit) : 50);

      return res.status(200).json({
        status: 200,
        data: trades,
        message: "User trades retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting user trades:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get user trades",
        error: error.message
      });
    }
  }

  /**
   * Get user's completed trades
   * Returns all trades with status "Completed"
   */
  async getUserCompletedTrades(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      const email = req.query.email || req.body.email;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      if (!email) {
        return res.status(400).json({ message: "Email is required to get user trades" });
      }

      // Use the same service method as getUserTrades but filter by Completed status
      const trades = await this.p2pTradeService.getUserTrades(email, P2PTradeStatus.Completed, limit);

      return res.status(200).json({
        status: 200,
        data: trades,
        message: "Completed trades retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting completed trades:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get completed trades",
        error: error.message
      });
    }
  }

  /**
   * Get user's pending trades
   * Returns trades with status: Pending, Paid, or Confirmed (waiting for completion)
   */
  async getUserPendingTrades(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      const email = req.query.email || req.body.email;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      if (!email) {
        return res.status(400).json({ message: "Email is required to get user trades" });
      }

      const emailLower = email.toLowerCase();

      // Get pending trades (Pending, Paid, Confirmed)
      // Use the same query structure as getUserTrades
      const query: any = {
        $or: [
          { buyerEmail: emailLower },
          { sellerEmail: emailLower }
        ],
        status: { 
          $in: [
            P2PTradeStatus.Pending,
            P2PTradeStatus.Paid,
            P2PTradeStatus.Confirmed
          ] 
        }
      };

      // Use findPaginated to match the existing API structure
      const trades = await this.p2pTradeService.findPaginated(
        limit,
        { createdAt: -1 }, // Sort by creation date (most recent first)
        query,
        null
      );

      return res.status(200).json({
        status: 200,
        data: trades,
        message: "Pending trades retrieved successfully"
      });

    } catch (error: any) {
      console.error("Error getting pending trades:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to get pending trades",
        error: error.message
      });
    }
  }

  // Send payment to escrow (for BUY offers)
  async sendPaymentToEscrow(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;
      const tradeId = req.params.tradeId;
      const { paymentProof, paymentDetails } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify user is the buyer
      if (trade.buyerEmail !== email) {
        return res.status(403).json({ message: "Only buyer can send payment to escrow" });
      }

      if (trade.status !== P2PTradeStatus.Pending) {
        return res.status(400).json({ message: "Trade is not in pending status" });
      }

      // Lock buyer's fiat amount in escrow
      const escrowSuccess = await this.escrowService.lockInEscrow(
        email,
        trade.fiatCurrency,
        undefined, // No network for fiat
        trade.fiatAmount,
        tradeId
      );

      if (!escrowSuccess) {
        return res.status(500).json({ message: "Failed to lock payment in escrow" });
      }

      // Update trade status
      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Paid, {
        paymentProof,
        paymentDetails,
        paymentSentAt: new Date()
      });

      // Send notification to seller
      await this.sendTradeNotification(trade.sellerEmail, "payment_sent_to_escrow", { tradeId });
      
      // Send email notifications
      await this.sendP2PEmail(email, 'payment_sent', trade);
      await this.sendP2PEmail(trade.sellerEmail, 'payment_sent', trade);

      return res.status(200).json({
        status: 200,
        message: "Payment sent to escrow successfully. Waiting for seller to send crypto."
      });

    } catch (error: any) {
      console.error("Error sending payment to escrow:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to send payment to escrow",
        error: error.message
      });
    }
  }

  // Confirm payment received (for BUY offers)
  async confirmPaymentReceived(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;
      const tradeId = req.params.tradeId;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify user is the seller
      if (trade.sellerEmail !== email) {
        return res.status(403).json({ message: "Only seller can confirm payment" });
      }

      if (trade.status !== P2PTradeStatus.Paid) {
        return res.status(400).json({ message: "Trade is not in paid status" });
      }

      // Update trade status
      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Confirmed, {
        paymentConfirmedAt: new Date()
      });

      // Send notification to buyer
      await this.sendTradeNotification(trade.buyerEmail, "payment_confirmed", { tradeId });

      return res.status(200).json({
        status: 200,
        message: "Payment confirmed. Please send crypto to escrow to complete the trade."
      });

    } catch (error: any) {
      console.error("Error confirming payment:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to confirm payment",
        error: error.message
      });
    }
  }

  // Send crypto to escrow (for SELL offers)
  async sendCryptoToEscrow(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;
      const tradeId = req.params.tradeId;
      const { cryptoProof, cryptoDetails } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify user is the seller
      if (trade.sellerEmail !== email) {
        return res.status(403).json({ message: "Only seller can send crypto to escrow" });
      }

      if (trade.status !== P2PTradeStatus.Pending) {
        return res.status(400).json({ message: "Trade is not in pending status" });
      }

      // Lock seller's crypto in escrow
      const escrowSuccess = await this.escrowService.lockInEscrow(
        email,
        trade.cryptoCurrency,
        trade.cryptoNetwork,
        trade.cryptoAmount,
        tradeId
      );

      if (!escrowSuccess) {
        return res.status(500).json({ message: "Failed to lock crypto in escrow" });
      }

      // Update trade status
      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Paid, {
        cryptoProof,
        cryptoSentAt: new Date()
      });

      // Send notification to buyer
      await this.sendTradeNotification(trade.buyerEmail, "crypto_sent_to_escrow", { tradeId });
      
      // Send email notifications
      await this.sendP2PEmail(email, 'crypto_sent', trade);
      await this.sendP2PEmail(trade.buyerEmail, 'crypto_sent', trade);

      return res.status(200).json({
        status: 200,
        message: "Crypto sent to escrow successfully. Waiting for buyer to send payment."
      });

    } catch (error: any) {
      console.error("Error sending crypto to escrow:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to send crypto to escrow",
        error: error.message
      });
    }
  }

  // Confirm crypto received (for SELL offers)
  async confirmCryptoReceived(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;
      const tradeId = req.params.tradeId;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify user is the buyer
      if (trade.buyerEmail !== email) {
        return res.status(403).json({ message: "Only buyer can confirm crypto" });
      }

      if (trade.status !== P2PTradeStatus.Paid) {
        return res.status(400).json({ message: "Trade is not in paid status" });
      }

      // Update trade status
      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Confirmed, {
        cryptoConfirmedAt: new Date()
      });

      // Send notification to seller
      await this.sendTradeNotification(trade.sellerEmail, "crypto_confirmed", { tradeId });

      return res.status(200).json({
        status: 200,
        message: "Crypto confirmed. Please send payment to escrow to complete the trade."
      });

    } catch (error: any) {
      console.error("Error confirming crypto:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to confirm crypto",
        error: error.message
      });
    }
  }

  // Release escrow (both scenarios)
  async releaseEscrow(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email;
      const tradeId = req.params.tradeId;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify user is part of the trade
      if (trade.buyerEmail !== email && trade.sellerEmail !== email) {
        return res.status(403).json({ message: "Only trade participants can release escrow" });
      }

      if (trade.status !== P2PTradeStatus.Confirmed) {
        return res.status(400).json({ message: "Trade is not in confirmed status" });
      }

      // Release escrow based on offer type
      if (trade.offerType === "Buy") {
        // BUY offer: Release crypto to buyer, fiat to seller
        await this.releaseEscrowForBuyOffer(trade);
      } else {
        // SELL offer: Release crypto to buyer, fiat to seller
        await this.releaseEscrowForSellOffer(trade);
      }

      // Update trade status to completed
      await this.p2pTradeService.updateTradeStatus(tradeId, P2PTradeStatus.Completed, {
        completedAt: new Date()
      });

      // Send notifications
      await this.sendTradeNotification(trade.buyerEmail, "trade_completed", { tradeId });
      await this.sendTradeNotification(trade.sellerEmail, "trade_completed", { tradeId });
      
      // Send email notifications to both parties
      await this.sendP2PEmail(trade.buyerEmail, 'trade_completed', trade);
      await this.sendP2PEmail(trade.sellerEmail, 'trade_completed', trade);

      return res.status(200).json({
        status: 200,
        message: "Escrow released successfully. Trade completed!"
      });

    } catch (error: any) {
      console.error("Error releasing escrow:", error);
      return res.status(500).json({
        status: 500,
        message: "Failed to release escrow",
        error: error.message
      });
    }
  }

  // Private helper methods
  private async releaseEscrowAndTransfer(trade: P2PTrade) {
    try {
      // Update trade status
      await this.p2pTradeService.updateTradeStatus(trade.tradeId, P2PTradeStatus.Confirmed);

      // Release crypto from escrow to buyer
      const escrowSuccess = await this.escrowService.releaseFromEscrow(
        trade.buyerEmail,
        trade.cryptoCurrency,
        trade.cryptoNetwork,
        trade.cryptoAmount,
        trade.tradeId
      );

      if (!escrowSuccess) {
        throw new Error("Failed to release crypto from escrow");
      }

      // Mark escrow as released
      await this.p2pTradeService.releaseEscrow(trade.tradeId);

      // Update offer statistics
      await this.updateOfferStatistics(trade.offerId);

    } catch (error) {
      console.error("Error releasing escrow:", error);
      throw error;
    }
  }

  private async transferCrypto(fromEmail: string, toEmail: string, cryptoCurrency: string, cryptoNetwork: string | undefined, amount: number) {
    // Debit from seller
    await this.userService.updatePart(
      {
        email: fromEmail,
        "userWallets.coinSymbol": cryptoCurrency,
        ...(cryptoNetwork && { "userWallets.coinNetwork": cryptoNetwork })
      },
      {
        $inc: { "userWallets.$.coinBalance": -amount },
        $set: { "userWallets.$.coinLastUsedOn": new Date() }
      }
    );

    // Credit to buyer
    await this.userService.updatePart(
      {
        email: toEmail,
        "userWallets.coinSymbol": cryptoCurrency,
        ...(cryptoNetwork && { "userWallets.coinNetwork": cryptoNetwork })
      },
      {
        $inc: { "userWallets.$.coinBalance": amount },
        $set: { "userWallets.$.coinLastUsedOn": new Date() }
      }
    );
  }

  private async refundEscrow(trade: P2PTrade) {
    // Refund crypto from escrow to original owner
    await this.escrowService.refundFromEscrow(
      trade.buyerEmail,
      trade.cryptoCurrency,
      trade.cryptoNetwork,
      trade.cryptoAmount,
      trade.tradeId
    );
  }

  private async restoreOfferAvailability(trade: P2PTrade) {
    const offer = await this.p2pOfferService.findOne({ offerId: trade.offerId });
    if (offer) {
      const newAvailableAmount = offer.availableAmount + trade.fiatAmount;
      await this.p2pOfferService.updateAvailability(trade.offerId, newAvailableAmount);
    }
  }

  private async updateOfferStatistics(offerId: string) {
    const offer = await this.p2pOfferService.findOne({ offerId });
    if (offer) {
      const completedTrades = await this.p2pTradeService.find({ 
        offerId, 
        status: P2PTradeStatus.Completed 
      });
      
      const totalTrades = await this.p2pTradeService.find({ offerId });
      
      const completionRate = totalTrades.length > 0 ? 
        (completedTrades.length / totalTrades.length) * 100 : 0;

      await this.p2pOfferService.updatePart(
        { offerId },
        {
          $set: {
            completionRate,
            totalTrades: totalTrades.length,
            updatedAt: new Date()
          }
        }
      );
    }
  }

  private async sendTradeNotification(email: string, type: string, data: any) {
    try {
      const user = await this.userService.findOne({ email });
      if (user?.fcmToken) {
        await this.notificationService.sendNotification(user, type, data);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  private async sendP2PEmail(email: string, type: string, tradeData: any, offerData?: any) {
    try {
      const sendEmail = new SendEmail();
      
      switch (type) {
        case 'offer_created':
          await sendEmail.sendP2POfferCreatedEmail(
            email,
            offerData.offerId,
            offerData.offerType,
            offerData.cryptoCurrency,
            offerData.fiatCurrency,
            offerData.pricePerUnit,
            offerData.availableAmount
          );
          break;
          
        case 'trade_created':
          await sendEmail.sendP2PTradeCreatedEmail(
            email,
            tradeData.tradeId,
            tradeData.offerType,
            tradeData.cryptoAmount,
            tradeData.cryptoCurrency,
            tradeData.fiatAmount,
            tradeData.fiatCurrency,
            tradeData.buyerEmail,
            tradeData.sellerEmail
          );
          break;
          
        case 'trade_completed':
          // Use sendOrderCompleted template for P2P trade completion
          await this.sendP2PTradeCompletedOrderEmail(email, tradeData);
          break;
          
        case 'payment_sent':
          await sendEmail.sendP2PPaymentSentEmail(
            email,
            tradeData.tradeId,
            tradeData.fiatAmount,
            tradeData.fiatCurrency,
            tradeData.paymentMethod
          );
          break;
          
        case 'crypto_sent':
          await sendEmail.sendP2PCryptoSentEmail(
            email,
            tradeData.tradeId,
            tradeData.cryptoAmount,
            tradeData.cryptoCurrency
          );
          break;
          
        case 'trade_cancelled':
          await sendEmail.sendP2PTradeCancelledEmail(
            email,
            tradeData.tradeId,
            tradeData.cancelReason || 'Trade cancelled'
          );
          break;
          
        case 'dispute_created':
          await sendEmail.sendP2PDisputeCreatedEmail(
            email,
            tradeData.disputeId,
            tradeData.tradeId,
            tradeData.reason
          );
          break;
      }
    } catch (error) {
      console.error("Error sending P2P email:", error);
    }
  }

  private async sendP2PTradeCompletedOrderEmail(email: string, tradeData: P2PTrade) {
    try {
      const sendEmail = new SendEmail();
      const currencyService = new CurrencyService();
      
      // Determine if this email is for buyer or seller
      const isBuyer = email === tradeData.buyerEmail;
      
      let orderAmount: number;
      let orderCurrency: string;
      let priceInUSD: number = 0;
      let amountInUSD: number = 0;
      
      if (isBuyer) {
        // Buyer receives crypto
        orderAmount = tradeData.cryptoAmount;
        orderCurrency = tradeData.cryptoCurrency;
        
        // Try to get crypto USD price
        try {
          const cryptoPriceRes = await currencyService.getCurrencyPriceByType("Crypto", tradeData.cryptoCurrency);
          if (cryptoPriceRes.status === 200 && cryptoPriceRes.data) {
            const avgPrice = (cryptoPriceRes.data.buyPrice + cryptoPriceRes.data.sellPrice) / 2;
            priceInUSD = avgPrice;
            amountInUSD = orderAmount * avgPrice;
          } else {
            // Fallback: if fiat is USD, estimate from trade
            if (tradeData.fiatCurrency === "USD") {
              priceInUSD = tradeData.fiatAmount / tradeData.cryptoAmount;
              amountInUSD = tradeData.fiatAmount;
            } else {
              // Use pricePerUnit as fallback
              priceInUSD = tradeData.pricePerUnit;
              amountInUSD = tradeData.fiatAmount;
            }
          }
        } catch (error) {
          console.error("Error getting crypto price:", error);
          // Fallback calculation
          if (tradeData.fiatCurrency === "USD") {
            priceInUSD = tradeData.fiatAmount / tradeData.cryptoAmount;
            amountInUSD = tradeData.fiatAmount;
          } else {
            priceInUSD = tradeData.pricePerUnit;
            amountInUSD = tradeData.fiatAmount;
          }
        }
      } else {
        // Seller receives fiat
        orderAmount = tradeData.fiatAmount;
        orderCurrency = tradeData.fiatCurrency;
        
        // For fiat currencies
        if (tradeData.fiatCurrency === "USD") {
          priceInUSD = 1;
          amountInUSD = tradeData.fiatAmount;
        } else {
          // Try to get fiat currency rate (if available in currency service)
          // Otherwise, estimate from crypto equivalent
          try {
            const cryptoPriceRes = await currencyService.getCurrencyPriceByType("Crypto", tradeData.cryptoCurrency);
            if (cryptoPriceRes.status === 200 && cryptoPriceRes.data) {
              const avgPrice = (cryptoPriceRes.data.buyPrice + cryptoPriceRes.data.sellPrice) / 2;
              // Estimate: crypto amount * crypto price = USD value
              amountInUSD = tradeData.cryptoAmount * avgPrice;
              priceInUSD = amountInUSD / tradeData.fiatAmount;
            } else {
              // Fallback
              priceInUSD = 1;
              amountInUSD = tradeData.fiatAmount;
            }
          } catch (error) {
            console.error("Error getting price for seller:", error);
            priceInUSD = 1;
            amountInUSD = tradeData.fiatAmount;
          }
        }
      }
      
      await sendEmail.sendOrderCompleted(
        email,
        "User",
        orderAmount,
        orderCurrency,
        tradeData.offerType,
        priceInUSD,
        amountInUSD,
        "",
        tradeData.tradeId
      );
    } catch (error) {
      console.error("Error sending P2P trade completed order email:", error);
      // Fallback to simple email if detailed one fails
      try {
        const sendEmail = new SendEmail();
        await sendEmail.sendP2PTradeCompletedEmail(
          email,
          tradeData.tradeId,
          tradeData.offerType,
          tradeData.cryptoAmount,
          tradeData.cryptoCurrency,
          tradeData.fiatAmount,
          tradeData.fiatCurrency,
          tradeData.buyerEmail,
          tradeData.sellerEmail
        );
      } catch (fallbackError) {
        console.error("Error sending fallback P2P email:", fallbackError);
      }
    }
  }

  private async releaseEscrowForBuyOffer(trade: P2PTrade) {
    try {
      // For BUY offers: Release crypto from escrow to buyer, fiat from escrow to seller
      
      // Release crypto to buyer
      await this.escrowService.releaseFromEscrow(
        "escrow@indexx.exchange", // From escrow
        trade.cryptoCurrency,
        trade.cryptoNetwork,
        trade.cryptoAmount,
        trade.tradeId
      );

      // Credit crypto to buyer
      await this.userService.updatePart(
        {
          email: trade.buyerEmail,
          "userWallets.coinSymbol": trade.cryptoCurrency,
          ...(trade.cryptoNetwork && { "userWallets.coinNetwork": trade.cryptoNetwork })
        },
        {
          $inc: { "userWallets.$.coinBalance": trade.cryptoAmount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // Release fiat to seller
      await this.escrowService.releaseFromEscrow(
        "escrow@indexx.exchange", // From escrow
        trade.fiatCurrency,
        undefined, // No network for fiat
        trade.fiatAmount,
        trade.tradeId
      );

      // Credit fiat to seller (assuming they have a fiat wallet)
      await this.userService.updatePart(
        {
          email: trade.sellerEmail,
          "userWallets.coinSymbol": trade.fiatCurrency
        },
        {
          $inc: { "userWallets.$.coinBalance": trade.fiatAmount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

    } catch (error) {
      console.error("Error releasing escrow for buy offer:", error);
      throw error;
    }
  }

  private async releaseEscrowForSellOffer(trade: P2PTrade) {
    try {
      // For SELL offers: Release crypto from escrow to buyer, fiat from escrow to seller
      
      // Release crypto to buyer
      await this.escrowService.releaseFromEscrow(
        "escrow@indexx.exchange", // From escrow
        trade.cryptoCurrency,
        trade.cryptoNetwork,
        trade.cryptoAmount,
        trade.tradeId
      );

      // Credit crypto to buyer
      await this.userService.updatePart(
        {
          email: trade.buyerEmail,
          "userWallets.coinSymbol": trade.cryptoCurrency,
          ...(trade.cryptoNetwork && { "userWallets.coinNetwork": trade.cryptoNetwork })
        },
        {
          $inc: { "userWallets.$.coinBalance": trade.cryptoAmount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // Release fiat to seller
      await this.escrowService.releaseFromEscrow(
        "escrow@indexx.exchange", // From escrow
        trade.fiatCurrency,
        undefined, // No network for fiat
        trade.fiatAmount,
        trade.tradeId
      );

      // Credit fiat to seller (assuming they have a fiat wallet)
      await this.userService.updatePart(
        {
          email: trade.sellerEmail,
          "userWallets.coinSymbol": trade.fiatCurrency
        },
        {
          $inc: { "userWallets.$.coinBalance": trade.fiatAmount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

    } catch (error) {
      console.error("Error releasing escrow for sell offer:", error);
      throw error;
    }
  }

  // ==========================================
  // NEW ADMIN-OFFER JOIN ENDPOINTS
  // ==========================================

  /**
   * Join offer with ASSET_WALLET settlement (instant internal)
   * POST /p2p/offers/:offerId/join-asset
   * 
   * Business rules:
   * - side_admin="BUY": admin WANTS token_to_buy, admin GIVES counter asset
   *   → user_sends_asset = token_to_buy, user_receives_asset = counter asset
   * - side_admin="SELL": admin GIVES token_to_buy, admin WANTS token_taken_from_user
   *   → user_sends_asset = token_taken_from_user, user_receives_asset = token_to_buy
   */
  async joinOfferWithAsset(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      // Extract email from JWT token, body, or user object
      // Priority: 1) body.email, 2) req.user.email, 3) base class userId (from JWT), 4) manual JWT decode
      let email = req.body.email || req.user?.email || this.userId;
      if (!email && req.headers?.authorization) {
        try {
          const jwt = require("jsonwebtoken");
          const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
          const decoded: any = jwt.decode(token);
          email = decoded?.email;
        } catch (e) {
          // Token decode failed - email will remain undefined
          console.error("Failed to decode JWT token:", e);
        }
      }

      const { offerId } = req.params;
      // Support both "amount_wants" and "amount" field names
      const amount_wants = req.body.amount_wants || req.body.amount;
      const { idempotency_key } = req.body;

      // Validation
      if (!amount_wants || amount_wants <= 0) {
        return res.status(400).json({ 
          message: "amount_wants (or amount) must be > 0",
          received: { amount_wants: req.body.amount_wants, amount: req.body.amount },
          body: req.body
        });
      }

      if (!email) {
        return res.status(401).json({ message: "Authentication required - email not found in token or body" });
      }

      // 1. Load offer
      const offer = await this.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Map offer fields to required schema
      const side_admin = offer.side || (offer.offerType === "Buy" ? "BUY" : "SELL");
      const token_to_buy = offer.assetSymbol || offer.baseToken || offer.cryptoCurrency;
      const token_taken_from_user = offer.returnToken || offer.quoteToken || offer.fiatCurrency;
      
      // Normalize settlement for comparison (handle both enum and string values)
      const normalizedSettlement = String(offer.settlement || "").toUpperCase();
      const isInternalUSD = normalizedSettlement === "INTERNAL_USD" || 
                           normalizedSettlement === "ASSET WALLET" || 
                           normalizedSettlement === "ASSET_WALLET" ||
                           offer.settlement === P2PSettlementType.INTERNAL_USD;
      const isRealFiat = normalizedSettlement === "REAL_FIAT" || 
                         normalizedSettlement === "GATEWAY" ||
                         offer.settlement === P2PSettlementType.REAL_FIAT;
      
      const payment_method_type = isInternalUSD ? "ASSET_WALLET" : 
                                   isRealFiat ? "GATEWAY" : 
                                   side_admin === "BUY" ? "ASSET_WALLET" : "GATEWAY";

      // 2. Validate offer.payment_method_type === "ASSET_WALLET" and active
      if (payment_method_type !== "ASSET_WALLET") {
        return res.status(400).json({ 
          message: "This endpoint requires ASSET_WALLET settlement",
          offer_payment_method_type: payment_method_type 
        });
      }

      if (offer.status !== P2POfferStatus.Active) {
        return res.status(400).json({ message: "Offer is not active" });
      }

      // 3. Validate amount in [min,max]
      if (amount_wants < offer.minAmount || amount_wants > offer.maxAmount) {
        return res.status(400).json({ 
          message: `Amount must be between ${offer.minAmount} and ${offer.maxAmount}`,
          received: amount_wants,
          min: offer.minAmount,
          max: offer.maxAmount
        });
      }

      // 4. Derive settlement details
      const settlement = this.deriveSettlementForOffer({
        side_admin,
        token_to_buy,
        token_taken_from_user,
        price: offer.price || offer.pricePerUnit
      }, amount_wants);

      // 5. Validate tokens exist in catalog (basic check)
      await this.assertTokensExist(settlement.user_sends_asset, settlement.user_receives_asset);

      // 6. Check user has sufficient balance
      const normalizedEmail = email.toLowerCase();
      const user = await this.userService.findOne({ email: normalizedEmail });
      if (!user) {
        // Extract email from token for debugging
        let tokenEmail = null;
        if (req.headers?.authorization) {
          try {
            const jwt = require("jsonwebtoken");
            const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
            const decoded: any = jwt.decode(token);
            tokenEmail = decoded?.email;
          } catch (e) {
            tokenEmail = "Failed to decode token";
          }
        }
        
        return res.status(404).json({ 
          message: "User not found",
          email: normalizedEmail,
          suggestion: "Make sure the user exists in the database. You can pass 'email' in the request body to override the JWT token email.",
          debug: {
            extractedEmail: email,
            normalizedEmail: normalizedEmail,
            tokenEmail: tokenEmail,
            baseClassUserId: this.userId,
            bodyEmail: req.body.email,
            note: "Email priority: 1) req.body.email, 2) JWT token email"
          }
        });
      }

        const wallet = user?.userWallets?.find((w: any) => 
          w.coinSymbol === settlement.user_sends_asset
        );

        if (!wallet || wallet.coinBalance < settlement.user_sends_amount) {
          return res.status(400).json({ 
          message: `Insufficient ${settlement.user_sends_asset} balance`,
          required: settlement.user_sends_amount,
          available: wallet?.coinBalance || 0
          });
      }

      // 7. Generate trade ID
      const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 8. Create Trade with settlement_type="ASSET_WALLET", status="INITIATED"
      const tradeData: any = {
        tradeId,
        offerId: offer.offerId,
        buyerEmail: email.toLowerCase(),
        sellerEmail: offer.creatorEmail,
        offerType: offer.offerType,
        
        // Settlement fields per spec
        amount_wants,
        user_sends_asset: settlement.user_sends_asset,
        user_receives_asset: settlement.user_receives_asset,
        user_sends_amount: settlement.user_sends_amount,
        user_receives_amount: settlement.user_receives_amount,
        settlement_type: "ASSET_WALLET",
        status: P2PTradeStatus.Pending, // Will be updated to COMPLETED after settlement
        
        // Legacy fields for compatibility
        side: offer.side,
        settlement: "ASSET_WALLET",
        assetSymbol: settlement.user_receives_asset,
        returnToken: settlement.user_sends_asset,
        unitPrice: offer.price || offer.pricePerUnit,
        cryptoAmount: settlement.user_receives_amount,
        cryptoCurrency: settlement.user_receives_asset,
        fiatAmount: settlement.user_sends_amount,
        fiatCurrency: settlement.user_sends_asset,
        pricePerUnit: offer.price || offer.pricePerUnit,
        paymentMethod: "InternalUSD",
        escrowCryptoAmount: settlement.user_receives_amount,
        escrowReleased: false,
        
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const trade = await this.p2pTradeService.create(tradeData);

      // 9. Transfer user tokens to admin and create escrow record
      try {
        // Ensure wallets exist and get actual admin email (in case system email was resolved)
        await this.ensureWalletExists(email.toLowerCase(), settlement.user_sends_asset);
        const actualAdminEmail = await this.ensureWalletExists(offer.creatorEmail.toLowerCase(), settlement.user_sends_asset);

        // 1. Debit user sends asset from user (with balance check)
        const debitUserResult: any = await this.userService.updatePart(
          {
            email: email.toLowerCase(),
            "userWallets.coinSymbol": settlement.user_sends_asset,
            "userWallets.$.coinBalance": { $gte: settlement.user_sends_amount }
          },
          {
            $inc: { "userWallets.$.coinBalance": -settlement.user_sends_amount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() }
          }
        );

        if (!debitUserResult || (debitUserResult.matchedCount ?? debitUserResult.nMatched ?? 0) === 0) {
          throw new Error(`Insufficient ${settlement.user_sends_asset} balance`);
        }

        // 2. Credit admin wallet with user sends asset (user tokens transferred to admin)
        await this.userService.updatePart(
          {
            email: actualAdminEmail.toLowerCase(),
            "userWallets.coinSymbol": settlement.user_sends_asset
          },
          {
            $inc: { "userWallets.$.coinBalance": settlement.user_sends_amount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() }
          }
        );

        // 3. Create escrow record with status ACTIVE
        const escrowId = `ESCROW_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const escrowData: any = {
          escrowId,
          offerId: offer.offerId,
          tradeId,
          userEmail: email.toLowerCase(),
          adminEmail: actualAdminEmail.toLowerCase(),
          user_sends_asset: settlement.user_sends_asset,
          user_sends_amount: settlement.user_sends_amount,
          user_receives_asset: settlement.user_receives_asset,
          user_receives_amount: settlement.user_receives_amount,
          status: EscrowStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.p2pEscrowService.create(escrowData);

        // 4. Keep trade status as PENDING (waiting for admin approval)
        // Trade status is already set to PENDING in tradeData above

        // 5. Return 201 DTO indicating escrow created and waiting for admin approval
        return res.status(201).json({
          status: 201,
          message: "Trade created. Waiting for admin approval.",
          trade_id: tradeId,
          tradeId: tradeId,
          id: tradeId,
          escrowId: escrowId,
          tradeStatus: "PENDING",
          escrowStatus: "ACTIVE",
          user_sends: {
            asset: settlement.user_sends_asset,
            amount: settlement.user_sends_amount
          },
          user_receives: {
            asset: settlement.user_receives_asset,
            amount: settlement.user_receives_amount
          },
          offer_snapshot: {
            id: offer.offerId,
            offerId: offer.offerId,
            name: offer.terms || "",
            side_admin,
            tokens: {
              token_to_buy,
              token_taken_from_user
            },
            price: offer.price || offer.pricePerUnit
          },
          data: {
            tradeId: tradeId,
            trade_id: tradeId,
            tradeStatus: "PENDING",
            escrowId: escrowId,
            escrowStatus: "ACTIVE"
          }
        });

      } catch (error: any) {
        // Rollback: mark trade as cancelled
        await this.p2pTradeService.updatePart(
          { tradeId },
          { $set: { status: P2PTradeStatus.Cancelled, updatedAt: new Date() } }
        );
        return res.status(400).json({ 
          message: "Failed to create trade and escrow", 
          error: error.message 
        });
      }

    } catch (error: any) {
      console.error("Error in joinOfferWithAsset:", error);
      return res.status(500).json({ 
        message: "Failed to join offer", 
        error: error.message 
      });
    }
  }

  /**
   * User: Join another user's offer with ASSET_WALLET settlement (instant P2P transfer)
   * POST /user/offers/:offerId/join-asset
   * 
   * When a user joins another user's offer:
   * - Takes joining user's asset wallet token (what they're sending)
   * - Sends it to the offer creator
   * - Sends the offer creator's token to the joining user
   * - Completes trade immediately (no pending status)
   */
  async userJoinOfferWithAsset(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      // Extract email from JWT token (required for user endpoints)
      const claims = this.getclaims();
      const joiningUserEmail = claims?.email || req.user?.email;
      
      if (!joiningUserEmail) {
        return res.status(401).json({ 
          status: 401,
          message: "Authentication required. Please provide a valid JWT token." 
        });
      }

      const { offerId } = req.params;
      const amount_wants = req.body.amount_wants || req.body.amount;

      // Validation
      if (!amount_wants || amount_wants <= 0) {
        return res.status(400).json({ 
          message: "amount_wants (or amount) must be > 0",
          received: { amount_wants: req.body.amount_wants, amount: req.body.amount }
        });
      }

      // 1. Load offer
      const offer = await this.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // 2. Verify this is a user offer (not admin offer)
      // User offers should have settlement = INTERNAL_USD
      const normalizedSettlement = String(offer.settlement || "").toUpperCase();
      const isInternalUSD = normalizedSettlement === "INTERNAL_USD" || 
                           normalizedSettlement === "ASSET WALLET" || 
                           normalizedSettlement === "ASSET_WALLET" ||
                           offer.settlement === P2PSettlementType.INTERNAL_USD;

      if (!isInternalUSD) {
        return res.status(400).json({ 
          message: "This endpoint is for user-to-user offers with ASSET_WALLET settlement only",
          offer_settlement: offer.settlement 
        });
      }

      // 3. Prevent user from joining their own offer
      if (offer.creatorEmail?.toLowerCase() === joiningUserEmail.toLowerCase()) {
        return res.status(400).json({ 
          message: "You cannot join your own offer" 
        });
      }

      // 4. Validate offer is active
      if (offer.status !== P2POfferStatus.Active) {
        return res.status(400).json({ message: "Offer is not active" });
      }

      // 5. Validate amount in [min,max]
      if (amount_wants < offer.minAmount || amount_wants > offer.maxAmount) {
        return res.status(400).json({ 
          message: `Amount must be between ${offer.minAmount} and ${offer.maxAmount}`,
          received: amount_wants,
          min: offer.minAmount,
          max: offer.maxAmount
        });
      }

      // 6. Map offer fields - from user's perspective (not admin)
      // For user offers: baseToken = what user will RECEIVE, quoteToken = what user will SEND
      const offerCreatorReceives = offer.quoteToken || offer.fiatCurrency; // What joining user sends
      const offerCreatorSends = offer.baseToken || offer.cryptoCurrency;   // What joining user receives
      const price = offer.price || offer.pricePerUnit;

      // Calculate amounts
      // Joining user sends: quoteToken (amount_wants)
      // Joining user receives: baseToken (amount_wants * price)
      const joiningUserSendsAsset = offerCreatorReceives;
      const joiningUserReceivesAsset = offerCreatorSends;
      const joiningUserSendsAmount = amount_wants;
      const joiningUserReceivesAmount = amount_wants * price;

      // 7. Validate tokens exist
      await this.assertTokensExist(joiningUserSendsAsset, joiningUserReceivesAsset);

      // 8. Check joining user has sufficient balance
      const joiningUser = await this.userService.findOne({ email: joiningUserEmail.toLowerCase() });
      if (!joiningUser) {
        return res.status(404).json({ 
          message: "Joining user not found",
          email: joiningUserEmail.toLowerCase()
        });
      }

      const joiningUserWallet = joiningUser?.userWallets?.find((w: any) => 
        w.coinSymbol === joiningUserSendsAsset
      );

      if (!joiningUserWallet || joiningUserWallet.coinBalance < joiningUserSendsAmount) {
        return res.status(400).json({ 
          message: `Insufficient ${joiningUserSendsAsset} balance`,
          required: joiningUserSendsAmount,
          available: joiningUserWallet?.coinBalance || 0
        });
      }

      // 9. Check offer creator has sufficient balance
      const offerCreator = await this.userService.findOne({ email: offer.creatorEmail.toLowerCase() });
      if (!offerCreator) {
        return res.status(404).json({ 
          message: "Offer creator not found",
          email: offer.creatorEmail
        });
      }

      const offerCreatorWallet = offerCreator?.userWallets?.find((w: any) => 
        w.coinSymbol === joiningUserReceivesAsset
      );

      if (!offerCreatorWallet || offerCreatorWallet.coinBalance < joiningUserReceivesAmount) {
        return res.status(400).json({ 
          message: `Offer creator has insufficient ${joiningUserReceivesAsset} balance`,
          required: joiningUserReceivesAmount,
          available: offerCreatorWallet?.coinBalance || 0
        });
      }

      // 10. Ensure wallets exist
      await this.ensureWalletExists(joiningUserEmail.toLowerCase(), joiningUserSendsAsset);
      await this.ensureWalletExists(joiningUserEmail.toLowerCase(), joiningUserReceivesAsset);
      await this.ensureWalletExists(offer.creatorEmail.toLowerCase(), joiningUserSendsAsset);
      await this.ensureWalletExists(offer.creatorEmail.toLowerCase(), joiningUserReceivesAsset);

      // 11. Generate trade ID
      const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 12. Perform atomic transfers
      try {
        // Transfer 1: Joining user sends token to offer creator
        const debitJoiningUser: any = await this.userService.updatePart(
          {
            email: joiningUserEmail.toLowerCase(),
            "userWallets.coinSymbol": joiningUserSendsAsset,
            "userWallets.$.coinBalance": { $gte: joiningUserSendsAmount }
          },
          {
            $inc: { "userWallets.$.coinBalance": -joiningUserSendsAmount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() }
          }
        );

        if (!debitJoiningUser || (debitJoiningUser.matchedCount ?? debitJoiningUser.nMatched ?? 0) === 0) {
          throw new Error(`Insufficient ${joiningUserSendsAsset} balance`);
        }

        // Credit offer creator with joining user's token
        await this.userService.updatePart(
          {
            email: offer.creatorEmail.toLowerCase(),
            "userWallets.coinSymbol": joiningUserSendsAsset
          },
          {
            $inc: { "userWallets.$.coinBalance": joiningUserSendsAmount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() }
          }
        );

        // Transfer 2: Offer creator sends token to joining user
        const debitOfferCreator: any = await this.userService.updatePart(
          {
            email: offer.creatorEmail.toLowerCase(),
            "userWallets.coinSymbol": joiningUserReceivesAsset,
            "userWallets.$.coinBalance": { $gte: joiningUserReceivesAmount }
          },
          {
            $inc: { "userWallets.$.coinBalance": -joiningUserReceivesAmount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() }
          }
        );

        if (!debitOfferCreator || (debitOfferCreator.matchedCount ?? debitOfferCreator.nMatched ?? 0) === 0) {
          // Rollback: return token to joining user
          await this.userService.updatePart(
            {
              email: joiningUserEmail.toLowerCase(),
              "userWallets.coinSymbol": joiningUserSendsAsset
            },
            {
              $inc: { "userWallets.$.coinBalance": joiningUserSendsAmount },
              $set: { "userWallets.$.coinLastUsedOn": new Date() }
            }
          );
          await this.userService.updatePart(
            {
              email: offer.creatorEmail.toLowerCase(),
              "userWallets.coinSymbol": joiningUserSendsAsset
            },
            {
              $inc: { "userWallets.$.coinBalance": -joiningUserSendsAmount },
              $set: { "userWallets.$.coinLastUsedOn": new Date() }
            }
          );
          throw new Error(`Offer creator has insufficient ${joiningUserReceivesAsset} balance`);
        }

        // Credit joining user with offer creator's token
        await this.userService.updatePart(
          {
            email: joiningUserEmail.toLowerCase(),
            "userWallets.coinSymbol": joiningUserReceivesAsset
          },
          {
            $inc: { "userWallets.$.coinBalance": joiningUserReceivesAmount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() }
          }
        );

        // 13. Create completed trade
        const tradeData: any = {
          tradeId,
          offerId: offer.offerId,
          buyerEmail: joiningUserEmail.toLowerCase(),
          sellerEmail: offer.creatorEmail.toLowerCase(),
          offerType: offer.offerType,
          
          // Settlement fields
          amount_wants,
          user_sends_asset: joiningUserSendsAsset,
          user_receives_asset: joiningUserReceivesAsset,
          user_sends_amount: joiningUserSendsAmount,
          user_receives_amount: joiningUserReceivesAmount,
          settlement_type: "ASSET_WALLET",
          status: P2PTradeStatus.Completed, // Completed immediately for user-to-user trades
          
          // Legacy fields
          side: offer.side,
          settlement: "ASSET_WALLET",
          assetSymbol: joiningUserReceivesAsset,
          returnToken: joiningUserSendsAsset,
          unitPrice: price,
          cryptoAmount: joiningUserReceivesAmount,
          cryptoCurrency: joiningUserReceivesAsset,
          fiatAmount: joiningUserSendsAmount,
          fiatCurrency: joiningUserSendsAsset,
          pricePerUnit: price,
          paymentMethod: "InternalUSD",
          escrowCryptoAmount: joiningUserReceivesAmount,
          escrowReleased: true, // No escrow needed for instant transfers
          completedAt: new Date(),
          
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const trade = await this.p2pTradeService.create(tradeData);

        // 14. Update offer availability
        const newAvailableAmount = Math.max(0, offer.availableAmount - amount_wants);
        await this.p2pOfferService.updatePart(
          { offerId: offer.offerId },
          { 
            $set: { 
              availableAmount: newAvailableAmount,
              updatedAt: new Date()
            }
          }
        );

        // 15. If available amount is 0, mark offer as closed
        if (newAvailableAmount <= 0) {
          await this.p2pOfferService.updatePart(
            { offerId: offer.offerId },
            { 
              $set: { 
                status: P2POfferStatus.Cancelled,
                updatedAt: new Date()
              }
            }
          );
        }

        // 16. Return success response
        return res.status(201).json({
          status: 201,
          message: "Trade completed successfully. Tokens transferred between users.",
          trade_id: tradeId,
          tradeId: tradeId,
          id: tradeId,
          tradeStatus: "COMPLETED",
          user_sends: {
            asset: joiningUserSendsAsset,
            amount: joiningUserSendsAmount
          },
          user_receives: {
            asset: joiningUserReceivesAsset,
            amount: joiningUserReceivesAmount
          },
          offer_snapshot: {
            id: offer.offerId,
            offerId: offer.offerId,
            creatorEmail: offer.creatorEmail,
            side: offer.side,
            tokens: {
              baseToken: offer.baseToken,
              quoteToken: offer.quoteToken
            },
            price: price
          },
          data: {
            tradeId: tradeId,
            trade_id: tradeId,
            tradeStatus: "COMPLETED",
            completedAt: trade.completedAt
          }
        });

      } catch (error: any) {
        console.error("Error in userJoinOfferWithAsset transfer:", error);
        return res.status(400).json({ 
          message: "Failed to complete trade", 
          error: error.message 
        });
      }

    } catch (error: any) {
      console.error("Error in userJoinOfferWithAsset:", error);
      return res.status(500).json({ 
        message: "Failed to join offer", 
        error: error.message 
      });
    }
  }

  /**
   * Join offer with GATEWAY settlement (create payment session)
   * POST /p2p/offers/:offerId/join-gateway
   * 
   * Business rules:
   * - side_admin="BUY": admin WANTS token_to_buy, admin GIVES counter asset
   *   → user_sends_asset = token_to_buy, user_receives_asset = counter asset
   * - side_admin="SELL": admin GIVES token_to_buy, admin WANTS token_taken_from_user
   *   → user_sends_asset = token_taken_from_user, user_receives_asset = token_to_buy
   */
  async joinOfferWithGateway(req: any, res: any) {
    try {
      // Ensure MongoDB connection is ready
      const isConnected = await ensureMongoConnected();
      if (!isConnected) {
        return res.status(503).json({ 
          message: "Database connection not ready. Please try again in a moment.",
          error: "MongoDB connection not established"
        });
      }

      // Use base class userId getter which properly extracts email from JWT
      // BaseAPIOperations handles JWT decoding from Authorization header
      const email = req.body.email || req.user?.email || this.userId;

      const { offerId } = req.params;
      // Support both "amount_wants" and "amount" field names
      const amount_wants = req.body.amount_wants || req.body.amount;
      // Support both "gateway_name" and "paymentMethod" field names
      const gateway_name = req.body.gateway_name || req.body.paymentMethod;
      const { idempotency_key } = req.body;

      // Validation
      if (!amount_wants || amount_wants <= 0) {
        return res.status(400).json({ 
          message: "amount_wants (or amount) must be > 0",
          received: { amount_wants: req.body.amount_wants, amount: req.body.amount },
          body: req.body
        });
      }

      if (!gateway_name) {
        return res.status(400).json({ 
          message: "gateway_name (or paymentMethod) is required",
          received: { gateway_name: req.body.gateway_name, paymentMethod: req.body.paymentMethod }
        });
      }

      if (!email) {
        return res.status(401).json({ message: "Authentication required - email not found in token or body" });
      }

      // 1. Load offer
      const offer = await this.p2pOfferService.findOne({ offerId });
      if (!offer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Map offer fields to required schema
      const side_admin = offer.side || (offer.offerType === "Buy" ? "BUY" : "SELL");
      const token_to_buy = offer.assetSymbol || offer.baseToken || offer.cryptoCurrency;
      const token_taken_from_user = offer.returnToken || offer.quoteToken || offer.fiatCurrency;
      
      // Normalize settlement for comparison (handle both enum and string values)
      const normalizedSettlement = String(offer.settlement || "").toUpperCase();
      const isInternalUSD = normalizedSettlement === "INTERNAL_USD" || 
                           normalizedSettlement === "ASSET WALLET" || 
                           normalizedSettlement === "ASSET_WALLET" ||
                           offer.settlement === P2PSettlementType.INTERNAL_USD;
      const isRealFiat = normalizedSettlement === "REAL_FIAT" || 
                         normalizedSettlement === "GATEWAY" ||
                         offer.settlement === P2PSettlementType.REAL_FIAT;
      
      const payment_method_type = isInternalUSD ? "ASSET_WALLET" : 
                                   isRealFiat ? "GATEWAY" : 
                                   side_admin === "BUY" ? "ASSET_WALLET" : "GATEWAY";

      // 2. Validate offer.payment_method_type === "GATEWAY" and active
      if (payment_method_type !== "GATEWAY") {
        // Check if user is trying to use InternalUSD - that's an ASSET_WALLET method
        const isGatewayNameInternalUSD = gateway_name && (
          gateway_name.toLowerCase().includes("internal") || 
          gateway_name.toLowerCase() === "internalusd" ||
          gateway_name.toLowerCase() === "internal_usd"
        );
        
        const suggestion = isGatewayNameInternalUSD || payment_method_type === "ASSET_WALLET"
          ? "Use /join-asset endpoint instead for ASSET_WALLET settlement"
          : `This offer uses ${payment_method_type} settlement. Use /join-asset for ASSET_WALLET or /join-gateway for GATEWAY.`;
        
        return res.status(400).json({ 
          message: "This endpoint requires GATEWAY settlement",
          offer_payment_method_type: payment_method_type,
          suggestion: suggestion,
          correct_endpoint: payment_method_type === "ASSET_WALLET" ? `/p2p/offers/${offerId}/join-asset` : undefined
        });
      }

      if (offer.status !== P2POfferStatus.Active) {
        return res.status(400).json({ message: "Offer is not active" });
      }

      // 3. Validate amount in [min,max] and gateway_name ∈ offer.payment_methods
      if (amount_wants < offer.minAmount || amount_wants > offer.maxAmount) {
        return res.status(400).json({ 
          message: `Amount must be between ${offer.minAmount} and ${offer.maxAmount}`,
          received: amount_wants,
          min: offer.minAmount,
          max: offer.maxAmount
        });
      }

      const payment_methods = offer.paymentMethods || offer.acceptedPaymentMethods || [];
      const normalizedMethods = payment_methods.map((m: any) => 
        typeof m === 'string' ? m.toUpperCase() : (m.toString?.() || String(m)).toUpperCase()
      );
      const normalizedGateway = gateway_name.toUpperCase();

      if (!normalizedMethods.includes(normalizedGateway) && !payment_methods.includes(gateway_name)) {
        return res.status(400).json({ 
          message: `Gateway ${gateway_name} not accepted. Accepted: ${payment_methods.join(", ")}` 
        });
      }

      // 4. Derive user_sends/receives (same logic as join-asset)
      const settlement = this.deriveSettlementForOffer({
        side_admin,
        token_to_buy,
        token_taken_from_user,
        price: offer.price || offer.pricePerUnit
      }, amount_wants);

      // 5. Validate tokens exist
      await this.assertTokensExist(settlement.user_sends_asset, settlement.user_receives_asset);

      // 6. Generate trade ID
      const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 7. Create Trade with settlement_type="GATEWAY", status="PENDING_PAYMENT"
      const tradeData: any = {
        tradeId,
        offerId: offer.offerId,
        buyerEmail: email.toLowerCase(),
        sellerEmail: offer.creatorEmail,
        offerType: offer.offerType,
        
        // Settlement fields per spec
        amount_wants,
        user_sends_asset: settlement.user_sends_asset,
        user_receives_asset: settlement.user_receives_asset,
        user_sends_amount: settlement.user_sends_amount,
        user_receives_amount: settlement.user_receives_amount,
        settlement_type: "GATEWAY",
        gateway_name,
        status: P2PTradeStatus.Pending, // PENDING_PAYMENT - will be updated on webhook
        
        // Legacy fields for compatibility
        side: offer.side,
        settlement: "GATEWAY",
        assetSymbol: settlement.user_receives_asset,
        returnToken: settlement.user_sends_asset,
        unitPrice: offer.price || offer.pricePerUnit,
        cryptoAmount: settlement.user_receives_amount,
        cryptoCurrency: settlement.user_receives_asset,
        fiatAmount: settlement.user_sends_amount,
        fiatCurrency: settlement.user_sends_asset,
        pricePerUnit: offer.price || offer.pricePerUnit,
        paymentMethod: gateway_name,
        escrowCryptoAmount: settlement.user_receives_amount,
        escrowReleased: false,
        
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const trade = await this.p2pTradeService.create(tradeData);

      // 8. Call paymentsService.createSession (placeholder - integrate with actual service)
      let sessionResult: any;
      try {
        // TODO: Replace with actual paymentsService.createSession call
        // sessionResult = await paymentsService.createSession({
        //   gateway: gateway_name,
        //   payer_user_id: email,
        //   payee: "admin",
        //   amount: settlement.user_sends_amount,
        //   currency: settlement.user_sends_asset,
        //   meta: { trade_id: tradeId, offer_id: offerId }
        // });
        
        // Placeholder implementation
      const session_id = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pay_url = `https://gateway.pay/${session_id}`;
        sessionResult = { session_id, pay_url };
      } catch (error: any) {
        await this.p2pTradeService.updatePart(
          { tradeId },
          { $set: { status: P2PTradeStatus.Cancelled, updatedAt: new Date() } }
        );
        return res.status(500).json({ 
          message: "Failed to create payment session", 
          error: error.message 
        });
      }

      // 9. Save gateway_session_id on Trade
      await this.p2pTradeService.updatePart(
        { tradeId },
        { $set: { gateway_session_id: sessionResult.session_id, updatedAt: new Date() } }
      );

      // 10. Return 201 DTO
      return res.status(201).json({
        status: 201,
        message: "Payment session created successfully",
        trade_id: tradeId,
        tradeId: tradeId, // Also include camelCase for frontend compatibility
        id: tradeId,      // Also include as 'id' for maximum compatibility
        tradeStatus: "PENDING_PAYMENT",
        pay: {
          gateway: gateway_name,
          session_id: sessionResult.session_id,
          url: sessionResult.pay_url
        },
        user_sends: {
          asset: settlement.user_sends_asset,
          amount: settlement.user_sends_amount
        },
        user_receives: {
          asset: settlement.user_receives_asset,
          amount: settlement.user_receives_amount
        },
        offer_snapshot: {
          id: offer.offerId,
          offerId: offer.offerId, // Also include camelCase
          name: offer.terms || "",
          side_admin,
          tokens: {
            token_to_buy,
            token_taken_from_user
          },
          price: offer.price || offer.pricePerUnit
        },
        data: {
          tradeId: tradeId,
          trade_id: tradeId,
          tradeStatus: "PENDING_PAYMENT"
        }
      });

    } catch (error: any) {
      console.error("Error in joinOfferWithGateway:", error);
      return res.status(500).json({ 
        message: "Failed to create payment session", 
        error: error.message 
      });
    }
  }

  /**
   * Helper: Derive settlement details from offer fields and amount_wants
   * Per spec:
   * - side_admin="BUY": user_sends_asset = token_to_buy, user_receives_asset = counter asset
   * - side_admin="SELL": user_sends_asset = token_taken_from_user, user_receives_asset = token_to_buy
   */
  private deriveSettlementForOffer(
    offerFields: { side_admin: string; token_to_buy: string; token_taken_from_user: string; price: number },
    amount_wants: number
  ) {
    const { side_admin, token_to_buy, token_taken_from_user, price } = offerFields;

    let user_sends_asset: string;
    let user_receives_asset: string;
    let user_sends_amount: number;
    let user_receives_amount: number;

    if (side_admin === "BUY") {
      // Admin BUY: admin WANTS token_to_buy, admin GIVES counter asset (token_taken_from_user)
      // User sends what admin wants (token_to_buy), receives what admin gives (token_taken_from_user)
      user_sends_asset = token_to_buy;
      user_receives_asset = token_taken_from_user;
      user_sends_amount = amount_wants;
      user_receives_amount = amount_wants * price;
    } else {
      // SELL: admin GIVES token_to_buy, admin WANTS token_taken_from_user
      // User sends what admin wants (token_taken_from_user), receives what admin gives (token_to_buy)
      user_sends_asset = token_taken_from_user;
      user_receives_asset = token_to_buy;
      user_sends_amount = amount_wants;
      user_receives_amount = amount_wants * price;
    }

    return {
      user_sends_asset,
      user_receives_asset,
      user_sends_amount,
      user_receives_amount
    };
  }

  /**
   * Helper: Assert tokens exist in tokens catalog
   */
  private async assertTokensExist(token1: string, token2: string): Promise<void> {
    // Basic validation - tokens should be non-empty strings
    if (!token1 || !token2 || typeof token1 !== 'string' || typeof token2 !== 'string') {
      throw new Error(`Invalid tokens: ${token1}, ${token2}`);
    }
    // TODO: Add actual token catalog check if available
    // const validTokens = await tokenCatalogService.getSupportedTokens();
    // if (!validTokens.includes(token1) || !validTokens.includes(token2)) {
    //   throw new Error(`Tokens not supported: ${token1}, ${token2}`);
    // }
  }

  /**
   * Helper: Ensure wallet exists for user (create if not)
   * Returns the actual email to use (might differ if system email was resolved to an admin)
   */
  private async ensureWalletExists(email: string, symbol: string): Promise<string> {
    // Handle system admin emails - they might not exist as regular users
    const systemEmails = ["admin@indexx.ai", "system@indexx.ai", "support@azooca.com"];
    const isSystemEmail = systemEmails.includes(email.toLowerCase());
    
    let user = await this.userService.findOne({ email: email.toLowerCase() });
    
    // If it's a system email and doesn't exist, try to find an admin user
    if (!user && isSystemEmail) {
      // Try to find any admin user to use their wallet (look for Admin role)
      user = await this.userService.findOne({ role: "Admin" });
      
      // If still no admin found, throw helpful error
      if (!user) {
        throw new Error(
          `Admin user not found for ${email}. ` +
          `Please ensure an admin user exists in the system, or create the offer with an authenticated admin email.`
        );
      }
    }
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    // Use the actual user email (in case we found a different admin)
    const actualEmail = user.email.toLowerCase();
    
    const hasWallet = (user.userWallets || []).some((w: any) => w.coinSymbol === symbol);
    if (!hasWallet) {
      // Create wallet if it doesn't exist
      await this.userService.updatePart(
        { email: actualEmail },
        {
          $push: {
            userWallets: {
              coinSymbol: symbol,
              coinBalance: 0,
              coinLastUsedOn: null
            }
          }
        }
      );
    }
    
    // Return the actual email to use (in case we switched to a different admin)
    return actualEmail;
  }

  /**
   * Webhook settlement handler for GATEWAY payments
   * Called from payments webhook when PAYMENT_SUCCEEDED event received with meta.trade_id
   */
  async settleTradeFromWebhook(tradeId: string, gateway_txn_id?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Load Trade
      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return { success: false, error: "Trade not found" };
      }

      // Ensure status is Pending (PENDING_PAYMENT)
      if (trade.status !== P2PTradeStatus.Pending) {
        return { success: false, error: `Trade not in Pending status. Current: ${trade.status}` };
      }

      // Extract settlement details from trade
      const user_receives_asset = (trade as any).user_receives_asset || trade.cryptoCurrency;
      const user_receives_amount = (trade as any).user_receives_amount || trade.cryptoAmount;
      const userEmail = trade.buyerEmail;
      const adminEmail = trade.sellerEmail;

      // Atomically settle internal transfers
      // 1. Credit user receives asset to user
      await this.ensureWalletExists(userEmail.toLowerCase(), user_receives_asset);
      await this.userService.updatePart(
        {
          email: userEmail.toLowerCase(),
          "userWallets.coinSymbol": user_receives_asset
        },
        {
          $inc: { "userWallets.$.coinBalance": user_receives_amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // 2. Debit admin internal wallet for user receives asset
      await this.ensureWalletExists(adminEmail.toLowerCase(), user_receives_asset);
      await this.userService.updatePart(
        {
          email: adminEmail.toLowerCase(),
          "userWallets.coinSymbol": user_receives_asset
        },
        {
          $inc: { "userWallets.$.coinBalance": -user_receives_amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      // 3. Update Trade.status="COMPLETED" and persist gateway_txn_id
      await this.p2pTradeService.updatePart(
        { tradeId },
        {
          $set: {
            status: P2PTradeStatus.Completed,
            completedAt: new Date(),
            updatedAt: new Date(),
            ...(gateway_txn_id && { gateway_txn_id })
          }
        }
      );

      return { success: true };
    } catch (error: any) {
      console.error("Error settling trade from webhook:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel trade from webhook (PAYMENT_FAILED/CANCELED)
   */
  async cancelTradeFromWebhook(tradeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const trade = await this.p2pTradeService.findOne({ tradeId });
      if (!trade) {
        return { success: false, error: "Trade not found" };
      }

      await this.p2pTradeService.updatePart(
        { tradeId },
        { $set: { status: P2PTradeStatus.Cancelled, updatedAt: new Date() } }
      );

      return { success: true };
    } catch (error: any) {
      console.error("Error canceling trade from webhook:", error);
      return { success: false, error: error.message };
    }
  }

  // ==================== ADMIN APIs ====================

  /**
   * Admin Signup - Create a new admin user for P2P
   */
  async adminSignup(req: any, res: any) {
    try {
      const { email, password, username, firstName, lastName } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ 
          message: "Email and password are required" 
        });
      }

      const emailLower = String(email).toLowerCase();

      // Check if user already exists
      const existingUser = await this.userService.findOne({ email: emailLower });
      if (existingUser) {
        return res.status(400).json({ 
          message: "Admin with this email already exists" 
        });
      }

      // Hash password
      const passwordHash = await this.userService.createPassword(password);

      // Create admin user
      const newAdmin: any = {
        email: emailLower,
        username: username || emailLower.split('@')[0],
        firstName: firstName || "Admin",
        lastName: lastName || "User",
        phone: "",
        walletAddress: "",
        isPhonePublic: false,
        isEmailPublic: false,
        role: UserRoleTypes.Admin,
        authProviders: [{ 
          provider: AuthProviders.Local,
          phash: passwordHash.hash,
          psalt: passwordHash.salt
        }],
        verification: {
          activated: true,
          activatedOn: new Date(),
          emailVerified: true,
          emailVerifiedOn: new Date(),
          emailCode: "",
          emailCodeExpiry: new Date(),
          phoneVerified: false,
          phoneVerifiedOn: new Date(),
          phoneCode: "",
          phoneCodeExpiry: new Date(),
          photoVerified: false,
          photoVerifiedOn: new Date(),
          addressVerified: false,
          addressVerifiedOn: new Date(),
          currencyUpdated: false,
          currencyUpdatedOn: new Date()
        },
        baseCurrency: Currency.USD,
        language: Languages.US,
        userType: "Centralized",
        userWallets: [],
        freeTrailUserWallets: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdAdmin = await this.userService.create(newAdmin);

      return res.status(201).json({
        message: "Admin created successfully",
        admin: {
          email: createdAdmin.email,
          username: createdAdmin.username,
          role: createdAdmin.role
        }
      });

    } catch (error: any) {
      console.error("Error in admin signup:", error);
      return res.status(500).json({ 
        message: "Failed to create admin",
        error: error.message 
      });
    }
  }

  /**
   * Admin Login - Authenticate admin and return JWT token
   */
  async adminLogin(req: any, res: any) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          message: "Email and password are required" 
        });
      }

      const emailLower = String(email).toLowerCase();

      // Find admin user
      const admin = await this.userService.findOne({ email: emailLower });
      
      if (!admin) {
        return res.status(401).json({ 
          message: "Invalid email or password" 
        });
      }

      // Check if user is admin
      if (admin.role !== UserRoleTypes.Admin && admin.role !== UserRoleTypes.SuperAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required." 
        });
      }

      // Find local auth provider
      const localAuthProvider = admin.authProviders?.find(
        (p: any) => p.provider === AuthProviders.Local
      );

      if (!localAuthProvider || !localAuthProvider.phash) {
        return res.status(401).json({ 
          message: "No local authentication found. Please set a password." 
        });
      }

      // Verify password
      const isMatch = await this.userService.comparePassword(
        password,
        localAuthProvider.phash
      );

      if (!isMatch) {
        return res.status(401).json({ 
          message: "Invalid email or password" 
        });
      }

      // Generate JWT token
      const jwtAuthUtil = new JwtAuthUtil();
      const tokenResponse = await jwtAuthUtil.issueToken(admin);

      // Update last login
      await this.userService.updatePart(
        { email: emailLower },
        { $set: { lastLogin: new Date() } }
      );

      return res.status(200).json({
        message: "Login successful",
        ...tokenResponse
      });

    } catch (error: any) {
      console.error("Error in admin login:", error);
      return res.status(500).json({ 
        message: "Login failed",
        error: error.message 
      });
    }
  }

  /**
   * Create Admin Asset Wallet - Create a simple asset wallet for admin (no blockchain)
   */
  async createAdminAssetWallet(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email || this.userId;
      const { symbol } = req.body;

      if (!symbol) {
        return res.status(400).json({ 
          message: "Symbol (currency code) is required" 
        });
      }

      if (!email) {
        return res.status(401).json({ 
          message: "Authentication required" 
        });
      }

      const emailLower = email.toLowerCase();

      // Verify user is admin
      const user = await this.userService.findOne({ email: emailLower });
      if (!user) {
        return res.status(404).json({ 
          message: "User not found" 
        });
      }

      if (user.role !== UserRoleTypes.Admin && user.role !== UserRoleTypes.SuperAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required." 
        });
      }

      // Check if wallet already exists
      const hasWallet = (user.userWallets || []).some(
        (w: any) => w.coinSymbol === symbol.toUpperCase()
      );

      if (hasWallet) {
        return res.status(400).json({ 
          message: `Wallet for ${symbol} already exists` 
        });
      }

      // Create asset wallet (simple balance tracking, no blockchain)
      await this.userService.updatePart(
        { email: emailLower },
        {
          $push: {
            userWallets: {
              coinSymbol: symbol.toUpperCase(),
              coinBalance: 0,
              coinBalanceInUSD: 0,
              coinBalanceInBTC: 0,
              coinLastUsedOn: new Date(),
              coinCreatedOn: new Date(),
              isCoinActive: true
            }
          }
        }
      );

      return res.status(201).json({
        message: `Asset wallet for ${symbol} created successfully`,
        symbol: symbol.toUpperCase(),
        balance: 0
      });

    } catch (error: any) {
      console.error("Error creating admin wallet:", error);
      return res.status(500).json({ 
        message: "Failed to create wallet",
        error: error.message 
      });
    }
  }

  /**
   * Fund Admin Asset Wallet - Add balance to admin's asset wallet
   */
  async fundAdminAssetWallet(req: any, res: any) {
    try {
      const email = req.body.email || req.user?.email || this.userId;
      const { symbol, amount } = req.body;

      if (!symbol || !amount) {
        return res.status(400).json({ 
          message: "Symbol and amount are required" 
        });
      }

      if (amount <= 0) {
        return res.status(400).json({ 
          message: "Amount must be greater than 0" 
        });
      }

      if (!email) {
        return res.status(401).json({ 
          message: "Authentication required" 
        });
      }

      const emailLower = email.toLowerCase();

      // Verify user is admin
      const user = await this.userService.findOne({ email: emailLower });
      if (!user) {
        return res.status(404).json({ 
          message: "User not found" 
        });
      }

      if (user.role !== UserRoleTypes.Admin && user.role !== UserRoleTypes.SuperAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required." 
        });
      }

      // Check if wallet exists, create if not
      const symbolUpper = symbol.toUpperCase();
      const hasWallet = (user.userWallets || []).some(
        (w: any) => w.coinSymbol === symbolUpper
      );

      if (!hasWallet) {
        // Create wallet first
        await this.userService.updatePart(
          { email: emailLower },
          {
            $push: {
              userWallets: {
                coinSymbol: symbolUpper,
                coinBalance: 0,
                coinBalanceInUSD: 0,
                coinBalanceInBTC: 0,
                coinLastUsedOn: new Date(),
                coinCreatedOn: new Date(),
                isCoinActive: true
              }
            }
          }
        );
      }

      // Add balance
      const updateResult: any = await this.userService.updatePart(
        {
          email: emailLower,
          "userWallets.coinSymbol": symbolUpper
        },
        {
          $inc: { "userWallets.$.coinBalance": amount },
          $set: { "userWallets.$.coinLastUsedOn": new Date() }
        }
      );

      if (!updateResult || (updateResult.matchedCount ?? updateResult.nMatched ?? 0) === 0) {
        return res.status(500).json({ 
          message: "Failed to fund wallet" 
        });
      }

      // Create transaction record
      const transaction = {
        orderId: `FUND_ADMIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        extRef: "",
        txId: "",
        from: "system",
        to: emailLower,
        amount: amount,
        info: `Admin wallet funding - ${amount} ${symbolUpper} added`,
        status: "Completed",
        currencyRef: symbolUpper,
        walletType: "Asset Wallet",
        transactionType: "Deposit",
        exchangeName: "Indexx",
        email: emailLower,
        txDate: new Date(),
        benificaryAddress: ""
      };

      await this.transactionService.create(transaction as any);

      // Get updated balance
      const updatedUser = await this.userService.findOne({ email: emailLower });
      const wallet = updatedUser?.userWallets?.find(
        (w: any) => w.coinSymbol === symbolUpper
      );

      return res.status(200).json({
        message: `Wallet funded successfully`,
        symbol: symbolUpper,
        amount: amount,
        newBalance: wallet?.coinBalance || 0
      });

    } catch (error: any) {
      console.error("Error funding admin wallet:", error);
      return res.status(500).json({ 
        message: "Failed to fund wallet",
        error: error.message 
      });
    }
  }

  /**
   * Get Admin Balance - Get balance for all tokens for admin
   */
  async getAdminBalance(req: any, res: any) {
    try {
      const email = req.query.email || req.body.email || req.user?.email || this.userId;

      if (!email) {
        return res.status(401).json({ 
          message: "Authentication required" 
        });
      }

      const emailLower = email.toLowerCase();

      // Verify user is admin
      const user = await this.userService.findOne({ email: emailLower });
      if (!user) {
        return res.status(404).json({ 
          message: "User not found" 
        });
      }

      if (user.role !== UserRoleTypes.Admin && user.role !== UserRoleTypes.SuperAdmin) {
        return res.status(403).json({ 
          message: "Access denied. Admin role required." 
        });
      }

      // Get all wallets
      const wallets = (user.userWallets || [])
        .filter((w: any) => w.isCoinActive !== false)
        .map((w: any) => ({
          symbol: w.coinSymbol,
          balance: w.coinBalance || 0,
          balanceInUSD: w.coinBalanceInUSD || 0,
          balanceInBTC: w.coinBalanceInBTC || 0,
          lastUsed: w.coinLastUsedOn
        }));

      // Calculate total USD value (if available)
      const totalUSD = wallets.reduce(
        (sum: number, w: any) => sum + (w.balanceInUSD || 0),
        0
      );

      return res.status(200).json({
        email: emailLower,
        totalWallets: wallets.length,
        totalUSDValue: totalUSD,
        wallets: wallets
      });

    } catch (error: any) {
      console.error("Error getting admin balance:", error);
      return res.status(500).json({ 
        message: "Failed to get balance",
        error: error.message 
      });
    }
  }
}
