import { IModel, IDocumentModel } from "./base";

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
  Crypto = "Crypto"
}

// P2P Offer Interface
export interface P2POffer extends IModel, IDocumentModel<P2POffer> {
  offerId: string;                    // Unique offer identifier
  creatorEmail: string;               // Email of user who created the offer
  offerType: "Buy" | "Sell";          // Whether user wants to buy or sell crypto
  cryptoCurrency: string;             // Crypto currency being traded (e.g., "BTCY", "INEX")
  cryptoNetwork?: string;            // Network for crypto (e.g., "Ying Yang Chain", "Ethereum")
  fiatCurrency: string;              // Fiat currency (e.g., "USD", "EUR")
  pricePerUnit: number;              // Price per unit of crypto in fiat
  minAmount: number;                 // Minimum trade amount in fiat
  maxAmount: number;                 // Maximum trade amount in fiat
  availableAmount: number;           // Available amount for trading in fiat
  paymentMethods: P2PPaymentMethod[]; // Accepted payment methods
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
  expiresAt?: Date;                  // When trade expires (undefined = no expiration)
  
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
