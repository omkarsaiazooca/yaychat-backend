import { Router } from "express";
import { P2PController } from "../controllers/p2pAPI";

const p2pRouter: Router = Router();
const p2pController: P2PController = new P2PController();

// All P2P routes are public (no authentication required)

// Offer Management - Updated routes
// p2pRouter.get("/offers/all", p2pController.getOffers); // Get all offers
// p2pRouter.get("/offers/sell", p2pController.getSellOffers); // Get sell offers
// p2pRouter.get("/offers/buy", p2pController.getBuyOffers); // Get buy offers

p2pRouter.post("/offers", p2pController.createOffer);
p2pRouter.get("/offers/:offerId", p2pController.getOfferDetails);
p2pRouter.put("/offers/:offerId", p2pController.updateOffer);
p2pRouter.delete("/offers/:offerId", p2pController.deleteOffer);

// User-specific offer management (requires authentication)
p2pRouter.post("/user/offers", p2pController.createOfferWithAssetWallet); // Create offer with asset wallet only
p2pRouter.get("/user/offers", p2pController.getUserOffers); // Get all offers created by user
p2pRouter.put("/user/offers/:offerId", p2pController.userUpdateOffer); // Update own offer
p2pRouter.post("/user/offers/:offerId/pause", p2pController.userPauseOffer); // Pause/Resume own offer
p2pRouter.delete("/user/offers/:offerId", p2pController.userDeleteOffer); // Delete own offer
p2pRouter.get("/user/offers/:offerId/escrows", p2pController.userListEscrows); // See who joined own offer
p2pRouter.post("/user/offers/:offerId/join-asset", p2pController.userJoinOfferWithAsset); // Join another user's offer (instant P2P transfer)

// Trade Management
p2pRouter.post("/trades", p2pController.createTrade);
p2pRouter.get("/trades", p2pController.getUserTrades);

// User Trade Queries (MUST come before /trades/:tradeId to avoid route conflicts)
p2pRouter.get("/trades/completed", p2pController.getUserCompletedTrades);
p2pRouter.get("/trades/pending", p2pController.getUserPendingTrades);

// Trade Details (must come after specific routes)
p2pRouter.get("/trades/:tradeId", p2pController.getTradeDetails);

// Escrow APIs removed - escrow handled automatically in trade creation

// Offer Management - Updated routes
p2pRouter.get("/offers", p2pController.getOffers); // Get all offers
p2pRouter.get("/sell", p2pController.getSellOffers); // Get sell offers
p2pRouter.get("/buy", p2pController.getBuyOffers); // Get buy offers


// Join Offer Endpoints (Admin-Offer System)
p2pRouter.post("/offers/:offerId/join-asset", p2pController.joinOfferWithAsset);
p2pRouter.post("/offers/:offerId/join-gateway", p2pController.joinOfferWithGateway);

// Trade Actions
p2pRouter.post("/trades/:tradeId/cancel", p2pController.cancelTrade);
    
// Dispute Management
p2pRouter.post("/disputes", p2pController.createDispute);
p2pRouter.get("/disputes", p2pController.getDisputes);

// Rating System
p2pRouter.post("/ratings", p2pController.submitRating);
p2pRouter.get("/ratings/:email", p2pController.getUserRatings);


// ==================== ADMIN APIs ====================user 
// Admin Authentication
p2pRouter.post("/admin/signup", p2pController.adminSignup);
p2pRouter.post("/admin/login", p2pController.adminLogin);


// Admin Offer Management
p2pRouter.post("/admin/offers", p2pController.createOffer);
p2pRouter.get("/admin/offers", p2pController.adminGetAllOffers);
p2pRouter.get("/admin/offers/ids", p2pController.adminGetOfferIds);
p2pRouter.patch("/admin/offers/:offerId", p2pController.adminUpdateOffer);
p2pRouter.delete("/admin/offers/:offerId", p2pController.adminDeleteOffer);
p2pRouter.post("/admin/offers/:offerId/pause", p2pController.adminPauseOffer);
// Explicit status endpoint
p2pRouter.post("/admin/offers/:offerId/status/closed", p2pController.adminSetOfferClosed);

// Admin Escrow Management
p2pRouter.get("/admin/offers/:offerId/escrows", p2pController.adminListEscrows);
p2pRouter.post("/admin/escrows/:escrowId/approve", p2pController.adminApproveEscrow);

// Admin Trade Management
p2pRouter.get("/admin/trades", p2pController.adminGetAllTrades);

// Admin Wallet Management
p2pRouter.post("/admin/wallet/create", p2pController.createAdminAssetWallet);
p2pRouter.post("/admin/wallet/fund", p2pController.fundAdminAssetWallet);
p2pRouter.get("/admin/wallet/balance", p2pController.getAdminBalance);

export { p2pRouter };
