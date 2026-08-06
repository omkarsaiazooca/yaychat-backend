import { Router } from "express";
import { MarketingEmailController } from "../controllers/marketingEmailAPI";
import { validateAdminRole } from "../helpers/middleware";

const marketingEmailRouter: Router = Router();
const controller = new MarketingEmailController();

marketingEmailRouter.get("/unsubscribe", controller.unsubscribe);
marketingEmailRouter.post("/ses/webhook", controller.sesWebhook);

marketingEmailRouter.use(validateAdminRole);
marketingEmailRouter.post("/contacts/import", controller.importContacts);
marketingEmailRouter.post("/contacts/verify-smtp", controller.startSmtpVerification);
marketingEmailRouter.get("/contacts/verify-smtp", controller.listVerificationJobs);
marketingEmailRouter.get("/contacts/verify-smtp/:id", controller.getVerificationJob);
marketingEmailRouter.post("/contacts/verify-smtp/:id/cancel", controller.cancelVerificationJob);
marketingEmailRouter.get("/contacts", controller.listContacts);
marketingEmailRouter.post("/contacts", controller.createContact);
marketingEmailRouter.patch("/contacts/bulk", controller.bulkUpdateContacts);
marketingEmailRouter.delete("/contacts/bulk", controller.deleteContacts);
marketingEmailRouter.patch("/contacts/:id", controller.updateContact);
marketingEmailRouter.post("/templates", controller.createTemplate);
marketingEmailRouter.get("/templates", controller.listTemplates);
marketingEmailRouter.delete("/templates/:id", controller.deleteTemplate);
marketingEmailRouter.post("/test-email", controller.sendTestEmail);
marketingEmailRouter.post("/campaigns", controller.createCampaign);
marketingEmailRouter.get("/campaigns", controller.listCampaigns);
marketingEmailRouter.get("/campaigns/:id", controller.getCampaign);
marketingEmailRouter.post("/campaigns/:id/send", controller.sendCampaign);

export const marketingEmailRoute = marketingEmailRouter;
