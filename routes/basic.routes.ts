import { Router } from "express";
import { BasicController } from "../controllers/basicAPI";
import { cryptoPrice, getPriceByName as getCoinPriceByName } from "../controllers/priceAPI";
import { UserController } from "../controllers/userAPI";

const basicRouter: Router = Router();
const userController: UserController = new UserController();
const basicController: BasicController = new BasicController();

basicRouter.post("/allcoins", cryptoPrice);
basicRouter.get("/mongoHealth", basicController.getMongoHealthStatus);
basicRouter.get("/mongoHealth", basicController.getMongoHealthStatus);
basicRouter.get("/getS3PresignedUrl", basicController.getS3PresignedUrl);
basicRouter.get("/getS3PresignedUrlForMobile", basicController.getS3PresignedUrlForMobile);
basicRouter.get("/getAirdropContent", basicController.getAirdropLottoContent);
basicRouter.post("/indexxcoins", userController.getIndexxTokensPrice);
basicRouter.post("/appSettings", basicController.getSettings);
basicRouter.get("/btcyForceUpdateSettings", basicController.btcyAppSettings);
basicRouter.post("/orderMinMax", basicController.orderMinMax);
basicRouter.get("/getcoinprice/:coin", userController.getPriceByName);
basicRouter.post("/getcoinprice/:coin", userController.getPriceByName);
basicRouter.get("/getcoinprice/:coin", userController.getPriceByName);
basicRouter.get("/btcy/price", async (_req, res) => {
  const results = await getCoinPriceByName("BTCY");
  res.statusCode = 200;
  res.send({
    status: 200,
    data: {
      results,
    },
  });
});
basicRouter.get("/getallstockprices", userController.getAllStockPrices);
basicRouter.post("/getPriceByName", userController.cryptoPriceByName);
basicRouter.get("/marketPrice", userController.marketsData);
basicRouter.get("/newListing", userController.newListingData);
basicRouter.get("/hotTokens", userController.hotTokensData);
basicRouter.get("/hotStockTokens", userController.hotStockTokensData);
basicRouter.get("/hotETFTokens", userController.hotETFTokensData);
basicRouter.get("/stockmarketPrice/:symbol", userController.stockMarketsData);
basicRouter.get("/stockmarketPriceWithHistory/:symbol", userController.stockMarketsDataWithHistory);
basicRouter.get("/indexxBlogs", basicController.indexxBlogs);
basicRouter.get("/sorektPriceData", basicController.soRektPriceData);
basicRouter.post("/decryptPkey", basicController.decryptoPrivateKey);
basicRouter.get("/stockdata", basicController.stockData);
basicRouter.post("/registerairdrop", basicController.airdropRegister);
basicRouter.post("/registerwallstreetinexairdrop", basicController.wallstreetInexAirdropRegister);
basicRouter.post("/registerbitcoinairdrop", basicController.bitcoinAirdropRegister);
basicRouter.post("/registerwibsairdrop", basicController.whoIsBitcoinSatoshiAirdropRegister);
basicRouter.post("/registerwibsmayairdrop", basicController.whoIsBitcoinSatoshiAirdrop27MayRegister);
basicRouter.post("/registerwibsjun16airdrop", basicController.whoIsBitcoinSatoshiAirdrop16JunRegister);
basicRouter.post("/registerdacrazyairdrop", basicController.dacrazyAirdropRegister);
basicRouter.post("/registerbtcyairdrop", basicController.btcyAirdropRegister);
basicRouter.post(
  "/registerbtcynewyear2026airdrop",
  basicController.btcyNewYear2026AirdropRegister
);
basicRouter.post(
  "/registerbtcyloyaltyairdrop",
  basicController.btcyLoyaltyAirdropRegister
);
basicRouter.post(
  "/registerbtcysocialpostairdrop",
  basicController.btcySocialPostAirdropRegister
);
basicRouter.get("/allbtcyairdrop", basicController.getbtcyAirdropRegister);
basicRouter.get("/allbtcyloyaltyairdrop", basicController.getbtcyLoyaltyAirdropRegister);
basicRouter.get("/all4thjlybtcyairdrop", basicController.getbtcy4thJlyAirdropRegister);
basicRouter.get("/allbtcylottoairdrop", basicController.getbtcyLottoAirdropRegister);
basicRouter.get("/allwibsairdrop29Sep", basicController.getWIBSAirdropRegister);
basicRouter.get(
  "/allbtcynewyear2026airdrop",
  basicController.getbtcyNewYear2026AirdropRegister
);
basicRouter.get("/airdrop-status", basicController.getActiveAirdropStatus);
basicRouter.get("/airdrop-campaign", basicController.getAirdropCampaign);
basicRouter.post("/airdrop-campaign", basicController.upsertAirdropCampaign);
basicRouter.get("/tutorial-status", basicController.getTutorialStatus);
basicRouter.post("/tutorial-status", basicController.upsertTutorialStatus);
basicRouter.get("/tutorial-status/plan", basicController.getPlanTutorialStatus);
basicRouter.post("/tutorial-status/plan", basicController.upsertPlanTutorialStatus);
basicRouter.get("/tutorial-status/both", basicController.getTutorialStatusBoth);
basicRouter.get(
  "/btcyloyaltyairdrop-status",
  basicController.getBtcyLoyaltyAirdropStatus
);
basicRouter.get("/allairdropuser", basicController.allAirdropRegisterUsers);
basicRouter.get("/allbitcoinairdropuser", basicController.allBitcoinAirdropRegisterUsers);
basicRouter.get("/allwibsairdropuser", basicController.allWIBSAirdropRegisterUsers);
basicRouter.get("/allmaywibsairdropuser", basicController.allMayWIBSAirdropRegisterUsers);
basicRouter.get("/alljunwibsairdropuser", basicController.allJunWIBSAirdropRegisterUsers);
basicRouter.get("/alldacrazyairdropuser", basicController.allDacrazyAirdropRegisterUsers);
basicRouter.get("/getAllLotteries", basicController.getAllLotteryDetails);
basicRouter.get("/getLotteryById/:lotteryId", basicController.getLotteryDetailsById);
basicRouter.post("/emailsubscribe", basicController.emailSubscription);
basicRouter.post("/emailToAdmin", basicController.contactUs);
basicRouter.post("/academy/sendconfirmemail", basicController.academyConfirmEmail);
basicRouter.post("/academy/instructorRequest", basicController.academyInstructorRequest);
basicRouter.post("/academy/contactUs", basicController.academyContactUs);
basicRouter.get("/getsmartpackages", basicController.getSmartCryptoPackages);
basicRouter.get("/getspecificsmartpackage/:title/:subtitle", basicController.getSpecificSmartCryptoPackage);
basicRouter.post("/updatespecificsmartpackage/:title/:subtitle", basicController.updateSpecificSmartCryptoPackage);
basicRouter.post(
  "/resend-order-email",
  basicController.resendOrderEmail
);
export const basicRoute = basicRouter;
