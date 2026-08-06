import { Router } from "express";
import { AlchemyPoolController } from "../controllers/alchemyPoolAPI";
import { validateAuthHeader } from "../helpers/middleware";

const poolRouter: Router = Router();
const poolController = new AlchemyPoolController();

poolRouter.use(validateAuthHeader);
poolRouter.get("/", poolController.listPools.bind(poolController));
poolRouter.get("/active", poolController.getActivePool.bind(poolController));
poolRouter.get("/:poolId", poolController.getPoolById.bind(poolController));
poolRouter.post("/", poolController.createPool.bind(poolController));

export const alchemyPoolRoute = poolRouter;
