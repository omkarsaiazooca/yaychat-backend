import { Router } from "express";
import { YaysAdminController } from "../controllers/yaysAdminAPI";
import { validateAdminRole } from "../helpers/middleware";

const yaysAdminRouter: Router = Router();
const controller = new YaysAdminController();

// Everything under /api/v1/yays/admin requires an Admin or SuperAdmin token.
yaysAdminRouter.use(validateAdminRole);

// Analytics warehouse.
yaysAdminRouter.get("/overview", controller.overview);
yaysAdminRouter.get("/events", controller.events);
yaysAdminRouter.post("/rollups/recompute", controller.recomputeRollup);

// Crash reporting.
yaysAdminRouter.get("/crashes", controller.crashGroups);
yaysAdminRouter.get("/crashes/:fingerprint", controller.crashDetail);

// Moderation queue (chat + AI reports projected into one list).
yaysAdminRouter.get("/moderation", controller.moderationQueue);
yaysAdminRouter.post("/moderation/sync", controller.syncModeration);
yaysAdminRouter.post("/moderation/:caseId/assign", controller.assignCase);
yaysAdminRouter.post("/moderation/:caseId/resolve", controller.resolveCase);

// Operational broadcast to an explicit recipient list.
yaysAdminRouter.post("/notifications/broadcast", controller.broadcast);

export { yaysAdminRouter };
