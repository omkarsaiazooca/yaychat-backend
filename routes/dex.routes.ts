import { Router } from 'express';
import { DEXController } from "../controllers/decentralizedAPI";

const dexRouter: Router = Router();
const dEXController: DEXController = new DEXController();

dexRouter.post("/register", dEXController.registerUser);
dexRouter.get("/getHistory", );
dexRouter.post("/createExchange", dEXController.createExchange);
dexRouter.get("/orderById/:orderId",dEXController.getOrderDetails);
dexRouter.get("/exchangeStatus/:orderId", );
dexRouter.get("/depositStatus/:orderId", );
dexRouter.get("/confirmStatus/:orderId", );
dexRouter.get("/webhook", dEXController.alchemyWebhook);
dexRouter.post("/webhook1", dEXController.alchemyWebhook);
dexRouter.post("/checkAndUpdateDeposit", dEXController.checkDeposit);
dexRouter.post("/checkAndUpdateExchange", dEXController.confirmExchange);
dexRouter.post("/checkAndConfirmExchange", dEXController.checkAndConfirmExchange);
dexRouter.post("/stripe/createPaymentIntent", dEXController.createStripePaymentIntent);
dexRouter.get("/stripe/updatePaymentIntent", dEXController.updateStripePaymentIntent);
dexRouter.get("/gettradetoearnrewards/:userWalletAddr", dEXController.getTradeToEarnRewards);
dexRouter.post("/withdrawRewards", dEXController.withdrawRewards);
dexRouter.post('/paypalWebhook', dEXController.paypalWebhookupdateOrder);
dexRouter.post('/startSubcribe', dEXController.startBlockchainSubscribe);
dexRouter.post("/createblockcypherwebhook", dEXController.createBlockCypherWebHook);
dexRouter.post("/webhook", dEXController.handleWebhook);
dexRouter.get("/generateBitcoinAddress", dEXController.generateBitcoinAddress);
export const dexRoutes = dexRouter;
