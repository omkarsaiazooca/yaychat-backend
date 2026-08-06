import { IModel, IDocumentModel } from "./base";

// P2P Offer Status Enum
export enum P2POfferStatus {
  DRAFT = "DRAFT",              // Draft status
  Active = "Active",
  Paused = "Paused", 
  Cancelled = "Cancelled",
  Completed = "Completed",
  Expired = "Expired",
  ENDED = "ENDED"              // Offer ended
}

// Escrow Status
export enum EscrowStatus {
  OPEN = "OPEN",                // Escrow locked
  RELEASED = "RELEASED",        // Escrow released
  CANCELLED = "CANCELLED",      // Escrow cancelled
  ACTIVE = "ACTIVE",            // Escrow active (waiting for admin approval)
  APPROVED = "APPROVED"         // Escrow approved by admin
}

// Payment Intent Status
export enum PaymentIntentStatus {
  CREATED = "CREATED",          // Intent created
  PENDING = "PENDING",          // Waiting for payment
  SETTLED = "SETTLED",          // Payment successful
  FAILED = "FAILED",            // Payment failed
  CANCELLED = "CANCELLED"       // Intent cancelled
}

// P2P Trade Status Enum (Legacy)
export enum P2PTradeStatus {
  Pending = "Pending",           // Trade created, waiting for payment
  Paid = "Paid",                 // Buyer marked as paid
  Confirmed = "Confirmed",       // Seller confirmed payment
  Completed = "Completed",       // Trade completed successfully
  Cancelled = "Cancelled",       // Trade cancelled
  Disputed = "Disputed",         // Trade under dispute
  Expired = "Expired"           // Trade expired due to timeout
}

// P2P Trade State Machine (New)
export enum P2PTradeState {
  DRAFT = "DRAFT",               // Initial state
  ACTIVE = "ACTIVE",             // Offer published
  MATCHED = "MATCHED",           // User joined offer
  FUNDING = "FUNDING",           // Waiting for payment (internal or external)
  PAID = "PAID",                 // Payment verified
  RELEASED = "RELEASED",         // Escrow released, trade complete
  CANCELLED = "CANCELLED",       // Trade cancelled
  DISPUTED = "DISPUTED",         // Trade disputed
  RESOLVED = "RESOLVED"          // Dispute resolved
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
  InternalUSD = "InternalUSD"  // For Case 1 settlement
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
  baseToken: string;                 // Base token (what's being bought/sold by admin)
  quoteToken: string;                // Quote token (what admin pays/receives)
  side: P2POfferSide;                // From admin perspective: BUY or SELL
  settlement: P2PSettlementType;      // INTERNAL_USD (Case 1) or REAL_FIAT (Case 2)
  priceType: P2PPriceType;           // FIXED or FLOAT
  price?: number;                    // Price per unit (null when FLOAT)
  
  // For backward compatibility (auto-populated from baseToken/quoteToken)
  assetSymbol: string;               // Token symbol (legacy)
  returnToken: string;               // What token user is giving (legacy)
  
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
  offerType: "Buy" | "Sell";        // Legacy field - use side instead
  
  // New fields
  assetSymbol: string;              // Token symbol being traded (receiving)
  returnToken: string;              // Token being given in return
  side: P2POfferSide;               // From admin perspective
  settlement: P2PSettlementType;     // Copied from offer
  unitPrice: number;                // Snapshot price at trade creation (always concrete, even if offer was FLOAT)
  
  // Trade amounts (legacy names kept for compatibility)
  cryptoAmount: number;              // Amount of crypto being traded
  cryptoCurrency: string;            // Legacy field - use assetSymbol
  cryptoNetwork?: string;           // Crypto network
  fiatAmount: number;               // Amount in fiat currency
  fiatCurrency: string;             // Fiat currency
  pricePerUnit: number;             // Legacy field - use unitPrice
  
  // Deadlines
  deadlines?: {                      // JSONB with deadlines
    payBy?: Date;
    confirmBy?: Date;
  };
  
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
  paymentInstructions?: any;         // Copy from offer for Case 2
  
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

// Escrow Interface (Offer-based escrow tracking)
export interface P2PEscrow extends IModel, IDocumentModel<P2PEscrow> {
  escrowId: string;                 // Unique escrow identifier
  offerId: string;                  // Reference to offer (one offer can have multiple escrows)
  tradeId: string;                  // Reference to trade
  userEmail: string;                // Email of user who created escrow
  adminEmail: string;                // Email of admin (offer creator)
  
  // Settlement details
  user_sends_asset: string;         // Asset user sends (e.g., "USD")
  user_sends_amount: number;        // Amount user sends
  user_receives_asset: string;      // Asset user receives (e.g., "INEX")
  user_receives_amount: number;     // Amount user receives
  
  status: EscrowStatus;             // Current escrow status (ACTIVE | APPROVED)
  approvedAt?: Date;               // When admin approved the escrow
  approvedBy?: string;             // Email of admin who approved
  createdAt: Date;
  updatedAt: Date;
  
  // Legacy fields (for backward compatibility)
  lockAdminTokenAmount?: number;
  lockAdminTokenSymbol?: string;
  lockUserTokenAmount?: number;
  lockUserTokenSymbol?: string;
  lockAdminUsd?: number;
  lockUserUsd?: number;
  releasedAt?: Date;
}

// Payment Intent Interface
export interface PaymentIntent extends IModel, IDocumentModel<PaymentIntent> {
  intentId: string;                 // Unique intent identifier
  tradeId: string;                  // Reference to trade
  gateway: string;                  // Gateway name (PayPal, etc.)
  gatewayReference?: string;        // Gateway's transaction ID
  amount: number;                   // Payment amount
  currency: string;                 // Currency code (e.g., USD)
  payerUserId: string;              // User making payment
  payeeAdminId: string;             // Admin receiving payment
  status: PaymentIntentStatus;      // Current status
  redirectUrl?: string;             // Gateway redirect URL
  webhookPayload?: any;             // Raw webhook data
  settledAt?: Date;                 // When payment settled
  createdAt: Date;
  updatedAt: Date;
}
