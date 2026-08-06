import { Router } from "express";
import {
  validateEmailDeliverability,
  getBrevoAccountStatus,
  getZeroBounceCreditsStatus,
} from "../controllers/emailValidationAPI";

const emailValidationRouter: Router = Router();

emailValidationRouter.post("/validate", validateEmailDeliverability);
emailValidationRouter.get("/providers/brevo/status", getBrevoAccountStatus);
emailValidationRouter.get("/providers/zerobounce/credits", getZeroBounceCreditsStatus);

export const emailValidationRoute = emailValidationRouter;
