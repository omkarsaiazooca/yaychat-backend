import { Router } from "express";
import { GiftCardController } from "../controllers/giftCardAPI";

const giftCardRouter: Router = Router();
const giftCardController: GiftCardController = new GiftCardController();

giftCardRouter.post("/validateVoucher", giftCardController.validateGiftCard);
giftCardRouter.post("/redeemCoupon", giftCardController.redeemGiftCard);
giftCardRouter.post("/validateXNFTVoucher", giftCardController.validateXNFTGiftCard);
giftCardRouter.post("/redeemXNFTCoupon", giftCardController.redeemXNFTCard);
giftCardRouter.post("/validateStockVoucher", giftCardController.validateStockGiftCard);
giftCardRouter.post("/redeemStockCoupon", giftCardController.redeemStockGiftCardForExchange);
giftCardRouter.post("/withdrawStockFromCEX", giftCardController.withdrawStockTokenFromExchanage);

export const giftCardRoutes = giftCardRouter;
