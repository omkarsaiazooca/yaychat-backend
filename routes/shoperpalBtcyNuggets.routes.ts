import { Router } from "express";
import { ShoperPalBtcyNuggetsController } from "../controllers/shoperpalBtcyNuggetsAPI";
import { validateShoperPalServiceRequest } from "../middleware/shoperpalServiceAuth";

const shoperpalBtcyNuggetsRouter: Router = Router();
const controller = new ShoperPalBtcyNuggetsController();

shoperpalBtcyNuggetsRouter.post("/credit", validateShoperPalServiceRequest, controller.credit);
shoperpalBtcyNuggetsRouter.get("/balance", validateShoperPalServiceRequest, controller.balance);
shoperpalBtcyNuggetsRouter.get("/history", validateShoperPalServiceRequest, controller.history);

export const shoperpalBtcyNuggetsRoute = shoperpalBtcyNuggetsRouter;
