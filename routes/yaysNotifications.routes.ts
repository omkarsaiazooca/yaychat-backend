import { Router } from "express";
import { YaysNotificationsController } from "../controllers/yaysNotificationsAPI";
import { validateAuthHeader } from "../helpers/middleware";

const yaysNotificationsRouter: Router = Router();
const controller = new YaysNotificationsController();

// Public: transport status and the deep-link route table. The client reads
// this before sign-in to decide whether to ask for notification permission.
yaysNotificationsRouter.get("/config", controller.getConfig);

// Device registry — one row per install, so every signed-in device is reached.
yaysNotificationsRouter.post("/devices", validateAuthHeader, controller.registerDevice);
yaysNotificationsRouter.get("/devices", validateAuthHeader, controller.listDevices);
yaysNotificationsRouter.delete(
  "/devices/:deviceId",
  validateAuthHeader,
  controller.unregisterDevice
);

// Preferences: categories, sounds, previews, quiet hours, per-conversation mute.
yaysNotificationsRouter.get("/preferences", validateAuthHeader, controller.getPreferences);
yaysNotificationsRouter.post("/preferences", validateAuthHeader, controller.updatePreferences);
yaysNotificationsRouter.post("/mute", validateAuthHeader, controller.muteConversation);

// In-app inbox — written even when the push itself is suppressed.
yaysNotificationsRouter.get("/inbox", validateAuthHeader, controller.listInbox);
yaysNotificationsRouter.post("/inbox/read-all", validateAuthHeader, controller.markAllRead);
yaysNotificationsRouter.post(
  "/inbox/:notificationId/read",
  validateAuthHeader,
  controller.markRead
);

// Self-test: proves permission → token → transport → deep link end to end.
yaysNotificationsRouter.post("/test", validateAuthHeader, controller.sendTest);

export { yaysNotificationsRouter };
