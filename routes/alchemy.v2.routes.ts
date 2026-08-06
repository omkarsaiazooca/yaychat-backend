import { Router } from "express";
import { AlchemyController } from "../controllers/alchemyAPI";
import { validateAuthHeader } from "../helpers/middleware";

const alchemyV2Router: Router = Router();
const alchemyController: AlchemyController = new AlchemyController();

alchemyV2Router.use(validateAuthHeader);

alchemyV2Router.get("/config", alchemyController.getAlchemyConfig);
alchemyV2Router.post("/process", alchemyController.processAlchemySessionV2);
alchemyV2Router.post("/complete", alchemyController.completeAlchemySession);
alchemyV2Router.post("/airdrop/finalize", alchemyController.finalizeAlchemyExternalAirdrop);
alchemyV2Router.get("/sessions", alchemyController.listAlchemySessions);
alchemyV2Router.get("/sessions/summary", alchemyController.getAlchemyTransactionSummary);
alchemyV2Router.get("/sessions/:email", alchemyController.getUserAlchemySessions);
alchemyV2Router.get("/session/:email/:sessionId", alchemyController.getUserAlchemySessionById);
alchemyV2Router.get("/liquidity/pools", alchemyController.listLiquidityPools);
alchemyV2Router.get("/liquidity/pools/active", alchemyController.getActiveLiquidityPool);
alchemyV2Router.post("/liquidity/pools", alchemyController.createLiquidityPool);

export const alchemyV2Route = alchemyV2Router;
