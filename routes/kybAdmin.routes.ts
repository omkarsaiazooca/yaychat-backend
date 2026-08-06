import { Router } from "express";
import { KYBAdminController } from "../controllers/kybAdminAPI";
import { validateAuthHeader } from "../helpers/middleware";

const kybAdminRouter: Router = Router();
const kybAdminController = new KYBAdminController();

// kybAdminRouter.use(validateAuthHeader); // TODO: enable when JWT ready

// List and view applications
kybAdminRouter.get("/applications", kybAdminController.listApplications);
kybAdminRouter.get("/applications/pending", kybAdminController.getPendingApplications);
kybAdminRouter.get("/applications/approved", kybAdminController.getApprovedApplications);
kybAdminRouter.get("/applications/rejected", kybAdminController.getRejectedApplications);
kybAdminRouter.get("/applications/:id", kybAdminController.getApplicationDetail);

// Document viewing
kybAdminRouter.get("/documents/:documentId/view-url", kybAdminController.getDocumentViewUrl);

// Step 7: Compliance screening
kybAdminRouter.post("/applications/:id/compliance-screening", kybAdminController.runComplianceScreening);

// Step 8: Manual review
kybAdminRouter.post("/applications/:id/manual-review/complete", kybAdminController.completeManualReview);

// Step 9: Approval/Rejection
kybAdminRouter.post("/applications/:id/approve", kybAdminController.approveApplication);
kybAdminRouter.post("/applications/:id/reject", kybAdminController.rejectApplication);
kybAdminRouter.post("/applications/:id/need-more-info", kybAdminController.needMoreInfo);

export const kybAdminRoutes = kybAdminRouter;
