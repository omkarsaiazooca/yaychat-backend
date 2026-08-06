import { Router } from "express";
import { BitcoinyayAdAuditController } from "../controllers/bitcoinyayAdAudit.controller";

const bitcoinyayAuditRouter = Router();
const bitcoinyayAuditController = new BitcoinyayAdAuditController();

bitcoinyayAuditRouter.post("/", (req, res) =>
  bitcoinyayAuditController.logAdFailure(req, res)
);
bitcoinyayAuditRouter.get("/", (req, res) =>
  bitcoinyayAuditController.getAuditLogs(req, res)
);

export const bitcoinyayAuditRoute = bitcoinyayAuditRouter;
