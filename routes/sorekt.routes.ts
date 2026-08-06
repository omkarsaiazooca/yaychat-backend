import { Router } from "express";
import { SorektController } from "../controllers/sorektAPI";

const srtNFTRouter: Router = Router();
const sorektController : SorektController = new SorektController();

srtNFTRouter.get("/checkTx", sorektController.checkTx);
srtNFTRouter.post("/transferSRT", sorektController.mintSorekt);
srtNFTRouter.post("/checkIsWhitelist", sorektController.checkAddressIsWhitelisted)

export const srtNFTRoute = srtNFTRouter;
