import { Router } from "express";
import { EarningsController } from "../controllers/earningsAPI";
import { validateAuthHeader } from "../helpers/middleware";

const earningsRouter: Router = Router();
const earningsController = new EarningsController();

earningsRouter.get("/overview", validateAuthHeader, (req, res) =>
  earningsController.getOverview(req, res)
);

earningsRouter.get("/user", validateAuthHeader, (req, res) =>
  earningsController.getUserEarnings(req, res)
);

earningsRouter.get("/users", validateAuthHeader, (req, res) =>
  earningsController.getAllUsersEarnings(req, res)
);

export const earningsRoute = earningsRouter;
