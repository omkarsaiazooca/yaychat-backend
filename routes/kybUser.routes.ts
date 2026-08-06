import { Router } from "express";
import { KYBUserController } from "../controllers/kybUserAPI";
import { validateAuthHeader } from "../helpers/middleware";

const kybUserRouter: Router = Router();
const kybUserController = new KYBUserController();

// kybUserRouter.use(validateAuthHeader); // TODO: enable when ready

// Step 1: Business Information Form
kybUserRouter.post("/applications", kybUserController.createApplication);
kybUserRouter.put("/applications/:id/business-info", kybUserController.updateBusinessInfo);

// Step 2: Upload Corporate Documents
kybUserRouter.post("/documents/upload", kybUserController.uploadDocumentDirect);
kybUserRouter.get("/applications/:id/documents", kybUserController.getApplicationDocuments);
kybUserRouter.delete("/applications/:id/documents/:documentId", kybUserController.deleteApplicationDocument);

// Step 3: Add Directors & UBOs
kybUserRouter.post("/applications/:id/directors", kybUserController.addDirector);
kybUserRouter.delete("/directors/:directorId", kybUserController.deleteDirector);
kybUserRouter.get("/applications/:id/directors", kybUserController.getDirectors);

// Step 3 & 4: Add UBOs and track KYC status
kybUserRouter.post("/applications/:id/ubos", kybUserController.addUBO);
kybUserRouter.delete("/ubos/:uboId", kybUserController.deleteUBO);
kybUserRouter.get("/applications/:id/ubos", kybUserController.getUBOs);
kybUserRouter.put("/ubos/:uboId/kyc-status", kybUserController.updateUBOKycStatus);

// Step 5: Add tax information
kybUserRouter.post("/applications/:id/tax-info", kybUserController.addTaxInfo);
kybUserRouter.get("/applications/:id/tax-info", kybUserController.getTaxInfo);

// Step 6: AML / Compliance questionnaire
kybUserRouter.put("/applications/:id/compliance-info", kybUserController.updateComplianceInfo);
kybUserRouter.get("/applications/:id/compliance-info", kybUserController.getComplianceInfo);

// Step 9: Submit application
kybUserRouter.post("/applications/:id/submit", kybUserController.submitApplication);

// Get status
kybUserRouter.get("/status", kybUserController.getStatus);

export const kybUserRoutes = kybUserRouter;
