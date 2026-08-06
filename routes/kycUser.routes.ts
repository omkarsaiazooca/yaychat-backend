import { Router } from "express";
import { KYCUserController } from "../controllers/kycUserAPI";
import { validateAuthHeader } from "../helpers/middleware";

const kycUserRouter: Router = Router();
const kycUserController: KYCUserController = new KYCUserController();

// All routes require authentication
// TODO: Uncomment this after testing
// kycUserRouter.use(validateAuthHeader);

// // Create / start KYC application
// kycUserRouter.post("/applications", kycUserController.createApplication);
// // Update KYC application personal info
// kycUserRouter.patch("/applications/:id", kycUserController.updateApplication);
// // Get pre-signed upload URL for a document
// kycUserRouter.post("/applications/:id/documents/presign", kycUserController.getPresignedUploadUrl);
// // Confirm document uploaded
// kycUserRouter.post("/applications/:id/documents", kycUserController.confirmDocumentUpload);

// Get current user KYC status
kycUserRouter.get("/status", kycUserController.getStatus);
// Update selected country / document metadata before uploads
kycUserRouter.put("/applications/:id/selection", kycUserController.updateSelection);
// Upload document directly from camera (base64 image) - creates/finds application automatically
kycUserRouter.post("/documents/upload", kycUserController.uploadDocumentDirect);
// Get all documents/images for a KYC application
kycUserRouter.get("/applications/:id/documents", kycUserController.getApplicationDocuments);
// Delete a document from a KYC application
kycUserRouter.delete("/applications/:id/documents/:documentId", kycUserController.deleteApplicationDocument);
// Submit KYC application
kycUserRouter.post("/applications/:id/submit", kycUserController.submitApplication);

export const kycUserRoutes = kycUserRouter;

