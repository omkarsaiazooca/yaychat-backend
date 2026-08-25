import { Router } from "express";
import { YaysCallsController } from "../controllers/yaysCallsAPI";
import { validateAuthHeader } from "../helpers/middleware";

const yaysCallsRouter: Router = Router();
const controller = new YaysCallsController();

// Public capability probe — no credentials in the response.
yaysCallsRouter.get("/config", controller.getConfig);

// ICE servers carry short-lived TURN credentials, so they are per-user.
yaysCallsRouter.get("/ice", validateAuthHeader, controller.getIceServers);

yaysCallsRouter.get("/history", validateAuthHeader, controller.getHistory);
yaysCallsRouter.get("/active", validateAuthHeader, controller.getActiveCall);
yaysCallsRouter.get("/:callId", validateAuthHeader, controller.getCall);
yaysCallsRouter.post("/:callId/end", validateAuthHeader, controller.endCall);

export { yaysCallsRouter };
