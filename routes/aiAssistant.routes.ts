import { Router } from "express";
import { AiAssistantController } from "../controllers/aiAssistantAPI";
import { validateAuthHeader } from "../helpers/middleware";

const aiAssistantRouter: Router = Router();
const controller = new AiAssistantController();

// Catalogue is public so the AI hub can render before sign-in.
aiAssistantRouter.get("/config", controller.getConfig);

// Everything below acts on a specific user's data or spends their quota.
aiAssistantRouter.get("/usage", validateAuthHeader, controller.getUsage);
aiAssistantRouter.get("/consent", validateAuthHeader, controller.getConsent);
aiAssistantRouter.post("/consent", validateAuthHeader, controller.updateConsent);

aiAssistantRouter.get("/conversations", validateAuthHeader, controller.listConversations);
aiAssistantRouter.post("/conversations", validateAuthHeader, controller.createConversation);
aiAssistantRouter.get(
  "/conversations/:conversationId",
  validateAuthHeader,
  controller.getConversation
);
aiAssistantRouter.post(
  "/conversations/:conversationId/messages",
  validateAuthHeader,
  controller.sendMessage
);
aiAssistantRouter.post(
  "/conversations/:conversationId/saved",
  validateAuthHeader,
  controller.setSaved
);
aiAssistantRouter.delete(
  "/conversations/:conversationId",
  validateAuthHeader,
  controller.deleteConversation
);

// One-shot assists from inside a chat or community (consent-gated).
aiAssistantRouter.post("/assist", validateAuthHeader, controller.assist);

// Abuse reporting for AI answers.
aiAssistantRouter.post("/reports", validateAuthHeader, controller.reportAnswer);

// Support desk.
aiAssistantRouter.get("/support/tickets", validateAuthHeader, controller.listTickets);
aiAssistantRouter.post("/support/tickets", validateAuthHeader, controller.createTicket);
aiAssistantRouter.post(
  "/support/tickets/:ticketId/messages",
  validateAuthHeader,
  controller.replyToTicket
);
aiAssistantRouter.post(
  "/support/tickets/:ticketId/escalate",
  validateAuthHeader,
  controller.escalateTicket
);

export { aiAssistantRouter };
