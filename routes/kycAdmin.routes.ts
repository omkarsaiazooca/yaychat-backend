import { Router } from "express";
import { KYCAdminController } from "../controllers/kycAdminAPI";
import { validateAuthHeader } from "../helpers/middleware";

const kycAdminRouter: Router = Router();
const kycAdminController: KYCAdminController = new KYCAdminController();

// All routes require authentication
// kycAdminRouter.use(validateAuthHeader);

// List KYC applications
kycAdminRouter.get("/applications", kycAdminController.listApplications);

// Get all KYC applications grouped by status (pending, approved, rejected)
kycAdminRouter.get("/applications/status-summary", kycAdminController.getApplicationsByStatus);

// Get pending KYC applications
kycAdminRouter.get("/applications/pending", kycAdminController.getPendingApplications);

// Get approved KYC applications
kycAdminRouter.get("/applications/approved", kycAdminController.getApprovedApplications);

// Get rejected KYC applications
kycAdminRouter.get("/applications/rejected", kycAdminController.getRejectedApplications);

// Get KYC application detail
kycAdminRouter.get("/applications/:id", kycAdminController.getApplicationDetail);

// Get pre-signed VIEW URL for a document
kycAdminRouter.get("/documents/:documentId/view-url", kycAdminController.getDocumentViewUrl);

// Approve KYC
kycAdminRouter.post("/applications/:id/approve", kycAdminController.approveApplication);

// Reject KYC
kycAdminRouter.post("/applications/:id/reject", kycAdminController.rejectApplication);

// Mark 'need more info'
kycAdminRouter.post("/applications/:id/need-more-info", kycAdminController.needMoreInfo);

export const kycAdminRoutes = kycAdminRouter;

