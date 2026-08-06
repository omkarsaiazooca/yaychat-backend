import { Schema, Document } from "mongoose";
import { IDocumentModel, IModel } from "../data/base";
import { PaymentTypes } from "../data/common";
import { P2PEscrow } from "../data/p2p";

// P2P Offer Status Enum
export enum P2POfferStatus {
  Active = "Active",
  Paused = "Paused", 
  Cancelled = "Cancelled",
  Completed = "Completed",
  Expired = "Expired"
}

// P2P Trade Status Enum
export enum P2PTradeStatus {
  Pending = "Pending",           // Trade created, waiting for payment
  Paid = "Paid",                 // Buyer marked as paid
  Confirmed = "Confirmed",       // Seller confirmed payment
  Completed = "Completed",       // Trade completed successfully
  Cancelled = "Cancelled",       // Trade cancelled
  Disputed = "Disputed",         // Trade under dispute
  Expired = "Expired"           // Trade expired due to timeout
}

// P2P Payment Method Enum
export enum P2PPaymentMethod {
  BankTransfer = "BankTransfer",
  PayPal = "PayPal", 
  Venmo = "Venmo",
  Zelle = "Zelle",
  WireTransfer = "WireTransfer",
  UPI = "UPI",
  GooglePay = "GooglePay",
  ApplePay = "ApplePay",
  CashApp = "CashApp",
  Crypto = "Crypto",
  ACH = "ACH",
  Card = "Card",
  TygaPay = "TygaPay",
  InternalUSD = "InternalUSD"
}

// P2P Offer Side (from admin perspective)
export enum P2POfferSide {
  BUY = "BUY",     // Admin buys token from user
  SELL = "SELL"    // Admin sells token to user
}

// Settlement Type
export enum P2PSettlementType {
  INTERNAL_USD = "INTERNAL_USD",  // Case 1: User receives internal USD
  REAL_FIAT = "REAL_FIAT"         // Case 2: User pays real USD off-platform
}

// Price Type
export enum P2PPriceType {
  FIXED = "FIXED",   // Fixed price per unit
  FLOAT = "FLOAT"    // Price floats with market
}

// P2P Offer Interface
export interface P2POffer extends IModel, IDocumentModel<P2POffer> {
  offerId: string;                    // Unique offer identifier
  creatorEmail: string;               // Email of user who created the offer
  
  // Legacy fields (for backward compatibility)
  offerType: "Buy" | "Sell";          // Whether user wants to buy or sell crypto
  cryptoCurrency: string;             // Legacy field - use assetSymbol instead
  cryptoNetwork?: string;            // Network for crypto (e.g., "Ying Yang Chain", "Ethereum")
  fiatCurrency: string;              // Fiat currency (e.g., "USD", "EUR")
  pricePerUnit: number;              // Legacy field - use price instead
  
  // New fields for any token support
  baseToken?: string;                // Base token (what's being bought/sold by admin)
  quoteToken?: string;               // Quote token (what admin pays/receives)
  assetSymbol: string;               // Token symbol (e.g., "INEX", "BTC", "ETH", "IN500") - ANY supported token
  returnToken: string;               // What token user is giving in return (e.g., "USD", "INEX", "BTC")
  side: P2POfferSide;                // From admin perspective: BUY or SELL
  settlement: P2PSettlementType;      // INTERNAL_USD (Case 1) or REAL_FIAT (Case 2)
  priceType: P2PPriceType;           // FIXED or FLOAT
  price?: number;                    // Price per unit (null when FLOAT)
  
  // Amount constraints
  minAmount: number;                 // Minimum trade amount in fiat
  maxAmount: number;                 // Maximum trade amount in fiat
  availableAmount: number;           // Available amount for trading in fiat
  
  // Payment methods
  paymentMethods: P2PPaymentMethod[]; // Accepted payment methods (legacy)
  acceptedPaymentMethods: string[];   // New field: payment rails accepted (JSON)
  paymentInstructions?: any;          // JSONB for Case 2 payment details
  
  terms: string;                     // Terms and conditions
  status: P2POfferStatus;           // Current offer status
  autoReply?: string;                // Auto-reply message for buyers
  completionRate: number;           // Percentage of completed trades
  totalTrades: number;              // Total number of trades completed
  avgReleaseTime: number;           // Average time to release crypto (in minutes)
  isOnline: boolean;                // Whether creator is currently online
  lastSeen: Date;                   // Last time creator was active
  createdAt: Date;                  // When offer was created
  updatedAt: Date;                  // When offer was last updated
  expiresAt?: Date;                 // When offer expires (optional)
}

// P2P Trade Interface  
export interface P2PTrade extends IModel, IDocumentModel<P2PTrade> {
  tradeId: string;                   // Unique trade identifier
  offerId: string;                   // Reference to the P2P offer
  buyerEmail: string;                // Email of buyer
  sellerEmail: string;               // Email of seller
  offerType: "Buy" | "Sell";        // Type of offer this trade is based on
  
  // Trade amounts
  cryptoAmount: number;              // Amount of crypto being traded
  cryptoCurrency: string;            // Crypto currency
  cryptoNetwork?: string;           // Crypto network
  fiatAmount: number;               // Amount in fiat currency
  fiatCurrency: string;             // Fiat currency
  pricePerUnit: number;             // Price per unit agreed upon
  
  // Payment details
  paymentMethod: P2PPaymentMethod;   // Payment method used
  paymentDetails?: {                 // Payment-specific details
    accountNumber?: string;
    accountName?: string;
    bankName?: string;
    paypalEmail?: string;
    upiId?: string;
    walletAddress?: string;
    [key: string]: any;             // Allow additional payment details
  };
  
  // Trade status and timing
  status: P2PTradeStatus;           // Current trade status
  createdAt: Date;                  // When trade was created
  paidAt?: Date;                    // When buyer marked as paid
  confirmedAt?: Date;               // When seller confirmed payment
  completedAt?: Date;                // When trade was completed
  expiresAt?: Date;                  // When trade expires (optional)
  
  // Escrow details
  escrowCryptoAmount: number;        // Amount held in escrow
  escrowReleased: boolean;          // Whether escrow has been released
  
  // Communication
  buyerMessage?: string;            // Message from buyer
  sellerMessage?: string;           // Message from seller
  disputeReason?: string;           // Reason for dispute if applicable
  
  // Security
  buyerKycVerified: boolean;        // Whether buyer is KYC verified
  sellerKycVerified: boolean;       // Whether seller is KYC verified
}

// P2P Dispute Interface
export interface P2PDispute extends IModel, IDocumentModel<P2PDispute> {
  disputeId: string;                // Unique dispute identifier
  tradeId: string;                  // Reference to the disputed trade
  complainantEmail: string;         // Email of user who raised dispute
  reason: string;                   // Reason for dispute
  description: string;              // Detailed description
  evidence: string[];               // URLs to evidence files/images
  status: "Open" | "Under Review" | "Resolved" | "Rejected";
  resolution?: string;              // Resolution details if resolved
  resolvedBy?: string;              // Admin who resolved the dispute
  resolvedAt?: Date;                // When dispute was resolved
  createdAt: Date;                  // When dispute was created
}

// P2P Rating Interface
export interface P2PRating extends IModel, IDocumentModel<P2PRating> {
  ratingId: string;                 // Unique rating identifier
  tradeId: string;                  // Reference to the completed trade
  raterEmail: string;               // Email of user giving rating
  rateeEmail: string;               // Email of user being rated
  rating: number;                   // Rating from 1-5
  comment?: string;                 // Optional comment
  createdAt: Date;                  // When rating was given
}

// Mongoose Schemas
const p2pOfferSchema = new Schema({
  offerId: { type: String, required: true, unique: true },
  creatorEmail: { type: String, required: true },
  offerType: { type: String, enum: ["Buy", "Sell"], required: true },
  cryptoCurrency: { type: String, required: true },
  cryptoNetwork: { type: String },
  fiatCurrency: { type: String, required: true },
  pricePerUnit: { type: Number, required: true },
  minAmount: { type: Number, required: true },
  maxAmount: { type: Number, required: true },
  availableAmount: { type: Number, required: true },
  paymentMethods: [{ type: String, enum: Object.values(P2PPaymentMethod) }],
  terms: { type: String, default: "" },
  status: { type: String, enum: Object.values(P2POfferStatus), default: P2POfferStatus.Active },
  autoReply: { type: String },
  completionRate: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  avgReleaseTime: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  // New fields for any token support
  baseToken: { type: String },
  quoteToken: { type: String },
  assetSymbol: { type: String },
  returnToken: { type: String },
  side: { type: String, enum: Object.values(P2POfferSide) },
  settlement: { type: String, enum: Object.values(P2PSettlementType) },
  priceType: { type: String, enum: Object.values(P2PPriceType) },
  price: { type: Number },
  acceptedPaymentMethods: [{ type: String }],
  paymentInstructions: { type: Schema.Types.Mixed }
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
});

const p2pTradeSchema = new Schema({
  tradeId: { type: String, required: true, unique: true },
  offerId: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  offerType: { type: String, enum: ["Buy", "Sell"], required: true },
  
  cryptoAmount: { type: Number, required: true },
  cryptoCurrency: { type: String, required: true },
  cryptoNetwork: { type: String },
  fiatAmount: { type: Number, required: true },
  fiatCurrency: { type: String, required: true },
  pricePerUnit: { type: Number, required: true },
  
  paymentMethod: { type: String, enum: Object.values(P2PPaymentMethod), required: true },
  paymentDetails: { type: Schema.Types.Mixed },
  
  status: { type: String, enum: Object.values(P2PTradeStatus), default: P2PTradeStatus.Pending },
  paidAt: { type: Date },
  confirmedAt: { type: Date },
  completedAt: { type: Date },
  expiresAt: { type: Date, required: false },
  
  escrowCryptoAmount: { type: Number, required: true },
  escrowReleased: { type: Boolean, default: false },
  
  buyerMessage: { type: String },
  sellerMessage: { type: String },
  disputeReason: { type: String },
  
  buyerKycVerified: { type: Boolean, default: false },
  sellerKycVerified: { type: Boolean, default: false }
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
});

const p2pDisputeSchema = new Schema({
  disputeId: { type: String, required: true, unique: true },
  tradeId: { type: String, required: true },
  complainantEmail: { type: String, required: true },
  reason: { type: String, required: true },
  description: { type: String, required: true },
  evidence: [{ type: String }],
  status: { type: String, enum: ["Open", "Under Review", "Resolved", "Rejected"], default: "Open" },
  resolution: { type: String },
  resolvedBy: { type: String },
  resolvedAt: { type: Date }
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
});

const p2pRatingSchema = new Schema({
  ratingId: { type: String, required: true, unique: true },
  tradeId: { type: String, required: true },
  raterEmail: { type: String, required: true },
  rateeEmail: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
});

const p2pEscrowSchema = new Schema({
  escrowId: { type: String, required: true, unique: true },
  offerId: { type: String, required: true, index: true }, // Index for efficient queries
  tradeId: { type: String, required: true },
  userEmail: { type: String, required: true, index: true },
  adminEmail: { type: String, required: true },
  
  // Settlement details
  user_sends_asset: { type: String, required: true },
  user_sends_amount: { type: Number, required: true },
  user_receives_asset: { type: String, required: true },
  user_receives_amount: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ["OPEN", "RELEASED", "CANCELLED", "ACTIVE", "APPROVED"],
    default: "ACTIVE",
    required: true 
  },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  
  // Legacy fields
  lockAdminTokenAmount: { type: Number },
  lockAdminTokenSymbol: { type: String },
  lockUserTokenAmount: { type: Number },
  lockUserTokenSymbol: { type: String },
  lockAdminUsd: { type: Number },
  lockUserUsd: { type: Number },
  releasedAt: { type: Date }
}, {
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
});

// Export interfaces and schemas
export interface P2POfferModel extends IDocumentModel<P2POffer>, P2POffer {}
export interface P2PTradeModel extends IDocumentModel<P2PTrade>, P2PTrade {}
export interface P2PDisputeModel extends IDocumentModel<P2PDispute>, P2PDispute {}
export interface P2PRatingModel extends IDocumentModel<P2PRating>, P2PRating {}
export interface P2PEscrowModel extends IDocumentModel<P2PEscrow>, P2PEscrow {}

// Re-export P2PEscrow from data
export { P2PEscrow } from "../data/p2p";
export { p2pOfferSchema, p2pTradeSchema, p2pDisputeSchema, p2pRatingSchema, p2pEscrowSchema };
