// src/routes/notificationPrefs.routes.ts
import { Router } from "express";
import {
  subscribeTopic,
  unsubscribeTopic,
  unsubscribeAllTopics,
  unregisterToken,
  setPushEnabled,
  setCategoryPref,
  adminNotifyByTemplate,
} from "../controllers/adminNotification";
import { adminNotifyAllController } from "../controllers/adminNotification";

// import { requireAuth } from "../middleware/auth";         // user-auth routes
// import { requireAdmin } from "../middleware/adminAuth";    // admin-only if you prefer

const router = Router();

// User or Admin (your call — protect appropriately)
router.post("/topic/subscribe", /*requireAuth,*/ subscribeTopic);
router.post("/topic/unsubscribe", /*requireAuth,*/ unsubscribeTopic);
router.post("/topic/unsubscribe-all", /*requireAuth,*/ unsubscribeAllTopics);

// Device-level
router.post("/token/unregister", /*requireAuth,*/ unregisterToken);

// User-level prefs (server enforced)
router.post("/prefs/push", /*requireAuth,*/ setPushEnabled);
router.post("/prefs/category", /*requireAuth,*/ setCategoryPref);

// POST /api/v1/admin/notify/all?mode=topic|tokens
router.post("/notify/all", /* requireAdmin, */ adminNotifyAllController);
router.post("/notify/by-template", /* requireAdmin, */ adminNotifyByTemplate);
export default router;
