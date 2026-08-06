import { Router } from "express";
import { AlchemyController } from "../controllers/alchemyAPI";
import { validateAuthHeader } from "../helpers/middleware";
const alchemyRouter: Router = Router();
const alchemyController: AlchemyController = new AlchemyController();

// Protected Routes
// alchemyRouter.use(validateAuthHeader);
alchemyRouter.get("/config", alchemyController.getAlchemyConfig);
alchemyRouter.post("/create", alchemyController.createAlchemySession);
alchemyRouter.post("/complete", alchemyController.completeAlchemySession);
alchemyRouter.get("/sessions", alchemyController.listAlchemySessions);
alchemyRouter.get("/sessions/:email", alchemyController.getUserAlchemySessions);

alchemyRouter.get(
  "/session/:email/:sessionId",
  alchemyController.getUserAlchemySessionById
);

alchemyRouter.get(
  "/admin/config",
  validateAuthHeader,
  alchemyController.getAdminConfig
);
alchemyRouter.post(
  "/admin/update-config",
  validateAuthHeader,
  alchemyController.updateAdminConfig
);
export const alchemyRoute = alchemyRouter;
