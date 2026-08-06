import { Router } from "express";
import { WhitelistController } from "../controllers/whitelistAPI";
import { validateAuthHeader } from "../helpers/middleware";

const whitelistRouter: Router = Router();
const whitelistController: WhitelistController = new WhitelistController();

// All routes require authentication
whitelistRouter.use(validateAuthHeader);

// POST - Add email to whitelist (Admin only)
whitelistRouter.post("/", whitelistController.addEmail);

// GET - Get all whitelisted emails (Admin only)
whitelistRouter.get("/", whitelistController.getAllEmails);

// PUT - Update whitelist entry (Admin only)
whitelistRouter.put("/", whitelistController.updateEmail);

// DELETE - Remove email from whitelist (Admin only)
whitelistRouter.delete("/:email", whitelistController.deleteEmail);

// GET - Check if email is whitelisted
whitelistRouter.get("/check/:email", whitelistController.checkEmail);

export const whitelistRoute = whitelistRouter;


