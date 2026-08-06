import { Router } from "express";
import { SocialCampaignController } from "../controllers/socialCampaign.controller";
import { validateAuthHeader, validateAdminRole } from "../helpers/middleware";

const socialCampaignRouter: Router = Router();
const controller = new SocialCampaignController();

// User-facing routes (bitcoinyay + emmm end users, JWT auth)
socialCampaignRouter.post("/presign", validateAuthHeader, controller.requestPresignedUpload);
socialCampaignRouter.post("/submissions", validateAuthHeader, controller.createSubmission);
socialCampaignRouter.get("/submissions/me", validateAuthHeader, controller.getMySubmission);

// Admin-facing routes (review queue)
socialCampaignRouter.get("/admin/submissions", validateAdminRole, controller.listSubmissions);
socialCampaignRouter.get("/admin/submissions/:id", validateAdminRole, controller.getSubmission);
socialCampaignRouter.post("/admin/submissions/:id/approve", validateAdminRole, controller.approveSubmission);
socialCampaignRouter.post("/admin/submissions/:id/reject", validateAdminRole, controller.rejectSubmission);

export const socialCampaignRoute = socialCampaignRouter;
