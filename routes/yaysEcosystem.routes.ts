import { Router } from "express";
import { YaysEcosystemController } from "../controllers/yaysEcosystemAPI";
import { validateAuthHeader } from "../helpers/middleware";

const yaysEcosystemRouter: Router = Router();
const controller = new YaysEcosystemController();

// Public: which dashboards can be served with real data on this deployment.
yaysEcosystemRouter.get("/config", controller.getConfig);

// Per-product snapshots. All read-only — actions deep-link to the owning product.
yaysEcosystemRouter.get("/btcy", validateAuthHeader, controller.getBtcy);
yaysEcosystemRouter.get("/shoperpal", validateAuthHeader, controller.getShoperpal);
yaysEcosystemRouter.get("/emmm", validateAuthHeader, controller.getEmmm);
yaysEcosystemRouter.get("/profile", validateAuthHeader, controller.getProfile);

export { yaysEcosystemRouter };
